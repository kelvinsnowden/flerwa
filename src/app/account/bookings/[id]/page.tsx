import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type ServiceTransaction } from "@/lib/types";
import { EvidenceGallery } from "./evidence-gallery";
import { ApproveOrReviseControls, ReviewForm } from "./booking-actions";
import { DisputeLink } from "./dispute-link";
import { CancelBooking } from "./cancel-booking";
import { PayNowButton } from "./pay-now-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/error-notice";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { StateBadge } from "@/components/ui/state-badge";
import { Icon } from "@/components/ui/icon";

const DISPUTABLE_ELSEWHERE_STATES: ServiceTransaction["state"][] = [
  "funded",
  "scheduled",
  "en_route",
  "checked_in",
  "in_progress",
  "customer_review",
  "revision_requested",
];

// Mirrors rpc_cancel_booking's own state check: free to cancel any time
// up to (not including) the Pro checking in.
const CANCELLABLE_STATES: ServiceTransaction["state"][] = [
  "requested",
  "quoted",
  "quote_accepted",
  "funded",
  "scheduled",
  "en_route",
];

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/account/bookings/${id}`);

  const { data: booking, error: bookingError } = await supabase
    .from("service_transactions")
    .select(
      "*, services(name), providers(id, slug, display_name, user_id, profiles:user_id(avatar_url)), locations(ward, town)"
    )
    .eq("id", id)
    .single<
      ServiceTransaction & {
        services: { name: string } | null;
        providers: {
          id: string;
          slug: string;
          display_name: string;
          user_id: string;
          profiles: { avatar_url: string | null } | null;
        } | null;
        locations: { ward: string | null; town: string } | null;
      }
    >();

  // PGRST116 = no matching row, a genuine "not found." Any other error is a
  // real failure and must not be presented to the user as a 404.
  if (bookingError && bookingError.code !== "PGRST116") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorNotice message="We couldn't load this booking right now. Please refresh." />
      </div>
    );
  }
  if (!booking) notFound();

  const [{ count: revisionCount }, { data: existingReview }, { data: payment, error: paymentError }, { data: activePaymentProvider }] =
    await Promise.all([
      supabase
        .from("transaction_events")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", id)
        .eq("event_type", "revision_requested"),
      supabase
        .from("reviews")
        .select("id")
        .eq("transaction_id", id)
        .eq("reviewer_id", user.id)
        .maybeSingle(),
      supabase.from("payments").select("state, external_reference").eq("transaction_id", id).maybeSingle(),
      // Admin client: payment_providers has no client-read policy for a
      // plain customer session (admin-only SELECT), and whether an
      // automated "Pay with M-Pesa" button can even be offered isn't
      // sensitive information worth adding a public policy for.
      createAdminClient().from("payment_providers").select("key").eq("is_active", true).eq("kind", "aggregator").maybeSingle(),
    ]);

  const canApproveOrRevise = booking.state === "evidence_submitted";
  const canDisputeElsewhere = DISPUTABLE_ELSEWHERE_STATES.includes(booking.state);
  const canReview = ["settled", "reviewed", "closed"].includes(booking.state) && !existingReview;
  const canCancel = CANCELLABLE_STATES.includes(booking.state);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <p className="text-sm text-[var(--muted)]">{booking.services?.name}</p>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="text-2xl font-bold">{TXN_STATE_LABELS[booking.state]}</h1>
        <StateBadge state={booking.state} />
      </div>

      {created === "1" && booking.state === "requested" && (
        <div className="mt-4 card p-5" style={{ borderColor: "var(--trust)" }}>
          <div className="flex items-center gap-4">
            <Image src="/images/success/success-booking.svg" alt="" width={72} height={72} className="flex-shrink-0" />
            <div>
              <p className="font-semibold">Booking confirmed!</p>
              <p className="text-sm text-[var(--muted)]">
                We&apos;ll be in touch on {booking.contact_phone} to arrange payment.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[var(--surface)] p-3 text-xs text-[var(--muted)] flex flex-col gap-1.5">
            <p className="font-semibold text-[var(--foreground)]">What happens next</p>
            <p>Professional confirms (usually within 1 hour)</p>
            <p>You&apos;ll get updates in the app</p>
            <p>The professional will contact you before the visit</p>
          </div>
          <Link href="/" className="btn-secondary w-full mt-4">
            Back to home
          </Link>
        </div>
      )}

      <div className="mt-6 card p-4">
        <StatusTimeline state={booking.state} />
      </div>

      <div className="mt-4 card p-4 flex flex-col gap-2 text-sm">
        <Row label="Professional" value={booking.providers?.display_name ?? "Awaiting assignment"} />
        <Row
          label="Location"
          value={booking.locations ? `${booking.locations.ward ?? ""} ${booking.locations.town}`.trim() : "—"}
        />
        <Row label="Total" value={formatMoney(booking.total_amount_minor, booking.currency)} />
        <Row
          label="Payment"
          value={
            paymentError
              ? "Unable to load payment status — refresh to try again"
              : !payment || payment.state === "unpaid"
                ? "Pending — our team will contact you to arrange payment"
                : payment.state === "funded"
                  ? "Confirmed & held"
                  : payment.state === "released"
                    ? "Released to professional"
                    : payment.state
          }
        />
        {booking.auto_approve_at && booking.state === "evidence_submitted" && (
          <Row
            label="Auto-approves"
            value={new Date(booking.auto_approve_at).toLocaleString("en-KE")}
          />
        )}
      </div>

      {booking.providers && (
        <Link href={`/messages/${booking.id}`} className="mt-4 card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
          <span className="flex items-center gap-2 font-medium">
            <Icon name="message-circle" size={18} className="text-[var(--trust)]" />
            Message {booking.providers.display_name}
          </span>
          <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
        </Link>
      )}

      {(!payment || payment.state === "unpaid") && booking.state === "requested" && (
        <div className="mt-4 rounded-lg border p-4 text-sm">
          {activePaymentProvider?.key === "intasend" ? (
            <>
              <p className="badge-warn inline-block">Payment pending</p>
              <PayNowButton transactionId={booking.id} />
            </>
          ) : (
            <p className="badge-warn inline-block">
              We&apos;ll be in touch on {booking.contact_phone} shortly to confirm payment details.
            </p>
          )}
        </div>
      )}

      {canApproveOrRevise && (
        <div className="mt-6 card p-5 text-center flex flex-col items-center">
          <Image src="/images/success/success-completion.svg" alt="" width={64} height={64} />
          <p className="font-semibold mt-2">Inspection completed</p>
          <p className="text-sm text-[var(--muted)] mt-1">
            {booking.providers?.display_name ?? "Your professional"} has submitted the full report for your review.
          </p>
        </div>
      )}

      {["evidence_submitted", "customer_review", "settled", "reviewed", "closed"].includes(
        booking.state
      ) && (
        <div id="report" className="mt-6 scroll-mt-16">
          <h2 className="font-semibold mb-3 flex items-center gap-1.5">
            <Icon name="camera" size={16} className="text-[var(--trust)]" />
            Evidence & report
          </h2>
          {booking.completion_summary && (
            <div className="card p-4 mb-3">
              <p className="text-xs font-semibold text-[var(--muted)] mb-1">Professional notes</p>
              <p className="text-sm">{booking.completion_summary}</p>
            </div>
          )}
          <EvidenceGallery transactionId={booking.id} />
        </div>
      )}

      {canApproveOrRevise && (
        <ApproveOrReviseControls transactionId={booking.id} revisionsUsed={revisionCount ?? 0} />
      )}

      {!canApproveOrRevise && canDisputeElsewhere && <DisputeLink transactionId={booking.id} />}

      {canCancel && <CancelBooking transactionId={booking.id} />}

      {canReview && booking.providers && (
        <div className="mt-6 card p-4">
          <ReviewForm
            transactionId={booking.id}
            revieweeId={booking.providers.user_id}
            revieweeName={booking.providers.display_name}
            revieweePhotoUrl={booking.providers.profiles?.avatar_url}
          />
        </div>
      )}

      {["settled", "reviewed", "closed"].includes(booking.state) && (
        <div className="mt-6 card p-5 text-center flex flex-col items-center">
          <Image src="/images/success/success-completion.svg" alt="" width={64} height={64} />
          <p className="font-bold text-lg mt-2">All done!</p>
          <p className="text-sm text-[var(--muted)] mt-1">
            This booking has been completed. Thank you for using Trusted Services.
          </p>
          <div className="flex flex-col gap-2 w-full mt-4">
            {booking.providers && (
              <Link href={`/provider/${booking.providers.slug}`} className="btn-primary w-full">
                Book professional again
              </Link>
            )}
            <a href="#report" className="btn-secondary w-full">
              View full report
            </a>
            <Link href="/" className="btn-secondary w-full">
              Back to home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
