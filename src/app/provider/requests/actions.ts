"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitQuote(requestId: string, amountKes: string, message: string) {
  const supabase = await createClient();
  const amountMinor = Math.round(Number(amountKes) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return { error: "Enter a valid quote amount." };
  }

  const { error } = await supabase.rpc("rpc_submit_quote", {
    p_request_id: requestId,
    p_amount_minor: amountMinor,
    p_message: message || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/provider/requests/${requestId}`);
  revalidatePath("/provider/requests");
  return { success: true as const };
}
