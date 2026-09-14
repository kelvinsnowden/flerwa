"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setReviewHidden(reviewId: string, hidden: boolean, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_set_review_hidden", {
    p_review_id: reviewId,
    p_hidden: hidden,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/reviews");
  return { success: true };
}
