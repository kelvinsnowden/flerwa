"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PortfolioItemFields {
  tag: string;
  reachLabel: string;
  videoUrl: string;
  projectType: string;
  clientName: string;
  isPublic: boolean;
  isFeatured: boolean;
}

/**
 * @param thumbnailUrl A photo — always required (existing invariant),
 *   including for native video, where it's a frame captured client-side
 *   from the uploaded clip (see extractVideoThumbnail in
 *   portfolio-manager.tsx) and uploaded alongside it.
 * @param nativeVideoUrl Set only when adding a native, platform-hosted
 *   video — the uploaded video file's own storage URL.
 */
export async function addPortfolioItem(
  thumbnailUrl: string,
  caption: string,
  options: { rightsConfirmed: boolean; nativeVideoUrl?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Please log in first." };

  if (!options.rightsConfirmed) {
    return { success: false as const, error: "You must confirm you own the rights to this content before it can be published." };
  }

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { success: false as const, error: "You don't have a professional profile yet." };

  const { count } = await supabase
    .from("provider_portfolio_items")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", provider.id);

  const { data, error } = await supabase
    .from("provider_portfolio_items")
    .insert({
      provider_id: provider.id,
      photo_url: thumbnailUrl,
      caption: caption || null,
      sort_order: count ?? 0,
      media_type: options.nativeVideoUrl ? "video" : "image",
      video_url: options.nativeVideoUrl ?? null,
      video_source: options.nativeVideoUrl ? "native" : null,
      rights_confirmed: true,
    })
    .select("id")
    .single();
  if (error) return { success: false as const, error: error.message };

  revalidatePath("/provider/portfolio");
  revalidatePath(`/provider/${provider.id}`, "layout");
  return { success: true as const, id: data.id as string };
}

export async function removePortfolioItem(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  // RLS ("portfolio items self write") scopes this delete to items owned
  // by the caller's own provider — a stray id belonging to someone else
  // silently deletes nothing rather than erroring.
  const { error } = await supabase.from("provider_portfolio_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/provider/portfolio");
  return { success: true as const };
}

// tag/reach_label/project_type/client_name are all the provider's own
// free text (never platform-computed — there's no real analytics
// integration). External video_url, when set, is an off-platform link
// (e.g. a TikTok/Instagram/YouTube post) — this remains distinct from a
// NATIVE video the provider uploaded to our own storage (video_source).
// moderation (is_hidden) is deliberately NOT settable here — RLS/the
// guard trigger enforce that only an admin can change it, matching
// trg_guard_provider_trust_fields's established pattern.
export async function updatePortfolioItem(id: string, fields: PortfolioItemFields) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const videoUrl = fields.videoUrl.trim();
  if (videoUrl && !/^https:\/\//i.test(videoUrl)) {
    return { error: "Video link must be a full https:// URL." };
  }

  const { error } = await supabase
    .from("provider_portfolio_items")
    .update({
      tag: fields.tag.trim() || null,
      reach_label: fields.reachLabel.trim() || null,
      video_url: videoUrl || null,
      media_type: videoUrl ? "video" : "image",
      video_source: videoUrl ? "external" : null,
      project_type: fields.projectType.trim() || null,
      client_name: fields.clientName.trim() || null,
      is_public: fields.isPublic,
      is_featured: fields.isFeatured,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/provider/portfolio");
  return { success: true as const };
}
