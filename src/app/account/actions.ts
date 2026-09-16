"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const USERNAME_FORMAT = /^[a-z][a-z0-9_]{2,29}$/;

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  const username = usernameRaw || null;

  if (username && !USERNAME_FORMAT.test(username)) {
    return {
      error: "Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and underscores.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, phone: phone || null, username })
    .eq("id", user.id);

  if (error) {
    // profiles_username_unique_idx — the friendliest signal Postgres
    // gives back for a duplicate is the constraint violation code, not
    // a message naming the column, so match on code rather than text.
    if (error.code === "23505") return { error: "That username is already taken." };
    return { error: error.message };
  }
  revalidatePath("/account");
  revalidatePath("/provider");
  return { success: true };
}
