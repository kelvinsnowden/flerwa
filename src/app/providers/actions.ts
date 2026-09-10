"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveProvider(providerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS ("saved providers own") is what actually enforces that a row can
  // only be inserted with customer_id = auth.uid() — this isn't just a UI
  // convenience.
  const { error } = await supabase
    .from("saved_providers")
    .upsert(
      { customer_id: user.id, provider_id: providerId },
      { onConflict: "customer_id,provider_id", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };

  revalidatePath("/account/saved");
  return { success: true as const };
}

export async function unsaveProvider(providerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("saved_providers")
    .delete()
    .eq("customer_id", user.id)
    .eq("provider_id", providerId);
  if (error) return { error: error.message };

  revalidatePath("/account/saved");
  return { success: true as const };
}
