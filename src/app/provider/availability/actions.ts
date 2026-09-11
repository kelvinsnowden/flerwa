"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Weekly hours are replaced wholesale (simplest correct semantics for "this
// is my schedule", same pattern as provider_service_areas in the seller
// wizard) — RLS ("availability rules self write") already scopes both the
// delete and the insert to the caller's own provider_id.
export async function saveAvailabilityRules(
  rules: { day_of_week: number; start_time: string; end_time: string }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "You don't have a professional profile yet." };

  for (const r of rules) {
    if (r.end_time <= r.start_time) return { error: "Closing time must be after opening time." };
  }

  const { error: delError } = await supabase
    .from("provider_availability_rules")
    .delete()
    .eq("provider_id", provider.id);
  if (delError) return { error: delError.message };

  if (rules.length > 0) {
    const { error: insError } = await supabase
      .from("provider_availability_rules")
      .insert(rules.map((r) => ({ provider_id: provider.id, ...r })));
    if (insError) return { error: insError.message };
  }

  revalidatePath("/provider/availability");
  return { success: true as const };
}

export async function addBlockedSlot(startsAt: string, endsAt: string, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "You don't have a professional profile yet." };

  if (!startsAt || !endsAt) return { error: "Choose a start and end time." };
  if (endsAt <= startsAt) return { error: "End time must be after start time." };

  const { error } = await supabase
    .from("provider_blocked_slots")
    .insert({ provider_id: provider.id, starts_at: startsAt, ends_at: endsAt, reason: reason || null });
  if (error) return { error: error.message };

  revalidatePath("/provider/availability");
  return { success: true as const };
}

export async function removeBlockedSlot(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  // RLS scopes this delete to blocked slots owned by the caller's own
  // provider — a stray id belonging to someone else silently deletes
  // nothing rather than erroring, which is fine here.
  const { error } = await supabase.from("provider_blocked_slots").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/provider/availability");
  return { success: true as const };
}
