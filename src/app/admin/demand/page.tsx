import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

const ROLLUP_WINDOW_DAYS = 30;
const TREND_DAYS_SHOWN = 14;

/**
 * MARKETPLACE-001 Phase 2/7 — admin demand intelligence.
 *
 * Supply-vs-demand section is built entirely from EXISTING real data
 * (service_requests, quotes, service_transactions, providers,
 * provider_categories) — no migration needed for that part. The
 * search-side section reads from demand_rollup_daily
 * (supabase/migrations/20260915151912_marketplace_001_demand_rollup_job.sql,
 * applied 2026-09-15) — see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md.
 * The rollup only has data once the daily cron
 * (src/app/api/cron/demand-rollup/route.ts, 06:00 UTC) has actually
 * run at least once; an empty result here means "no rollup yet",
 * shown honestly, never fabricated.
 */
export default async function AdminDemandPage() {
  const supabase = await createClient();

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - ROLLUP_WINDOW_DAYS);
  const windowStartDay = windowStart.toISOString().slice(0, 10);

  const [
    { data: categories },
    { data: requests },
    { data: quotes },
    { data: transactions },
    { data: providerCategories },
    { data: providers },
    { data: rollup },
  ] = await Promise.all([
    supabase.from("categories").select("id, name, slug").eq("is_active", true).returns<Pick<Category, "id" | "name" | "slug">[]>(),
    supabase.from("service_requests").select("id, category_id, state, expires_at, customer_id, created_at"),
    supabase.from("quotes").select("id, request_id, provider_id, state"),
    supabase.from("service_transactions").select("id, category_id, state, customer_id, provider_id, requested_at"),
    supabase.from("provider_categories").select("provider_id, category_id, is_cleared"),
    supabase.from("providers").select("id, is_published, verification_status, is_accepting_work, is_suspended, is_test_fixture"),
    supabase
      .from("demand_rollup_daily")
      .select("day, category_id, location_id, search_count, no_result_count, booking_count")
      .gte("day", windowStartDay)
      .order("day", { ascending: false }),
  ]);

  const providerById = new Map((providers ?? []).map((p) => [p.id, p]));
  const requestById = new Map((requests ?? []).map((r) => [r.id, r]));

  // demand_rollup_daily aggregation, summed across the window. Grouped
  // by category_id — location_id is ignored here (no search surface
  // captures a location yet, so it's always null today; see
  // MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md). A null category_id is a
  // real, common bucket (e.g. a home search with no category filter, or
  // provider_profile_viewed, which never has a category) — kept as its
  // own "General" row rather than dropped or merged into a category.
  const rollupByCategory = new Map<string | null, { searches: number; noResults: number; bookings: number }>();
  const rollupByDay = new Map<string, { searches: number; noResults: number; bookings: number }>();
  for (const r of rollup ?? []) {
    const catKey = r.category_id;
    const catAgg = rollupByCategory.get(catKey) ?? { searches: 0, noResults: 0, bookings: 0 };
    catAgg.searches += r.search_count;
    catAgg.noResults += r.no_result_count;
    catAgg.bookings += r.booking_count;
    rollupByCategory.set(catKey, catAgg);

    const dayAgg = rollupByDay.get(r.day) ?? { searches: 0, noResults: 0, bookings: 0 };
    dayAgg.searches += r.search_count;
    dayAgg.noResults += r.no_result_count;
    dayAgg.bookings += r.booking_count;
    rollupByDay.set(r.day, dayAgg);
  }
  const totalSearches30d = [...rollupByCategory.values()].reduce((s, v) => s + v.searches, 0);
  const totalNoResults30d = [...rollupByCategory.values()].reduce((s, v) => s + v.noResults, 0);
  const noResultRate30d = totalSearches30d > 0 ? totalNoResults30d / totalSearches30d : null;
  const generalRollup = rollupByCategory.get(null);
  const dayTrend = [...rollupByDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, TREND_DAYS_SHOWN);

  type Row = {
    category: Pick<Category, "id" | "name" | "slug">;
    providersWithCategory: number;
    providersEligible: number;
    openRequests: number;
    unmetRequests: number;
    quotesSubmitted: number;
    quotesAccepted: number;
    bookings: number;
    repeatCustomers: number;
    distinctCustomers: number;
    searches30d: number;
    noResultRate30d: number | null;
  };

  const rows: Row[] = (categories ?? []).map((category) => {
    const catProviderIds = new Set(
      (providerCategories ?? []).filter((pc) => pc.category_id === category.id && pc.is_cleared).map((pc) => pc.provider_id)
    );
    const providersWithCategory = catProviderIds.size;
    const providersEligible = [...catProviderIds].filter((pid) => {
      const p = providerById.get(pid);
      return p && p.is_published && p.verification_status === "verified" && p.is_accepting_work && !p.is_suspended && !p.is_test_fixture;
    }).length;

    const catRequests = (requests ?? []).filter((r) => r.category_id === category.id);
    const openRequests = catRequests.filter((r) => r.state === "open").length;
    const requestIdsWithQuotes = new Set((quotes ?? []).map((q) => q.request_id));
    const unmetRequests = catRequests.filter(
      (r) => r.state === "open" && new Date(r.expires_at) < new Date() && !requestIdsWithQuotes.has(r.id)
    ).length;

    const catQuotes = (quotes ?? []).filter((q) => requestById.get(q.request_id)?.category_id === category.id);
    const quotesSubmitted = catQuotes.length;
    const quotesAccepted = catQuotes.filter((q) => q.state === "accepted").length;

    const catTransactions = (transactions ?? []).filter((t) => t.category_id === category.id);
    const bookings = catTransactions.length;
    const customerCounts = new Map<string, number>();
    for (const t of catTransactions) {
      customerCounts.set(t.customer_id, (customerCounts.get(t.customer_id) ?? 0) + 1);
    }
    const distinctCustomers = customerCounts.size;
    const repeatCustomers = [...customerCounts.values()].filter((n) => n > 1).length;

    const catRollup = rollupByCategory.get(category.id);
    const searches30d = catRollup?.searches ?? 0;
    const noResultRate30d = catRollup && catRollup.searches > 0 ? catRollup.noResults / catRollup.searches : null;

    return {
      category,
      providersWithCategory,
      providersEligible,
      openRequests,
      unmetRequests,
      quotesSubmitted,
      quotesAccepted,
      bookings,
      repeatCustomers,
      distinctCustomers,
      searches30d,
      noResultRate30d,
    };
  });

  const totalOpenRequests = rows.reduce((s, r) => s + r.openRequests, 0);
  const totalUnmet = rows.reduce((s, r) => s + r.unmetRequests, 0);
  const totalBookings = rows.reduce((s, r) => s + r.bookings, 0);
  const zeroSupplyCategories = rows.filter((r) => r.providersEligible === 0 && (r.openRequests > 0 || r.bookings > 0));

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Demand intelligence</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Search demand from the daily <code className="text-xs">demand_rollup_daily</code> aggregation,
        plus supply-vs-demand by category from existing booking/request data. See the note at the bottom
        for what&apos;s still not shown here.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Open task requests" value={totalOpenRequests} />
        <Stat label="Unmet (expired, 0 quotes)" value={totalUnmet} urgent={totalUnmet > 0} />
        <Stat label="Bookings (all-time)" value={totalBookings} />
      </div>

      <h2 className="font-semibold mb-2">Search demand (last {ROLLUP_WINDOW_DAYS} days)</h2>
      {totalSearches30d === 0 ? (
        <p className="text-sm text-[var(--muted)] mb-6">
          No rollup data yet — the daily aggregation job (
          <code className="text-xs">/api/cron/demand-rollup</code>, 06:00 UTC) hasn&apos;t run since
          real search events started flowing, or there simply hasn&apos;t been any search activity in
          this window. Check back after the next run.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Stat label="Total searches" value={totalSearches30d} />
            <Stat label="No-result searches" value={totalNoResults30d} urgent={totalNoResults30d > 0} />
            <Stat
              label="No-result rate"
              value={noResultRate30d === null ? "—" : `${(noResultRate30d * 100).toFixed(0)}%`}
              urgent={(noResultRate30d ?? 0) > 0.3}
            />
          </div>
          {generalRollup && generalRollup.searches > 0 && (
            <p className="text-sm text-[var(--muted)] mb-4">
              {generalRollup.searches} of those searches had no category selected (general home-page
              search) — {generalRollup.noResults} produced no results.
            </p>
          )}
          <div className="card overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)] border-b">
                  <th className="p-3">Day (UTC)</th>
                  <th className="p-3">Searches</th>
                  <th className="p-3">No results</th>
                  <th className="p-3">Bookings created</th>
                </tr>
              </thead>
              <tbody>
                {dayTrend.map(([day, agg]) => (
                  <tr key={day} className="border-b last:border-0">
                    <td className="p-3 font-medium">{day}</td>
                    <td className="p-3">{agg.searches}</td>
                    <td className="p-3">{agg.noResults > 0 ? <span className="text-[var(--danger)] font-semibold">{agg.noResults}</span> : 0}</td>
                    <td className="p-3">{agg.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {zeroSupplyCategories.length > 0 && (
        <div className="card p-4 mb-6 border-l-4" style={{ borderLeftColor: "var(--danger)" }}>
          <p className="text-sm font-semibold mb-1">Categories with real demand but zero eligible providers</p>
          <ul className="text-sm text-[var(--muted)] list-disc list-inside">
            {zeroSupplyCategories.map((r) => (
              <li key={r.category.id}>
                {r.category.name} — {r.openRequests} open request{r.openRequests === 1 ? "" : "s"}, {r.bookings} booking
                {r.bookings === 1 ? "" : "s"} all-time, 0 published+verified+accepting providers
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--muted)] border-b">
              <th className="p-3">Category</th>
              <th className="p-3">Providers (eligible / cleared)</th>
              <th className="p-3">Open requests</th>
              <th className="p-3">Unmet</th>
              <th className="p-3">Quotes (accepted / sent)</th>
              <th className="p-3">Bookings</th>
              <th className="p-3">Repeat customers</th>
              <th className="p-3">Searches ({ROLLUP_WINDOW_DAYS}d)</th>
              <th className="p-3">No-result rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category.id} className="border-b last:border-0">
                <td className="p-3 font-medium">
                  <Link href={`/admin/categories`} className="hover:underline">
                    {r.category.name}
                  </Link>
                </td>
                <td className="p-3">
                  <span className={r.providersEligible === 0 ? "text-[var(--danger)] font-semibold" : ""}>
                    {r.providersEligible}
                  </span>{" "}
                  / {r.providersWithCategory}
                </td>
                <td className="p-3">{r.openRequests}</td>
                <td className="p-3">{r.unmetRequests > 0 ? <span className="text-[var(--danger)] font-semibold">{r.unmetRequests}</span> : 0}</td>
                <td className="p-3">
                  {r.quotesAccepted} / {r.quotesSubmitted}
                </td>
                <td className="p-3">{r.bookings}</td>
                <td className="p-3">
                  {r.repeatCustomers} / {r.distinctCustomers || 0}
                </td>
                <td className="p-3">{r.searches30d}</td>
                <td className="p-3">
                  {r.noResultRate30d === null ? (
                    "—"
                  ) : (
                    <span className={r.noResultRate30d > 0.3 ? "text-[var(--danger)] font-semibold" : ""}>
                      {(r.noResultRate30d * 100).toFixed(0)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4 mt-6 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--foreground)] mb-1">What&apos;s still not shown here</p>
        <p>
          The sections above now read real data from{" "}
          <code className="text-xs">demand_rollup_daily</code> (search volume, no-result rate, by day
          and by category). Still missing: the actual most-searched <em>terms</em> (raw free-text search
          strings live only in <code className="text-xs">demand_events</code>, admin-only, not rolled up
          — a deliberate privacy choice, see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md), geographic demand
          (no search surface captures a location yet), and search-to-booking conversion (needs
          correlation-id-based funnel analysis, not built). See
          MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md for the full design and what each of these needs.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, urgent }: { label: string; value: number | string; urgent?: boolean }) {
  return (
    <div className="card p-4">
      <p className={`text-2xl font-bold ${urgent ? "text-[var(--danger)]" : ""}`}>{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
    </div>
  );
}
