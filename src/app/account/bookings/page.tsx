import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ServiceTransaction, TxnState } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingCard } from "@/components/ui/booking-card";

type Filter = "all" | "upcoming" | "in_progress" | "completed";

const FILTER_STATES: Record<Exclude<Filter, "all">, TxnState[]> = {
  upcoming: ["requested", "quoted", "quote_accepted", "funded", "scheduled"],
  in_progress: ["en_route", "checked_in", "in_progress", "evidence_submitted", "customer_review", "revision_requested"],
  // Off-path terminal states (cancelled/expired/disputed/refunded) land here
  // too — they're no longer active or upcoming, and the state badge on each
  // card already shows their real status honestly.
  completed: ["approved", "released", "settled", "reviewed", "closed", "cancelled_by_customer", "cancelled_by_provider", "expired", "disputed", "refunded"],
};

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterParam } = await searchParams;
  const filter: Filter = (["all", "upcoming", "in_progress", "completed"] as const).includes(filterParam as Filter)
    ? (filterParam as Filter)
    : "all";

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

  const filtered = filter === "all" ? bookings : bookings?.filter((b) => FILTER_STATES[filter].includes(b.state));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-4">My bookings</h1>

      {!error && !!bookings?.length && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/account/bookings" : `/account/bookings?filter=${tab.value}`}
              className="pill-tab whitespace-nowrap"
              data-active={filter === tab.value}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

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

      {!error && !!bookings?.length && !filtered?.length && (
        <EmptyState
          icon={null}
          title={`No ${TABS.find((t) => t.value === filter)?.label.toLowerCase()} bookings`}
          body="Try a different tab, or check back once your bookings move to this stage."
        />
      )}

      <div className="flex flex-col gap-3">
        {!error &&
          filtered?.map((b) => (
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
