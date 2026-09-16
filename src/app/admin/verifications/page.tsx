import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { VerificationsWorkspace } from "./verifications-workspace";

const PAGE_SIZE = 20;

export type VerificationTab = "all" | "submitted" | "under_review" | "verified" | "rejected" | "expired";
const TAB_TO_STATUSES: Record<Exclude<VerificationTab, "all">, string[]> = {
  submitted: ["submitted"],
  under_review: ["under_review"],
  verified: ["verified"],
  rejected: ["rejected"],
  expired: ["expired"],
};

export interface VerificationRow extends Provider {
  provider_categories: { category_id: string; is_cleared: boolean; categories: { name: string } | null }[];
  locations: { town: string; county: string } | null;
  profiles: { full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null } | null;
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; category?: string; location?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab = (params.tab as VerificationTab) ?? "all";
  const q = params.q?.trim() ?? "";
  const categoryId = params.category ?? "";
  const locationId = params.location ?? "";
  const sortAsc = params.sort === "oldest";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Compact stats row — real counts, one cheap head-only query each. Only
  // the states that actually exist in verification_status (see
  // migrations' enum) — no fabricated "Resubmitted"/"Flagged" states.
  const [
    { count: allCount },
    { count: submittedCount },
    { count: underReviewCount },
    { count: verifiedCount },
    { count: rejectedCount },
    { count: expiredCount },
  ] = await Promise.all([
    supabase.from("providers").select("id", { count: "exact", head: true }),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "submitted"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "under_review"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "rejected"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "expired"),
  ]);

  const { data: categories } = await supabase.from("categories").select("id, name").eq("is_active", true).order("name");
  const { data: locations } = await supabase.from("locations").select("id, town, county").order("town");

  const selectCols = "*, provider_categories(category_id, is_cleared, categories(name)), locations:base_location_id(town, county), profiles:user_id(full_name, email, phone, avatar_url)";

  let query = categoryId
    ? supabase.from("providers").select(selectCols.replace("provider_categories(", "provider_categories!inner("), { count: "exact" }).eq("provider_categories.category_id", categoryId)
    : supabase.from("providers").select(selectCols, { count: "exact" });

  if (tab !== "all") query = query.in("verification_status", TAB_TO_STATUSES[tab]);
  if (locationId) query = query.eq("base_location_id", locationId);
  if (q) query = query.or(`display_name.ilike.%${q}%,headline.ilike.%${q}%`);

  query = query.order("created_at", { ascending: sortAsc }).range(from, to);

  const { data: providers, count, error } = await query.returns<VerificationRow[]>();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Verifications</h1>
          <p className="text-sm text-[var(--muted)]">Review and approve provider applications</p>
        </div>
      </div>

      {error && <ErrorNotice message="We couldn't load the verification queue. Please refresh — this is not the same as there being nothing to review." />}

      {!error && (
        <VerificationsWorkspace
          providers={providers ?? []}
          categories={categories ?? []}
          locations={locations ?? []}
          stats={{
            all: allCount ?? 0,
            submitted: submittedCount ?? 0,
            underReview: underReviewCount ?? 0,
            verified: verifiedCount ?? 0,
            rejected: rejectedCount ?? 0,
            expired: expiredCount ?? 0,
          }}
          tab={tab}
          q={q}
          categoryId={categoryId}
          locationId={locationId}
          sortAsc={sortAsc}
          page={page}
          totalPages={totalPages}
          totalCount={count ?? 0}
        />
      )}
    </div>
  );
}
