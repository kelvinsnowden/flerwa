import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

/**
 * MARKETPLACE-001 Phase 2/7 — admin demand intelligence.
 *
 * Built entirely from EXISTING real data (service_requests, quotes,
 * service_transactions, providers, provider_categories) — no new
 * migration required for this page. The search/browse-side metrics
 * (top searches, no-result rate, search-to-booking conversion) are
 * honestly shown as "not yet collected" rather than faked or omitted
 * without explanation — they depend on
 * migration_proposals/PROPOSED_marketplace_001_demand_events.sql,
 * which is NOT yet applied. See MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md.
 */
export default async function AdminDemandPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: requests }, { data: quotes }, { data: transactions }, { data: providerCategories }, { data: providers }] =
    await Promise.all([
      supabase.from("categories").select("id, name, slug").eq("is_active", true).returns<Pick<Category, "id" | "name" | "slug">[]>(),
      supabase.from("service_requests").select("id, category_id, state, expires_at, customer_id, created_at"),
      supabase.from("quotes").select("id, request_id, provider_id, state"),
      supabase.from("service_transactions").select("id, category_id, state, customer_id, provider_id, requested_at"),
      supabase.from("provider_categories").select("provider_id, category_id, is_cleared"),
      supabase.from("providers").select("id, is_published, verification_status, is_accepting_work, is_suspended, is_test_fixture"),
    ]);

  const providerById = new Map((providers ?? []).map((p) => [p.id, p]));
  const requestById = new Map((requests ?? []).map((r) => [r.id, r]));

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
        Supply-vs-demand by category, built from existing booking/request data — no search-event
        collection required for this part. See the note below for what search-side metrics still need.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Open task requests" value={totalOpenRequests} />
        <Stat label="Unmet (expired, 0 quotes)" value={totalUnmet} urgent={totalUnmet > 0} />
        <Stat label="Bookings (all-time)" value={totalBookings} />
      </div>

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4 mt-6 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--foreground)] mb-1">Search-side demand: collecting now, not yet shown here</p>
        <p>
          The <code className="text-xs">demand_events</code> table and{" "}
          <code className="text-xs">rpc_log_demand_event</code> are now live in production (applied
          2026-09-15) and <code className="text-xs">src/lib/demand-events.ts</code> is actively logging
          real search/view/booking events as customers and providers use the app. This page has not yet
          been extended to read and display that data (most-searched terms, search volume over time,
          no-result rate, search-to-booking conversion) — that's the next build step, once enough real
          volume has accumulated to be meaningful. See MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md for the
          full design.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div className="card p-4">
      <p className={`text-2xl font-bold ${urgent ? "text-[var(--danger)]" : ""}`}>{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
    </div>
  );
}
