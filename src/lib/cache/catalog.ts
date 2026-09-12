import "server-only";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Category, Service } from "@/lib/types";

/**
 * Phase 6 (MARKETPLACE_SCALE_READINESS_AUDIT.md /
 * MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md): narrow, deliberate caching for
 * the catalog reads that are (a) identical for every visitor and (b)
 * re-fetched from Postgres on essentially every home page load — the
 * highest-traffic route in the app. Deliberately NOT full-page caching and
 * NOT anything auth-sensitive: only `categories` and `services` rows
 * filtered to `is_active = true`, which is public, non-personalized data
 * that RLS already lets `anon` read (see the "categories readable" /
 * "services readable" policies).
 *
 * Uses a plain anon-key client with no cookie access, on purpose:
 * `unstable_cache`'s callback is shared across requests/users, so it must
 * never depend on next/headers' cookies()/headers() (the per-request
 * client in src/lib/supabase/server.ts does, and Next disallows calling
 * those inside a cached function). This client is exactly as privileged
 * as an anonymous visitor already is against these two tables — nothing
 * is bypassed.
 *
 * A 60s revalidate window means an admin's edit to a category or service
 * can take up to 60s to show up on the home page — an explicit, accepted
 * tradeoff for this launch's traffic level, not a silent change: nothing
 * else in the app (booking, pricing, availability) reads through this
 * cache, and rpc_book_service always resolves price fresh, server-side,
 * regardless of what the home page happened to display.
 */

function catalogAnonClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const CATALOG_REVALIDATE_SECONDS = 60;

export const getActiveCategories = unstable_cache(
  async (): Promise<{ data: Category[] | null; error: string | null }> => {
    const { data, error } = await catalogAnonClient()
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .returns<Category[]>();
    return { data, error: error?.message ?? null };
  },
  ["catalog-active-categories"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog:categories"] }
);

export const getRecommendedServices = unstable_cache(
  async (slugs: readonly string[]): Promise<{ data: Service[] | null; error: string | null }> => {
    const { data, error } = await catalogAnonClient()
      .from("services")
      .select("*")
      .eq("is_active", true)
      .in("slug", slugs as string[])
      .returns<Service[]>();
    return { data, error: error?.message ?? null };
  },
  ["catalog-recommended-services"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog:services"] }
);
