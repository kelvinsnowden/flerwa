"use client";

import { useState, useTransition } from "react";
import { checkIn, submitCompletion } from "./actions";

export function CheckInButton({ transactionId }: { transactionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-4">
      {error && <p className="text-sm text-[var(--danger)] mb-2">{error}</p>}
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            let lat: number | null = null;
            let lng: number | null = null;
            try {
              const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
              );
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
            } catch {
              // proceed without geotag
            }
            const res = await checkIn(transactionId, lat, lng);
            if (res?.error) setError(res.error);
          })
        }
      >
        {isPending ? "Checking in…" : "Check in — I've arrived"}
      </button>
    </div>
  );
}

export function SubmitCompletionButton({ transactionId }: { transactionId: string }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-2">
      <label className="text-sm font-medium">
        Summary for the customer (optional)
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="e.g. The property is in good condition overall. Minor wear in the master bathroom."
          className="mt-1"
        />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await submitCompletion(transactionId, summary || null);
            if (res?.error) setError(res.error);
          })
        }
      >
        {isPending ? "Submitting…" : "Submit for customer review"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        All required checklist items must have evidence attached before you
        can submit — this is checked by the server, not just this page.
      </p>
    </div>
  );
}
