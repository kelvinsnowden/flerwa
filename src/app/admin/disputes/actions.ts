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
  const { error } = await supabase.rpc("rpc_resolve_dispute", {
    p_dispute_id: disputeId,
    p_provider_minor: providerMinor,
    p_customer_refund_minor: customerRefundMinor,
    p_resolution: resolution,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/disputes");
  revalidatePath("/admin");
  return { success: true };
}
