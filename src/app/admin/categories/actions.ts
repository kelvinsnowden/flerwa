"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCategoryActive(categoryId: string, active: boolean, reason: string) {
  const supabase = await createClient();
  // GOV-P4 (dual control): proposes the pause/resume; a DIFFERENT ops or
  // trust & safety admin must approve it from /admin/approvals before
  // the category actually changes state.
  const { data, error } = await supabase.rpc("rpc_admin_set_category_active", {
    p_category_id: categoryId,
    p_active: active,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/approvals");
  return { success: true, pending: true as const, approvalId: data as string };
}
