"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function retryPayout(payoutId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_admin_retry_payout", { p_payout_id: payoutId, p_reason: reason });
  if (error) return { error: error.message };
  revalidatePath("/admin/payouts");
  return { success: true as const };
}
