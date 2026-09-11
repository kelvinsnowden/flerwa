"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addPortfolioItem(photoUrl: string, caption: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Please log in first." };

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
      photo_url: photoUrl,
      caption: caption || null,
      sort_order: count ?? 0,
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

// tag/reach_label are the provider's own free text (never platform-
// computed — there's no real analytics integration). video_url, when
// set, is an external link (e.g. a TikTok/Instagram/YouTube post) —
// this app doesn't host video itself, only the thumbnail photo already
// uploaded to the portfolio bucket.
export async function updatePortfolioItem(
  id: string,
  fields: { tag: string; reach_label: string; video_url: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const videoUrl = fields.video_url.trim();
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
    return { error: "Video link must be a full URL (starting with https://)." };
  }

  const { error } = await supabase
    .from("provider_portfolio_items")
    .update({
      tag: fields.tag.trim() || null,
      reach_label: fields.reach_label.trim() || null,
      video_url: videoUrl || null,
      media_type: videoUrl ? "video" : "image",
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/provider/portfolio");
  return { success: true as const };
}
