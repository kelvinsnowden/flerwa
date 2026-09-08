"use client";

import { useState, useTransition } from "react";
import { confirmPayment } from "./actions";

export function ConfirmPaymentForm({ transactionId }: { transactionId: string }) {
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) return <p className="mt-3 badge-trust inline-flex">Payment confirmed</p>;

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="text-xs font-medium flex-1">
        M-Pesa reference
        <input
          className="mt-1"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. QK12ABC3"
        />
      </label>
      <label className="text-xs font-medium flex-1">
        Notes
        <input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button
        className="btn-primary text-sm shrink-0"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await confirmPayment(transactionId, reference, notes);
            if (res?.error) setError(res.error);
            else setDone(true);
          })
        }
      >
        {isPending ? "Confirming…" : "Confirm payment received"}
      </button>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
