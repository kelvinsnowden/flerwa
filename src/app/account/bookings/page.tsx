import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ServiceTransaction } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingCard } from "@/components/ui/booking-card";

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
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-6">My bookings</h1>

      {error && (
        <ErrorNotice message="We couldn't load your bookings right now. Please refresh — this does not mean you have no bookings." />
      )}

      {!error && !bookings?.length && (
        <EmptyState
          illustration="/images/empty-states/empty-bookings.svg"
          title="Your bookings will appear here"
          body="Once you book a service, you can track its progress and evidence from this page."
          action={
            <Link href="/" className="btn-primary">
              Browse services
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {!error &&
          bookings?.map((b) => (
            <BookingCard
              key={b.id}
              href={`/account/bookings/${b.id}`}
              title={b.services?.name ?? "Service"}
              subtitle={b.providers?.display_name ?? "Awaiting assignment"}
              state={b.state}
              amountMinor={b.total_amount_minor}
              currency={b.currency}
            />
          ))}
      </div>
    </div>
  );
}
