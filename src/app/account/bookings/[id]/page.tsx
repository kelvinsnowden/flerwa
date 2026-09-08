import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type ServiceTransaction } from "@/lib/types";
import { EvidenceGallery } from "./evidence-gallery";
import { ApproveOrReviseControls, ReviewForm } from "./booking-actions";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/account/bookings/${id}`);

  const { data: booking } = await supabase
    .from("service_transactions")
    .select("*, services(name), providers(id, display_name, user_id), locations(ward, town)")
    .eq("id", id)
    .single<
      ServiceTransaction & {
        services: { name: string } | null;
        providers: { id: string; display_name: string; user_id: string } | null;
        locations: { ward: string | null; town: string } | null;
      }
    >();

  if (!booking) notFound();

  const [{ count: revisionCount }, { data: existingReview }, { data: payment }] = await Promise.all([
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
  ]);

  const canApproveOrRevise = booking.state === "evidence_submitted";
  const canReview = ["settled", "reviewed", "closed"].includes(booking.state) && !existingReview;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-[var(--muted)]">{booking.services?.name}</p>
      <h1 className="text-2xl font-bold mt-1">{TXN_STATE_LABELS[booking.state]}</h1>

      <div className="mt-4 card p-4 flex flex-col gap-2 text-sm">
        <Row label="Provider" value={booking.providers?.display_name ?? "Awaiting assignment"} />
        <Row
          label="Location"
          value={booking.locations ? `${booking.locations.ward ?? ""} ${booking.locations.town}`.trim() : "—"}
        />
        <Row label="Total" value={formatMoney(booking.total_amount_minor, booking.currency)} />
        <Row
          label="Payment"
          value={
            !payment || payment.state === "unpaid"
              ? "Pending — our team will contact you to arrange payment"
              : payment.state === "funded"
                ? "Confirmed & held"
                : payment.state === "released"
                  ? "Released to provider"
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

      {(!payment || payment.state === "unpaid") && booking.state === "requested" && (
        <div className="mt-4 rounded-lg border p-4 text-sm badge-warn inline-block">
          We&apos;ll be in touch on {booking.contact_phone} shortly to confirm payment details.
        </div>
      )}

      {["evidence_submitted", "customer_review", "settled", "reviewed", "closed"].includes(
        booking.state
      ) && (
        <div className="mt-6">
          <h2 className="font-semibold mb-3">Evidence & report</h2>
          <EvidenceGallery transactionId={booking.id} />
        </div>
      )}

      {canApproveOrRevise && (
        <ApproveOrReviseControls transactionId={booking.id} revisionsUsed={revisionCount ?? 0} />
      )}

      {canReview && booking.providers && (
        <div className="mt-6 card p-4">
          <ReviewForm
            transactionId={booking.id}
            revieweeId={booking.providers.user_id}
            revieweeName={booking.providers.display_name}
          />
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
