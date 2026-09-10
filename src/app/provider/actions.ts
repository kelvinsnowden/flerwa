"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_HOST = "famdxoardiibonghxepl.supabase.co";
const AVATAR_PREFIX = `https://${ALLOWED_HOST}/storage/v1/object/public/avatars/`;

export async function updateAvatar(publicUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // The client already uploaded to a path scoped to its own auth.uid() by
  // storage RLS ("avatars owner write") — this just double-checks the URL
  // actually points at that path before trusting it into profiles, rather
  // than accepting an arbitrary URL from the client.
  if (!publicUrl.startsWith(`${AVATAR_PREFIX}${user.id}/`)) {
    return { error: "Invalid photo URL." };
  }

  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/provider");
  return { success: true as const };
}
