"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCustomerSuspended(profileId: string, suspended: boolean, reason: string) {
  const supabase = await createClient();
  // GOV-P4 (dual control): this no longer suspends/reinstates immediately
  // — it proposes the action and returns a pending-approval id. A
  // DIFFERENT trust & safety admin must approve it from /admin/approvals
  // before it takes effect.
  const { data, error } = await supabase.rpc("rpc_set_customer_suspended", {
    p_profile_id: profileId,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/customers/${profileId}`);
  revalidatePath("/admin/customers");
  revalidatePath("/admin/approvals");
  return { success: true, pending: true as const, approvalId: data as string };
}
