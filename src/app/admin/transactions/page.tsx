import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type ServiceTransaction } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";

export default async function AdminTransactionsPage() {
  const supabase = await createClient();
  const { data: transactions, error } = await supabase
    .from("service_transactions")
    .select("*, services(name), providers(display_name)")
    .order("requested_at", { ascending: false })
    .limit(100)
    .returns<
      (ServiceTransaction & {
        services: { name: string } | null;
        providers: { display_name: string } | null;
      })[]
    >();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">All transactions</h1>
      {error && <ErrorNotice message="We couldn't load transactions. Please refresh." />}
      {!error && <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b">
              <th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Provider</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2">Requested</th>
            </tr>
          </thead>
          <tbody>
            {transactions?.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link href={`/account/bookings/${t.id}`} className="font-medium hover:underline">
                    {t.services?.name ?? "—"}
                  </Link>
                </td>
                <td className="py-2 pr-4">{t.providers?.display_name ?? "Unassigned"}</td>
                <td className="py-2 pr-4">{TXN_STATE_LABELS[t.state]}</td>
                <td className="py-2 pr-4">{formatMoney(t.total_amount_minor, t.currency)}</td>
                <td className="py-2 text-xs text-[var(--muted)]">
                  {new Date(t.requested_at).toLocaleDateString("en-KE")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!transactions?.length && <p className="text-sm text-[var(--muted)] mt-4">No transactions yet.</p>}
      </div>}
    </div>
  );
}
