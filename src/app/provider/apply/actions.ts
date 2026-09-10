"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export async function applyAsProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "");

  if (!displayName) return { error: "Your display name is required." };

  // is_published defaults to false and verification_status defaults to
  // 'pending' at the database level — this insert cannot make a provider
  // live. Only rpc_set_verification_status (admin-only) can. See
  // supabase/migrations/20260908134754_transaction_functions.sql.
  const { error } = await supabase.from("providers").insert({
    user_id: user.id,
    slug: slugify(displayName),
    display_name: displayName,
    headline,
    bio,
    base_location_id: locationId || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "You've already applied as a Pro." };
    return { error: error.message };
  }

  redirect("/provider");
}
