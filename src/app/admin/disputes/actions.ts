"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function resolveDispute(
  disputeId: string,
  providerMinor: number,
  customerRefundMinor: number,
  resolution: string
) {
  const supabase = await createClient();
  // GOV-P4 (dual control): proposes the refund/payout split; a DIFFERENT
  // trust & safety or finance admin must approve it from /admin/approvals
  // before any ledger entry is actually posted.
  const { data, error } = await supabase.rpc("rpc_resolve_dispute", {
    p_dispute_id: disputeId,
    p_provider_minor: providerMinor,
    p_customer_refund_minor: customerRefundMinor,
    p_resolution: resolution,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/disputes");
  revalidatePath("/admin");
  revalidatePath("/admin/approvals");
  return { success: true, pending: true as const, approvalId: data as string };
}

export async function assignDispute(disputeId: string, assigneeId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_assign_dispute", {
    p_dispute_id: disputeId,
    p_assignee_id: assigneeId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/disputes");
  return { success: true };
}
