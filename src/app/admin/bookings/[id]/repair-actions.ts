"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function correctTransactionAmount(
  transactionId: string,
  serviceAmountKes: number,
  materialsAmountKes: number,
  reason: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_correct_transaction_amount", {
    p_transaction_id: transactionId,
    p_new_service_amount_minor: Math.round(serviceAmountKes * 100),
    p_new_materials_amount_minor: Math.round(materialsAmountKes * 100),
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${transactionId}`);
  return { success: true };
}

export async function reassignProvider(transactionId: string, newProviderId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_reassign_provider", {
    p_transaction_id: transactionId,
    p_new_provider_id: newProviderId,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${transactionId}`);
  return { success: true };
}

// Dual control (GOV-P4) — this only proposes. A different trust & safety
// or finance admin must approve from /admin/approvals before anything
// actually moves. See rpc_admin_force_resolve_stuck_transaction.
export async function forceResolveStuckTransaction(
  transactionId: string,
  providerMinorKes: number,
  customerRefundKes: number,
  resolution: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_force_resolve_stuck_transaction", {
    p_transaction_id: transactionId,
    p_provider_minor: Math.round(providerMinorKes * 100),
    p_customer_refund_minor: Math.round(customerRefundKes * 100),
    p_resolution: resolution,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${transactionId}`);
  return { success: true };
}
