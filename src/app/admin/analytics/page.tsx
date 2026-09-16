import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { SimpleBarChart } from "@/components/admin/simple-bar-chart";
import { ErrorNotice } from "@/components/error-notice";
import type { TxnState } from "@/lib/types";

/**
 * There was no marketplace-health dashboard before this — /admin (Overview)
 * is an ops-health at-a-glance (pending queues, cron status), not a
 * date-ranged analytics view. Every metric below is computed directly from
 * real tables for the selected range; none is estimated or fabricated.
 * "Platform revenue" comes from ledger_entries (account_type=
 * 'platform_revenue'), the same real double-entry ledger the Ledger page
 * reads — not from services.base_price_minor or any other proxy.
 *
 * Scale note: each query below is bounded by the selected date range, not
 * the whole table — but a very wide range (e.g. "all time" on a mature
 * marketplace) would still pull every matching row to group client-side,
 * since there's no rollup table for booking/revenue trends yet (compare
 * demand_rollup_daily, which exists for demand events specifically). Capped
 * defensively at ANALYTICS_ROW_CAP with a visible warning rather than
 * silently truncating.
 */
const ANALYTICS_ROW_CAP = 5000;
const COMPLETED_STATES: TxnState[] = ["settled", "reviewed", "closed"];
const CANCELLED_STATES: TxnState[] = ["cancelled_by_customer", "cancelled_by_provider", "expired"];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const from = params.from || isoDate(defaultFrom);
  const to = params.to || isoDate(today);
  const fromIso = `${from}T00:00:00Z`;
  const toIso = `${to}T23:59:59Z`;

  const supabase = await createClient();

  const [txnRes, ledgerRes, newProvidersRes, newCustomersRes, activeProvidersRes] = await Promise.all([
    supabase
      .from("service_transactions")
      .select("id, state, customer_id, provider_id, service_id, service_amount_minor, requested_at, services(name)")
      .gte("requested_at", fromIso)
      .lte("requested_at", toIso)
      .limit(ANALYTICS_ROW_CAP)
      .returns<
        {
          id: string;
          state: TxnState;
          customer_id: string;
          provider_id: string | null;
          service_id: string | null;
          service_amount_minor: number;
          requested_at: string;
          services: { name: string } | null;
        }[]
      >(),
    supabase
      .from("ledger_entries")
      .select("account_type, direction, amount_minor, created_at")
      .in("account_type", ["platform_revenue", "funds_held"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .limit(ANALYTICS_ROW_CAP),
    supabase.from("providers").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "verified").eq("is_suspended", false),
  ]);

  if (txnRes.error || ledgerRes.error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Analytics</h1>
        <ErrorNotice message="We couldn't load analytics data. Please refresh." />
      </div>
    );
  }

  const txns = txnRes.data ?? [];
  const ledger = ledgerRes.data ?? [];

  const totalBookings = txns.length;
  const completedBookings = txns.filter((t) => COMPLETED_STATES.includes(t.state)).length;
  const cancelledBookings = txns.filter((t) => CANCELLED_STATES.includes(t.state)).length;
  const disputedBookings = txns.filter((t) => t.state === "disputed").length;

  // funds_held is credited when a customer funds a booking (money enters
  // escrow) and debited when it's released on approval (money leaves
  // escrow to the provider/platform) — see 20260908134754_transaction_
  // functions.sql. "Payment volume" is gross customer payments collected,
  // i.e. the credit side.
  const paymentVolumeMinor = ledger.filter((l) => l.account_type === "funds_held" && l.direction === "credit").reduce((s, l) => s + l.amount_minor, 0);
  const platformRevenueMinor = ledger.filter((l) => l.account_type === "platform_revenue" && l.direction === "credit").reduce((s, l) => s + l.amount_minor, 0);

  const activeCustomerIds = new Set(txns.map((t) => t.customer_id));
  const activeProviderIdsInRange = new Set(txns.filter((t) => t.provider_id).map((t) => t.provider_id));

  const serviceCounts = new Map<string, { name: string; count: number }>();
  for (const t of txns) {
    if (!t.service_id) continue;
    const entry = serviceCounts.get(t.service_id) ?? { name: t.services?.name ?? "Unknown", count: 0 };
    entry.count += 1;
    serviceCounts.set(t.service_id, entry);
  }
  const topServices = Array.from(serviceCounts.values()).sort((a, b) => b.count - a.count).slice(0, 8);

  // Day-by-day booking trend. Capped at 60 bars (a ~2 month range) so the
  // chart stays legible — a wider range still computes correct totals
  // above, just doesn't try to render one bar per day for a year.
  const dayCounts = new Map<string, number>();
  for (const t of txns) {
    const k = dayKey(t.requested_at);
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }
  const sortedDays = Array.from(dayCounts.keys()).sort();
  const trendData = sortedDays.slice(-60).map((d) => ({ label: d.slice(5), value: dayCounts.get(d) ?? 0 }));

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Analytics</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2 mb-6 text-sm">
        <label className="text-xs font-medium text-[var(--muted)]">
          From
          <input type="date" name="from" defaultValue={from} className="!min-h-0 !py-2 text-sm block" />
        </label>
        <label className="text-xs font-medium text-[var(--muted)]">
          To
          <input type="date" name="to" defaultValue={to} className="!min-h-0 !py-2 text-sm block" />
        </label>
        <button type="submit" className="btn-primary text-sm">
          Apply
        </button>
        <div className="flex gap-1.5 ml-2">
          {[7, 30, 90].map((days) => {
            const f = new Date(today);
            f.setDate(f.getDate() - (days - 1));
            return (
              <Link key={days} href={`/admin/analytics?from=${isoDate(f)}&to=${isoDate(today)}`} className="pill-tab">
                {days}d
              </Link>
            );
          })}
        </div>
      </form>

      {txns.length >= ANALYTICS_ROW_CAP && (
        <p className="text-xs text-[var(--warn)] mb-4">
          This range has at least {ANALYTICS_ROW_CAP} bookings — totals below are truncated. Narrow the date range for accurate numbers.
        </p>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Stat label="Total bookings" value={totalBookings} href="/admin/transactions" />
        <Stat label="Completed" value={completedBookings} href="/admin/transactions?group=completed" />
        <Stat label="Cancelled" value={cancelledBookings} href="/admin/transactions?group=cancelled" />
        <Stat label="Disputed" value={disputedBookings} href="/admin/disputes" />
        <Stat label="Payment volume" value={formatMoney(paymentVolumeMinor)} href="/admin/payments" />
        <Stat label="Platform revenue" value={formatMoney(platformRevenueMinor)} href="/admin/ledger?account_type=platform_revenue" />
        <Stat label="New providers" value={newProvidersRes.count ?? 0} href="/admin/providers" />
        <Stat label="New customers" value={newCustomersRes.count ?? 0} href="/admin/customers" />
      </div>

      <div className="grid gap-3 grid-cols-2 mb-6">
        <div className="stat-tile text-left">
          <p className="text-xs text-[var(--muted)]">Active providers (verified, not suspended, all-time)</p>
          <p className="text-lg font-bold">{activeProvidersRes.count ?? 0}</p>
        </div>
        <div className="stat-tile text-left">
          <p className="text-xs text-[var(--muted)]">Providers/customers with a booking in this range</p>
          <p className="text-lg font-bold">
            {activeProviderIdsInRange.size} providers · {activeCustomerIds.size} customers
          </p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <p className="text-sm font-semibold mb-1">Booking trend</p>
        <p className="text-xs text-[var(--muted)] mb-3">Bookings requested per day, by requested date (showing up to the most recent 60 days of the range).</p>
        {!trendData.length ? (
          <p className="text-sm text-[var(--muted)]">No bookings in this range.</p>
        ) : (
          <SimpleBarChart data={trendData} />
        )}
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold mb-1">Most popular services</p>
        <p className="text-xs text-[var(--muted)] mb-3">By booking count in this range.</p>
        {!topServices.length ? (
          <p className="text-sm text-[var(--muted)]">No bookings in this range.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Bookings</th>
              </tr>
            </thead>
            <tbody>
              {topServices.map((s) => (
                <tr key={s.name}>
                  <td className="text-sm">{s.name}</td>
                  <td className="text-sm font-medium">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="stat-tile block hover:opacity-80">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </Link>
  );
}
