"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setVerificationStatus(
  providerId: string,
  status: "verified" | "rejected",
  notes: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_verification_status", {
    p_provider_id: providerId,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/verifications");
  return { success: true };
}

export async function setCategoryClearance(providerId: string, categoryId: string, cleared: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_category_clearance", {
    p_provider_id: providerId,
    p_category_id: categoryId,
    p_cleared: cleared,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/verifications");
  return { success: true };
}

export async function publishProvider(providerId: string, publish: boolean) {
  const supabase = await createClient();
  // is_published is not itself a trust claim (verification_status is the
  // trust claim, gated by the RPC above) — see docs/06-trust-architecture.md's
  // badge definitions. Still routed through an RPC rather than a direct
  // table update so this admin action is logged to admin_actions like every
  // other one (MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PROV-E3).
  const { error } = await supabase.rpc("rpc_admin_set_provider_published", {
    p_provider_id: providerId,
    p_publish: publish,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/verifications");
  return { success: true };
}
