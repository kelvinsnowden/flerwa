"use server";

import { createClient } from "@/lib/supabase/server";

export type ReportTargetType = "message" | "review" | "provider_profile" | "customer_profile";

export async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  description: string
) {
  if (!reason.trim()) return { error: "Please choose a reason." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in to report this." };

  // RLS (can_report_target, see supabase/migrations/20260915110000_tsf007_report_flag_mechanism.sql)
  // re-checks visibility server-side — this insert can't succeed for
  // content the reporter couldn't actually see.
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason: reason.trim(),
    description: description.trim() || null,
  });
  if (error) return { error: error.message };
  return { success: true };
}
