import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { ErrorNotice } from "@/components/error-notice";
import { RetryButton } from "./retry-button";
import { Icon } from "@/components/ui/icon";
import type { Payout } from "@/lib/types";

/**
 * Audited against the live production database before writing this page:
 * the wallet-model payout schema (payouts, payout_providers,
 * providers.payout_phone, wallet_balance_minor — all of
 * migration_proposals/PROPOSED_automated_provider_payouts.sql) has NOT
 * been applied to production. The app code (this page, /provider/payouts,
 * the payout webhook/cron) already assumes it, but querying `payouts`
 * today returns a real Postgrest error, not real data.
 *
 * What IS live and real today: ledger_entries. `_release_transaction` /
 * `_release_milestone` already credit account_type='provider_payable' the
 * instant a customer approves a booking — that's the actual, current
 * source of truth for what a provider has earned. So this page is split
 * into two honestly-scoped sections:
 *   1. Provider wallets — computed live from ledger_entries (real, works
 *      today, does NOT yet subtract in-flight payout requests since
 *      those aren't trackable pre-migration — noted in the UI).
 *   2. Payout history — the actual withdrawal-request queue. Shows a
 *      clear "not live yet" notice instead of a raw query error when the
 *      payouts table doesn't exist, rather than pretending this section
 *      works.
 *
 * account_ref on a provider_payable ledger_entries row is the provider's
 * auth.uid() (== providers.user_id), not providers.id — confirmed via
 * wallet_balance_minor's own join in the proposed migration.
 *
 * ledger_entries has no per-account aggregate function in production
 * (nothing like demand_rollup_daily exists for this yet) so provider
 * totals are reduced client-side over the most recent 2000 provider_payable
 * entries — real at today's transaction volume, but would need a real
 * aggregate (view or RPC) before this scales past that.
 */
const LEDGER_SCAN_LIMIT = 2000;

const STATES: Payout["state"][] = ["pending", "processing", "paid", "failed"];
const STATE_LABEL: Record<Payout["state"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "badge-warn" },
  processing: { label: "Sending…", className: "badge-warn" },
  paid: { label: "Paid", className: "badge-trust" },
  failed: { label: "Needs attention", className: "badge-danger" },
};

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const PAGE_SIZE = 50;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("ledger_entries")
    .select("account_ref, direction, amount_minor, currency")
    .eq("account_type", "provider_payable")
    .order("created_at", { ascending: false })
    .limit(LEDGER_SCAN_LIMIT);

  const totalsByUser = new Map<string, { earned: number; debits: number; currency: string }>();
  for (const r of ledgerRows ?? []) {
    if (!r.account_ref) continue;
    const t = totalsByUser.get(r.account_ref) ?? { earned: 0, debits: 0, currency: r.currency };
    if (r.direction === "credit") t.earned += r.amount_minor;
    else t.debits += r.amount_minor;
    totalsByUser.set(r.account_ref, t);
  }

  const userIds = Array.from(totalsByUser.keys());
  const { data: providersByUser } = userIds.length
    ? await supabase.from("providers").select("id, user_id, display_name, profiles:user_id(avatar_url)").in("user_id", userIds).returns<
        { id: string; user_id: string; display_name: string; profiles: { avatar_url: string | null } | null }[]
      >()
    : { data: [] as { id: string; user_id: string; display_name: string; profiles: { avatar_url: string | null } | null }[] };

  const wallets = (providersByUser ?? [])
    .map((p) => {
      const t = totalsByUser.get(p.user_id)!;
      return { provider: p, earned: t.earned, debits: t.debits, available: t.earned - t.debits, currency: t.currency };
    })
    .sort((a, b) => b.available - a.available);

  let payoutsQuery = supabase
    .from("payouts")
    .select("*, providers(display_name, slug)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (params.state && STATES.includes(params.state as Payout["state"])) {
    payoutsQuery = payoutsQuery.eq("state", params.state);
  }
  const { data: payouts, count, error: payoutsError } = await payoutsQuery.returns<
    (Payout & { providers: { display_name: string; slug: string } | null })[]
  >();
  const payoutsTableMissing = !!payoutsError;

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Payouts</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        The wallet model: a provider&apos;s completed, approved bookings accumulate in their earnings balance
        automatically — they request a withdrawal against it whenever they want, rather than every booking
        triggering its own payout. See <Link href="/admin/ledger" className="underline">Ledger</Link> for the raw
        double-entry detail behind these totals.
      </p>

      {ledgerError && <ErrorNotice message="We couldn't load ledger data for provider wallets. Please refresh." />}

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Provider wallets</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Available balance = lifetime earnings credited to a provider, minus any clawback (dispute/cancellation)
          debits. This does not yet subtract in-flight withdrawal requests — that requires the payout tables below,
          which aren&apos;t live in production yet.
        </p>
        {!ledgerError && !wallets.length && (
          <div className="card p-6 text-center">
            <p className="text-sm font-medium">No provider has earned anything yet.</p>
          </div>
        )}
        {!!wallets.length && (
          <div className="card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Total earned</th>
                  <th>Clawback debits</th>
                  <th>Available balance</th>
                  <th>Pending withdrawal</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.provider.id}>
                    <td>
                      <Link href={`/admin/providers/${w.provider.id}`} className="flex items-center gap-2.5">
                        {w.provider.profiles?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.provider.profiles.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <span className="avatar h-7 w-7 text-xs flex-shrink-0">{initialsOf(w.provider.display_name)}</span>
                        )}
                        <span className="text-sm font-medium">{w.provider.display_name}</span>
                      </Link>
                    </td>
                    <td className="text-sm">{formatMoney(w.earned, w.currency)}</td>
                    <td className="text-sm text-[var(--muted)]">{w.debits > 0 ? `-${formatMoney(w.debits, w.currency)}` : "—"}</td>
                    <td className="text-sm font-semibold">{formatMoney(w.available, w.currency)}</td>
                    <td className="text-sm text-[var(--muted)]">{payoutsTableMissing ? "Not tracked yet" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(ledgerRows?.length ?? 0) >= LEDGER_SCAN_LIMIT && (
          <p className="text-xs text-[var(--warn)] mt-2">
            Scanned the most recent {LEDGER_SCAN_LIMIT} provider earnings entries — totals may be incomplete at
            this volume. Needs a real aggregate (view or RPC) to stay accurate past this point.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1">Payout history</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Every withdrawal a provider has requested from their earnings balance — automatic once a payout vendor is
          connected on <Link href="/admin/integrations" className="underline">Integrations</Link>, otherwise pay
          out by hand and use Retry to re-check once a vendor is active.
        </p>

        {payoutsTableMissing ? (
          <div className="card p-6 border-[var(--warn)] bg-[var(--warn-tint)]">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Icon name="alert-circle" size={16} className="text-[var(--warn)]" />
              Payout tracking isn&apos;t live in production yet
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">
              This section will populate once the withdrawal-request schema (
              <code className="text-xs">migration_proposals/PROPOSED_automated_provider_payouts.sql</code>) is
              reviewed and applied. Until then there is no real payout-status, payout-method, or payout-date data
              to show — nothing below is fabricated to fill the gap.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4 text-sm flex-wrap">
              <Link href="/admin/payouts" className={!params.state ? "btn-primary text-xs px-3 py-1.5" : "btn-secondary text-xs px-3 py-1.5"}>
                All
              </Link>
              {STATES.map((s) => (
                <Link
                  key={s}
                  href={`/admin/payouts?state=${s}`}
                  className={params.state === s ? "btn-primary text-xs px-3 py-1.5" : "btn-secondary text-xs px-3 py-1.5"}
                >
                  {STATE_LABEL[s].label}
                </Link>
              ))}
            </div>

            {!payouts?.length && (
              <div className="card p-8 text-center">
                <p className="text-sm font-medium">No payouts match this filter.</p>
              </div>
            )}
            {!!payouts?.length && (
              <div className="card overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th>Completed</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => {
                      const state = STATE_LABEL[p.state];
                      return (
                        <tr key={p.id}>
                          <td className="text-sm">
                            <span className="block font-medium">{p.providers?.display_name ?? "Unknown provider"}</span>
                            <span className="block text-xs font-mono text-[var(--muted)]">{p.destination_phone}</span>
                          </td>
                          <td className="text-sm font-semibold">{formatMoney(p.amount_minor, p.currency)}</td>
                          <td className="text-sm text-[var(--muted)]">{p.payout_provider_key ?? "—"}</td>
                          <td>
                            <span className={state.className}>{state.label}</span>
                            {p.state === "failed" && p.failure_reason && (
                              <span className="block text-xs text-[var(--danger)] mt-0.5 max-w-[180px]">{p.failure_reason}</span>
                            )}
                          </td>
                          <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("en-KE")}</td>
                          <td className="text-sm text-[var(--muted)] whitespace-nowrap">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-KE") : "—"}</td>
                          <td>{p.state === "failed" && <RetryButton payoutId={p.id} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-[var(--muted)]">
                  Page {page} of {totalPages} ({count} total)
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`} className="px-3 py-1 border rounded hover:bg-[var(--surface)]">
                      Previous
                    </a>
                  )}
                  {page < totalPages && (
                    <a href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`} className="px-3 py-1 border rounded hover:bg-[var(--surface)]">
                      Next
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
