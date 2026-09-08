import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { ServiceTransaction } from "@/lib/types";
import { ConfirmPaymentForm } from "./confirm-payment-form";
import { ErrorNotice } from "@/components/error-notice";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("service_transactions")
    .select("*, services(name), profiles:customer_id(full_name, phone, email)")
    .in("state", ["requested", "quote_accepted"])
    .order("requested_at")
    .returns<
      (ServiceTransaction & {
        services: { name: string } | null;
        profiles: { full_name: string | null; phone: string | null; email: string | null } | null;
      })[]
    >();

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Payments to confirm</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        MVP payment rail is manual: the customer pays out-of-band and a
        payment is only marked funded here, after you&apos;ve verified the
        M-Pesa receipt. See docs/07-payments.md and SECURITY.md.
      </p>
      {error && (
        <ErrorNotice message="We couldn't load pending payments. Please refresh — this is not the same as there being nothing pending." />
      )}
      {!error && !pending?.length && <p className="text-sm text-[var(--muted)]">Nothing pending.</p>}
      <div className="flex flex-col gap-3">
        {pending?.map((txn) => (
          <div key={txn.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{txn.services?.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {txn.profiles?.full_name ?? "Customer"} · {txn.contact_phone ?? txn.profiles?.phone ?? "no phone on file"}
                </p>
              </div>
              <p className="font-bold">{formatMoney(txn.total_amount_minor, txn.currency)}</p>
            </div>
            <ConfirmPaymentForm transactionId={txn.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
