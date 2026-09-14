"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setProviderSuspended(providerId: string, suspended: boolean, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_set_provider_suspended", {
    p_provider_id: providerId,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/providers/${providerId}`);
  revalidatePath("/admin/providers");
  return { success: true };
}
