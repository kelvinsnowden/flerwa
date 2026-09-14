"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function decideAdminAction(approvalId: string, decision: "approve" | "reject") {
  const supabase = await createClient();
  // rpc_decide_admin_action is what actually enforces dual control — a
  // different admin than the proposer, with the matching domain
  // permission — this call is rejected by the database otherwise.
  const { error } = await supabase.rpc("rpc_decide_admin_action", {
    p_approval_id: approvalId,
    p_decision: decision,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/disputes");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/categories");
  return { success: true as const };
}
