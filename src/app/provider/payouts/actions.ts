"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeKenyanPhone } from "@/lib/phone";
import { attemptPayout } from "@/lib/payouts/initiate";

export async function setPayoutPhone(rawPhone: string) {
  const normalized = normalizeKenyanPhone(rawPhone);
  if (!normalized) return { error: "Enter a valid Kenyan phone number, e.g. 0712345678." };

  const supabase = await createClient();
  // The real validation/authorization boundary is rpc_set_payout_phone
  // itself (re-checks the format, resolves the caller's own provider
  // row, and routes through the guard-trigger bypass so the change gets
  // logged to provider_payout_phone_history) — this normalizes for a
  // consistent stored format, never trusted on its own.
  const { error } = await supabase.rpc("rpc_set_payout_phone", { p_phone: normalized });
  if (error) return { error: error.message };

  revalidatePath("/provider/payouts");
  return { success: true as const };
}

// amountMinor omitted means "withdraw everything available" —
// rpc_request_payout's own default. The amount/balance check is
// re-verified there, server-side; this action never trusts a client-
// supplied balance figure.
export async function requestPayout(amountMinor?: number) {
  const supabase = await createClient();
  const { data: payoutId, error } = await supabase.rpc("rpc_request_payout", {
    p_amount_minor: amountMinor ?? null,
  });
  if (error) return { error: error.message };

  // Outside the RPC's own transaction on purpose — a slow/failed vendor
  // HTTP call here must never affect whether the withdrawal request
  // itself succeeded. See src/lib/payouts/initiate.ts.
  await attemptPayout(payoutId as string);

  revalidatePath("/provider/payouts");
  return { success: true as const };
}
