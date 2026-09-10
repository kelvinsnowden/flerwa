"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "./actions";

/** Lets the customer back out of a booking any time before the Pro checks
 * in — a distinct action from DisputeLink, which is for when something's
 * already gone wrong, not for "I changed my mind." */
export function CancelBooking({ transactionId }: { transactionId: string }) {
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

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-sm font-medium">Cancel this booking?</p>
      <p className="text-xs text-[var(--muted)]">
        Free any time before your professional checks in. If you already paid, the amount will be refunded.
      </p>
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
