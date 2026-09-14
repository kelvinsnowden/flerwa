import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { ErrorNotice } from "@/components/error-notice";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PAY-C9: ledger_entries (append-
 * only, confirmed) had no browser independent of a single booking's detail
 * page. Also surfaces a live imbalance check (rpc_admin_check_ledger_
 * balance, new this pass) so an admin isn't limited to yesterday's cron
 * result on the dashboard — same underlying assertion PAY-006 already
 * proved safe, just callable from an interactive admin session now.
 */
const PAGE_SIZE = 50;

const ACCOUNT_TYPES = [
  "customer_receivable",
  "funds_held",
  "materials_held",
  "provider_payable",
  "platform_revenue",
  "refunds",
];

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; account_type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: imbalances, error: imbalanceError } = await supabase.rpc("rpc_admin_check_ledger_balance");

  let query = supabase
    .from("ledger_entries")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.group) query = query.eq("transaction_group", params.group);
  if (params.account_type) query = query.eq("account_type", params.account_type);

  const { data: entries, count, error } = await query;

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.group || params.account_type);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Ledger</h1>

      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold text-[var(--muted)] mb-2">Live balance check</p>
        {imbalanceError ? (
          <p className="text-sm text-[var(--danger)]">Couldn&apos;t run the check: {imbalanceError.message}</p>
        ) : !imbalances?.length ? (
          <p className="text-sm">Ledger balanced — no imbalanced transaction groups right now.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--danger)]">{imbalances.length} imbalanced group(s) — needs finance review.</p>
            {imbalances.map((im: { transaction_group: string; currency: string; imbalance_minor: number }) => (
              <a
                key={im.transaction_group}
                href={`?group=${im.transaction_group}`}
                className="block text-xs font-mono hover:underline"
              >
                {im.transaction_group} — off by {formatMoney(Math.abs(im.imbalance_minor), im.currency)}
              </a>
            ))}
          </div>
        )}
      </div>

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <input
          type="text"
          name="group"
          defaultValue={params.group ?? ""}
          placeholder="Transaction group (exact UUID)"
          className="border rounded px-3 py-1.5 min-w-[260px]"
        />
        <select name="account_type" defaultValue={params.account_type ?? ""} className="border rounded px-3 py-1.5">
          <option value="">All account types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
        {hasFilters && (
          <a href="/admin/ledger" className="text-[var(--muted)] hover:underline self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load ledger entries. Please refresh." />}
      {!error && !entries?.length && (
        <p className="text-sm text-[var(--muted)]">{hasFilters ? "No entries match these filters." : "No ledger entries yet."}</p>
      )}
      {!error && !!entries?.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b">
                  <th className="py-2 pr-4">Booking</th>
                  <th className="py-2 pr-4">Group</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Direction</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {e.transaction_id ? (
                        <Link href={`/admin/bookings/${e.transaction_id}`} className="hover:underline">
                          {e.transaction_id.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <a href={`?group=${e.transaction_group}`} className="font-mono text-xs hover:underline">
                        {e.transaction_group.slice(0, 8)}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{e.account_type}</td>
                    <td className="py-2 pr-4">{e.direction}</td>
                    <td className="py-2 pr-4">{formatMoney(e.amount_minor, e.currency)}</td>
                    <td className="py-2 text-xs text-[var(--muted)]">{new Date(e.created_at).toLocaleString("en-KE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-[var(--muted)]">
                Page {page} of {totalPages} ({count} total)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                    className="px-3 py-1 border rounded hover:bg-[var(--surface)]"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                    className="px-3 py-1 border rounded hover:bg-[var(--surface)]"
                  >
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
