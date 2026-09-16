"use client";

import { useState, useTransition } from "react";
import { retryPayout } from "./actions";

export function RetryButton({ payoutId }: { payoutId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn-secondary text-xs shrink-0" onClick={() => setOpen(true)}>
        Retry
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for retry"
        className="text-xs w-48"
      />
      <div className="flex gap-1.5">
        <button type="button" className="text-xs text-[var(--muted)]" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary text-xs py-1 px-2"
          disabled={isPending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await retryPayout(payoutId, reason);
              if (res?.error) setError(res.error);
              else setOpen(false);
            })
          }
        >
          {isPending ? "Retrying…" : "Confirm"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
