import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type ServiceTransaction } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/bookings");

  const { data: bookings, error } = await supabase
    .from("service_transactions")
    .select("*, services(name), providers(display_name)")
    .eq("customer_id", user.id)
    .order("requested_at", { ascending: false })
    .returns<(ServiceTransaction & { services: { name: string } | null; providers: { display_name: string } | null })[]>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">My bookings</h1>

      {error && (
        <div className="mt-8">
          <ErrorNotice message="We couldn't load your bookings right now. Please refresh — this does not mean you have no bookings." />
        </div>
      )}

      {!error && !bookings?.length && (
        <div className="mt-8 card p-6 text-center">
          <p className="text-[var(--muted)]">You haven&apos;t booked anything yet.</p>
          <Link href="/" className="btn-primary mt-4 inline-block">
            Browse services
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {bookings?.map((b) => (
          <Link
            key={b.id}
            href={`/account/bookings/${b.id}`}
            className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors"
          >
            <div>
              <p className="font-semibold">{b.services?.name ?? "Service"}</p>
              <p className="text-sm text-[var(--muted)]">
                {b.providers?.display_name ?? "Awaiting assignment"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm">{formatMoney(b.total_amount_minor, b.currency)}</p>
              <p className="text-xs text-[var(--muted)]">{TXN_STATE_LABELS[b.state]}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
