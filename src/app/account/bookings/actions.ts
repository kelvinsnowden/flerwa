"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cancelRecurringSeries(seriesId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_cancel_recurring_series", { p_series_id: seriesId });
  if (error) return { error: error.message };
  revalidatePath("/account/bookings");
  return { success: true as const };
}
