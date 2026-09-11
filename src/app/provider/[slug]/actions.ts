"use server";

import { createClient } from "@/lib/supabase/server";

export async function getMonthAvailability(providerId: string, year: number, month: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_get_month_availability", {
    p_provider_id: providerId,
    p_year: year,
    p_month: month,
  });
  if (error) return { error: error.message };
  return { days: (data ?? []) as { day: string; status: "available" | "booked" | "unavailable" }[] };
}
