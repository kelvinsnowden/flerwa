"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function confirmPayment(transactionId: string, externalReference: string, notes: string) {
  if (!externalReference.trim()) return { error: "An M-Pesa reference or receipt note is required." };

  const supabase = await createClient();
  // rpc_confirm_manual_payment is the ONLY path that can move a payment to
  // 'funded' — see supabase/migrations/20260908134754_transaction_functions.sql.
  // There is no browser code path that marks a payment funded directly.
  const { error } = await supabase.rpc("rpc_confirm_manual_payment", {
    p_transaction_id: transactionId,
    p_external_reference: externalReference,
    p_notes: notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/payments");
  return { success: true };
}
