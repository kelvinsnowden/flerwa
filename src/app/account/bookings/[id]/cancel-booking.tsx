"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "./actions";

interface Props {
  transactionId: string;
  isFunded: boolean;
  isCheckedInOrLater: boolean;
  scheduledFor: string | null;
}

/** Lets the customer back out of a booking. A distinct action from
 * DisputeLink, which is for when something's already gone wrong, not for
 * "I changed my mind." The compensation shown here mirrors
 * rpc_cancel_booking's own fee tiers exactly (TXN-005 / docs/07's
 * cancellation-fee table) — this is a preview for the confirmation
 * prompt, not the source of truth; the RPC computes the real figure
 * server-side regardless of what this component predicts. */
export function CancelBooking({ transactionId, isFunded, isCheckedInOrLater, scheduledFor }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (cancelled) {
    return <p className="mt-4 text-sm badge-warn inline-flex">Booking cancelled</p>;
  }

  if (!open) {
    return (
      <button className="text-sm font-medium mt-4" style={{ color: "var(--muted)" }} onClick={() => setOpen(true)}>
        Cancel this booking
      </button>
    );
  }

  const hoursUntilScheduled = scheduledFor ? (new Date(scheduledFor).getTime() - Date.now()) / 3_600_000 : null;

  const warning = !isFunded
    ? "This booking hasn't been paid yet — cancelling is free."
    : isCheckedInOrLater
      ? "Your professional has already checked in. They'll be paid in full for the work already underway — only materials (if any) are refunded to you."
      : hoursUntilScheduled !== null && hoursUntilScheduled < 24
        ? "Your appointment is less than 24 hours away. Per our cancellation policy, your professional keeps 50% as compensation for the lost slot."
        : "If you already paid, the amount will be refunded in full.";

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-sm font-medium">Cancel this booking?</p>
      <p className="text-xs text-[var(--muted)]">{warning}</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
      />
      {error && <p className="notice-error">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn-danger"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await cancelBooking(transactionId, reason);
              if (res?.error) setError(res.error);
              else setCancelled(true);
            })
          }
        >
          {isPending ? "Cancelling…" : "Yes, cancel booking"}
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Never mind
        </button>
      </div>
    </div>
  );
}
