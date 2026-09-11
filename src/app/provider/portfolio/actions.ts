"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addPortfolioItem(photoUrl: string, caption: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "You don't have a professional profile yet." };

  const { count } = await supabase
    .from("provider_portfolio_items")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", provider.id);

  const { error } = await supabase.from("provider_portfolio_items").insert({
    provider_id: provider.id,
    photo_url: photoUrl,
    caption: caption || null,
    sort_order: count ?? 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/provider/portfolio");
  revalidatePath(`/provider/${provider.id}`, "layout");
  return { success: true as const };
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
