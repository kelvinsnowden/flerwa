import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { ServiceTransaction } from "@/lib/types";
import { ConfirmPaymentForm } from "./confirm-payment-form";
import { ErrorNotice } from "@/components/error-notice";

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

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
      <h1 className="text-xl font-bold mb-1">Payments</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        MVP payment rail is manual: the customer pays out-of-band and a payment is only marked funded here, after
        you&apos;ve verified the M-Pesa receipt. See docs/07-payments.md and SECURITY.md. This queue is not
        paginated because it only ever shows bookings still awaiting a funding decision — the full payment history
        for a booking is on its detail page.
      </p>
      {error && (
        <ErrorNotice message="We couldn't load pending payments. Please refresh — this is not the same as there being nothing pending." />
      )}
      {!error && !pending?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">Nothing pending — every booking has a funding decision.</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {pending?.map((txn) => (
          <div key={txn.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="avatar h-8 w-8 text-xs flex-shrink-0">{initialsOf(txn.profiles?.full_name ?? "?")}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{txn.services?.name}</p>
                  <p className="text-xs text-[var(--muted)] truncate">
                    {txn.profiles?.full_name ?? "Customer"} · {txn.contact_phone ?? txn.profiles?.phone ?? "no phone on file"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="badge-warn">Awaiting confirmation</span>
                <p className="font-bold whitespace-nowrap">{formatMoney(txn.total_amount_minor, txn.currency)}</p>
              </div>
            </div>
            <ConfirmPaymentForm transactionId={txn.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
