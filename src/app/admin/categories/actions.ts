"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCategoryActive(categoryId: string, active: boolean, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_set_category_active", {
    p_category_id: categoryId,
    p_active: active,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true };
}
