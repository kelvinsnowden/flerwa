"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function resolveReport(reportId: string, state: "reviewing" | "actioned" | "dismissed", note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_resolve_report", {
    p_report_id: reportId,
    p_state: state,
    p_resolution_note: note || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/moderation");
  return { success: true };
}
