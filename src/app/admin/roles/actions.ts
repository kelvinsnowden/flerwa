"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "super_admin" | "support_agent" | "finance_admin" | "trust_safety_admin" | "ops_admin";

export async function grantAdminRole(profileId: string, role: AdminRole) {
  const supabase = await createClient();
  // rpc_grant_admin_role enforces super-admin-only server-side — this
  // call is rejected by the database for anyone else.
  const { error } = await supabase.rpc("rpc_grant_admin_role", { p_profile_id: profileId, p_role: role });
  if (error) return { error: error.message };
  revalidatePath("/admin/roles");
  return { success: true as const };
}

export async function revokeAdminRole(profileId: string, role: AdminRole) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_revoke_admin_role", { p_profile_id: profileId, p_role: role });
  if (error) return { error: error.message };
  revalidatePath("/admin/roles");
  return { success: true as const };
}
