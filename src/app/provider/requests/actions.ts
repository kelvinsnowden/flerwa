"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateDemandSessionId, logDemandEvent } from "@/lib/demand-events";

export async function submitQuote(requestId: string, amountKes: string, message: string) {
  const supabase = await createClient();
  const amountMinor = Math.round(Number(amountKes) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return { error: "Enter a valid quote amount." };
  }

  const { allowed } = await checkRateLimit("submit_quote", { max: 20, windowSeconds: 3600 });
  if (!allowed) return { error: "You're submitting quotes too quickly — please wait a bit and try again." };

  const { error } = await supabase.rpc("rpc_submit_quote", {
    p_request_id: requestId,
    p_amount_minor: amountMinor,
    p_message: message || null,
  });
  if (error) return { error: error.message };

  // MARKETPLACE-001 Phase 7 — demand-event instrumentation (inert/no-op
  // until the backing migration is applied).
  const { data: request } = await supabase.from("service_requests").select("category_id").eq("id", requestId).single();
  const demandSessionId = await getOrCreateDemandSessionId();
  await logDemandEvent({
    eventType: "quote_requested",
    sessionId: demandSessionId,
    sourceSurface: "provider_requests",
    categoryId: request?.category_id ?? null,
  });

  revalidatePath(`/provider/requests/${requestId}`);
  revalidatePath("/provider/requests");
  return { success: true as const };
}
