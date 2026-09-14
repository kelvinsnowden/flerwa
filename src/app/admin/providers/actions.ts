"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setProviderSuspended(providerId: string, suspended: boolean, reason: string) {
  const supabase = await createClient();
  // GOV-P4 (dual control): proposes the action; a DIFFERENT trust &
  // safety admin must approve it from /admin/approvals before it
  // actually suspends/reinstates the provider.
  const { data, error } = await supabase.rpc("rpc_admin_set_provider_suspended", {
    p_provider_id: providerId,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/providers/${providerId}`);
  revalidatePath("/admin/providers");
  revalidatePath("/admin/approvals");
  return { success: true, pending: true as const, approvalId: data as string };
}
