"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateSocialUrl, type SocialPlatform } from "@/lib/social-embed";

async function getOwnProvider(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." as const };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "You don't have a professional profile yet." as const };

  return { providerId: provider.id as string };
}

export async function addSocialHighlight(platform: SocialPlatform, postUrl: string, title: string, rightsConfirmed: boolean) {
  const supabase = await createClient();
  const owner = await getOwnProvider(supabase);
  if ("error" in owner) return { success: false as const, error: owner.error };

  if (!rightsConfirmed) {
    return { success: false as const, error: "You must confirm this is your own content (or you have permission to share it) before it can be added." };
  }

  // The real security boundary — never trust a client-validated URL.
  const validation = validateSocialUrl(platform, postUrl);
  if (!validation.ok) return { success: false as const, error: validation.error ?? "That link doesn't look right." };

  const { count } = await supabase
    .from("provider_social_highlights")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", owner.providerId);

  const { data, error } = await supabase
    .from("provider_social_highlights")
    .insert({
      provider_id: owner.providerId,
      platform,
      post_url: validation.normalizedUrl,
      title: title.trim() || null,
      sort_order: count ?? 0,
      rights_confirmed: true,
    })
    .select("id")
    .single();
  if (error) return { success: false as const, error: error.message };

  revalidatePath("/provider/social");
  revalidatePath(`/provider/${owner.providerId}`, "layout");
  return { success: true as const, id: data.id as string };
}

export async function updateSocialHighlight(id: string, title: string, isPublic: boolean) {
  const supabase = await createClient();
  const owner = await getOwnProvider(supabase);
  if ("error" in owner) return { error: owner.error };

  // RLS ("social highlights self write") scopes this to the caller's
  // own rows — moderation (is_hidden) is deliberately not settable here.
  const { error } = await supabase
    .from("provider_social_highlights")
    .update({ title: title.trim() || null, is_public: isPublic })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/provider/social");
  return { success: true as const };
}

export async function removeSocialHighlight(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { error } = await supabase.from("provider_social_highlights").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/provider/social");
  return { success: true as const };
}
