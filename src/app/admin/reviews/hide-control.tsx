"use client";

import { useState, useTransition } from "react";
import { setReviewHidden } from "./actions";

export function HideControl({ reviewId, isHidden }: { reviewId: string; isHidden: boolean }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const label = isHidden ? "Unhide" : "Hide";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={isHidden ? "text-xs btn-primary px-3 py-1 rounded" : "text-xs px-3 py-1 rounded border border-[var(--danger)] text-[var(--danger)]"}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Reason for ${label.toLowerCase()}ing this review (required, logged)`}
        className="w-56 border rounded px-2 py-1 text-xs"
        rows={2}
      />
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1 rounded border">
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await setReviewHidden(reviewId, !isHidden, reason.trim());
              if (result.error) setError(result.error);
              else {
                setReason("");
                setOpen(false);
              }
            })
          }
          className={isHidden ? "text-xs btn-primary px-3 py-1 rounded disabled:opacity-50" : "text-xs px-3 py-1 rounded bg-[var(--danger)] text-white disabled:opacity-50"}
        >
          {isPending ? "Working…" : `Confirm ${label.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}
