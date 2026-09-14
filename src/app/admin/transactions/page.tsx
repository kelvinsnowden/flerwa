import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type ServiceTransaction, type TxnState } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";

const PAGE_SIZE = 50;

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; phone?: string; state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("service_transactions")
    .select("*, services(name), providers(display_name)", { count: "exact" })
    .order("requested_at", { ascending: false })
    .range(from, to);

  if (params.id) query = query.eq("id", params.id);
  if (params.phone) query = query.ilike("contact_phone", `%${params.phone}%`);
  if (params.state) {
    const states = params.state.split(",");
    query = states.length > 1 ? query.in("state", states) : query.eq("state", params.state);
  }

  const { data: transactions, count, error } = await query.returns<
    (ServiceTransaction & {
      services: { name: string } | null;
      providers: { display_name: string } | null;
    })[]
  >();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.id || params.phone || params.state);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">All transactions</h1>

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <input
          type="text"
          name="id"
          defaultValue={params.id ?? ""}
          placeholder="Exact booking ID"
          className="border rounded px-3 py-1.5 min-w-[220px]"
        />
        <input
          type="text"
          name="phone"
          defaultValue={params.phone ?? ""}
          placeholder="Customer phone"
          className="border rounded px-3 py-1.5 min-w-[160px]"
        />
        <select name="state" defaultValue={params.state ?? ""} className="border rounded px-3 py-1.5">
          <option value="">All states</option>
          {Object.entries(TXN_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
        {hasFilters && (
          <a href="/admin/transactions" className="text-[var(--muted)] hover:underline self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load transactions. Please refresh." />}
      {!error && !transactions?.length && (
        <p className="text-sm text-[var(--muted)]">{hasFilters ? "No transactions match these filters." : "No transactions yet."}</p>
      )}
      {!error && !!transactions?.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b">
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Professional</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">Requested</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/bookings/${t.id}`} className="font-medium hover:underline">
                        {t.services?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{t.providers?.display_name ?? "Unassigned"}</td>
                    <td className="py-2 pr-4">{TXN_STATE_LABELS[t.state as TxnState]}</td>
                    <td className="py-2 pr-4">{formatMoney(t.total_amount_minor, t.currency)}</td>
                    <td className="py-2 text-xs text-[var(--muted)]">
                      {new Date(t.requested_at).toLocaleDateString("en-KE")}
                    </td>
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
