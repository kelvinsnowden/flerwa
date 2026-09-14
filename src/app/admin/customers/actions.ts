"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCustomerSuspended(profileId: string, suspended: boolean, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_customer_suspended", {
    p_profile_id: profileId,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/customers/${profileId}`);
  revalidatePath("/admin/customers");
  return { success: true };
}
