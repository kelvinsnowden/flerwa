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
  // Direct update, not an RPC: allowed by the "providers self update" RLS
  // policy for is_admin(), and is_published is not itself a trust claim
  // (verification_status is the trust claim, gated by the RPC above) —
  // see docs/06-trust-architecture.md's badge definitions.
  const { error } = await supabase.from("providers").update({ is_published: publish }).eq("id", providerId);
  if (error) return { error: error.message };
  revalidatePath("/admin/verifications");
  return { success: true };
}
