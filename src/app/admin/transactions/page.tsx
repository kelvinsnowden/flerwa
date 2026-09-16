import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import {
  PAYMENT_STATE_LABELS,
  TXN_STATE_LABELS,
  type PaymentState,
  type ServiceTransaction,
  type TxnState,
} from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { Icon } from "@/components/ui/icon";

const PAGE_SIZE = 50;

const ACTIVE_STATES: TxnState[] = [
  "draft",
  "requested",
  "quoted",
  "quote_accepted",
  "funded",
  "scheduled",
  "en_route",
  "checked_in",
  "in_progress",
  "evidence_submitted",
  "customer_review",
  "revision_requested",
  "approved",
  "released",
];
const COMPLETED_STATES: TxnState[] = ["settled", "reviewed", "closed"];
const DISPUTED_STATES: TxnState[] = ["disputed"];
const CANCELLED_STATES: TxnState[] = ["cancelled_by_customer", "cancelled_by_provider", "expired", "refunded"];

function txnBadgeClass(state: TxnState): string {
  if ((COMPLETED_STATES as string[]).includes(state)) return "badge-trust";
  if ((DISPUTED_STATES as string[]).includes(state)) return "badge-danger";
  if ((CANCELLED_STATES as string[]).includes(state)) return "badge-muted";
  if (state === "revision_requested") return "badge-warn";
  return "badge-info";
}

function paymentBadgeClass(state: PaymentState): string {
  if (state === "funded" || state === "released") return "badge-trust";
  if (state === "payment_pending") return "badge-warn";
  if (state === "refunded") return "badge-info";
  if (state === "failed") return "badge-danger";
  return "badge-muted";
}

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; phone?: string; state?: string; group?: string; from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("service_transactions")
    .select("*, services(name), providers(display_name), profiles:customer_id(full_name, avatar_url)", { count: "exact" })
    .order("requested_at", { ascending: false })
    .range(from, to);

  if (params.id) query = query.eq("id", params.id);
  if (params.phone) query = query.ilike("contact_phone", `%${params.phone}%`);
  if (params.from) query = query.gte("requested_at", params.from);
  if (params.to) query = query.lte("requested_at", `${params.to}T23:59:59`);

  const GROUP_STATES: Record<string, TxnState[]> = {
    active: ACTIVE_STATES,
    completed: COMPLETED_STATES,
    disputed: DISPUTED_STATES,
    cancelled: CANCELLED_STATES,
  };

  if (params.state) {
    const states = params.state.split(",");
    query = states.length > 1 ? query.in("state", states) : query.eq("state", params.state);
  } else if (params.group && GROUP_STATES[params.group]) {
    query = query.in("state", GROUP_STATES[params.group]);
  }

  const { data: transactions, count, error } = await query.returns<
    (ServiceTransaction & {
      services: { name: string } | null;
      providers: { display_name: string } | null;
      profiles: { full_name: string | null; avatar_url: string | null } | null;
    })[]
  >();

  // Payment status lives on its own `payments` table (one row per funding
  // event, possibly more than one across a milestone-billed transaction's
  // life) rather than on service_transactions itself, so it's fetched as a
  // second batched query and reduced to "most recent row per transaction"
  // client-side — the same pattern used for reliability scores on the
  // Providers page.
  const txnIds = (transactions ?? []).map((t) => t.id);
  const { data: paymentRows } = txnIds.length
    ? await supabase
        .from("payments")
        .select("transaction_id, state, created_at")
        .in("transaction_id", txnIds)
        .order("created_at", { ascending: true })
    : { data: [] as { transaction_id: string; state: PaymentState; created_at: string }[] };
  const paymentByTxn = new Map<string, PaymentState>();
  for (const p of paymentRows ?? []) paymentByTxn.set(p.transaction_id, p.state);

  const [{ count: allCount }, { count: activeCount }, { count: completedCount }, { count: disputedCount }, { count: cancelledCount }] =
    await Promise.all([
      supabase.from("service_transactions").select("id", { count: "exact", head: true }),
      supabase.from("service_transactions").select("id", { count: "exact", head: true }).in("state", ACTIVE_STATES),
      supabase.from("service_transactions").select("id", { count: "exact", head: true }).in("state", COMPLETED_STATES),
      supabase.from("service_transactions").select("id", { count: "exact", head: true }).in("state", DISPUTED_STATES),
      supabase.from("service_transactions").select("id", { count: "exact", head: true }).in("state", CANCELLED_STATES),
    ]);

  const TABS = [
    { key: undefined, label: "All", count: allCount ?? 0 },
    { key: "active", label: "Active", count: activeCount ?? 0 },
    { key: "completed", label: "Completed", count: completedCount ?? 0 },
    { key: "disputed", label: "Disputed", count: disputedCount ?? 0 },
    { key: "cancelled", label: "Cancelled/refunded", count: cancelledCount ?? 0 },
  ];

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.id || params.phone || params.state || params.from || params.to);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Bookings</h1>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/admin/transactions?group=${t.key}` : "/admin/transactions"}
            className="pill-tab flex-shrink-0 whitespace-nowrap"
            data-active={!params.state && (params.group ?? undefined) === t.key}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      <form method="GET" className="flex flex-wrap gap-2 mb-4 text-sm items-end">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
          <input type="text" name="id" defaultValue={params.id ?? ""} placeholder="Exact booking ID" className="w-full pl-9 !min-h-0 !py-2 text-sm" />
        </div>
        <input type="text" name="phone" defaultValue={params.phone ?? ""} placeholder="Customer phone" className="!min-h-0 !py-2 text-sm min-w-[140px]" />
        <label className="text-xs font-medium text-[var(--muted)]">
          From
          <input type="date" name="from" defaultValue={params.from ?? ""} className="!min-h-0 !py-2 text-sm block" />
        </label>
        <label className="text-xs font-medium text-[var(--muted)]">
          To
          <input type="date" name="to" defaultValue={params.to ?? ""} className="!min-h-0 !py-2 text-sm block" />
        </label>
        <select name="state" defaultValue={params.state ?? ""} className="!min-h-0 !py-2 text-sm">
          <option value="">Exact state (any)</option>
          {Object.entries(TXN_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary text-sm">
          Filter
        </button>
        {hasFilters && (
          <Link href="/admin/transactions" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2">
            Reset filters
          </Link>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load transactions. Please refresh." />}
      {!error && !transactions?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">{hasFilters ? "No bookings match these filters" : "No bookings yet"}</p>
        </div>
      )}
      {!error && !!transactions?.length && (
        <>
          <div className="card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Professional</th>
                  <th>Amount</th>
                  <th>Booking status</th>
                  <th>Payment status</th>
                  <th>Requested</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const paymentState = paymentByTxn.get(t.id);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {t.profiles?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.profiles.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <span className="avatar h-7 w-7 text-xs flex-shrink-0">{initialsOf(t.profiles?.full_name ?? "?")}</span>
                          )}
                          <span className="text-sm font-medium truncate max-w-[140px]">{t.profiles?.full_name ?? "Unknown"}</span>
                        </div>
                      </td>
                      <td>
                        <Link href={`/admin/bookings/${t.id}`} className="text-sm font-semibold hover:underline">
                          {t.services?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="text-sm text-[var(--muted)] whitespace-nowrap">{t.providers?.display_name ?? "Unassigned"}</td>
                      <td className="text-sm font-medium whitespace-nowrap">{formatMoney(t.total_amount_minor, t.currency)}</td>
                      <td>
                        <span className={txnBadgeClass(t.state)}>{TXN_STATE_LABELS[t.state]}</span>
                      </td>
                      <td>
                        {paymentState ? (
                          <span className={paymentBadgeClass(paymentState)}>{PAYMENT_STATE_LABELS[paymentState]}</span>
                        ) : (
                          <span className="badge-muted">Not funded</span>
                        )}
                      </td>
                      <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(t.requested_at).toLocaleDateString("en-KE")}</td>
                      <td>
                        <Link href={`/admin/bookings/${t.id}`} className="btn-secondary text-xs px-3 py-1.5">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/*
           * Deliberately no "Payout status" column here: the wallet-model
           * payout redesign (rpc_request_payout / payouts table) pools a
           * provider's withdrawals against their whole earnings balance,
           * not any single booking — a payout row no longer even has a
           * transaction_id. Faking a per-row payout status would mean
           * inventing a relationship that doesn't exist in the schema.
           * Real payout state is visible per-provider at /admin/payouts.
           */}

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
    </div>
  );
}
