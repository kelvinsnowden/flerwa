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
            const res = await submitCompletion(transactionId);
            if (res?.error) setError(res.error);
          })
        }
      >
        {isPending ? "Submitting…" : "Submit for customer review"}
      </button>
      <p className="text-xs text-[var(--muted)] mt-2">
        All required checklist items must have evidence attached before you
        can submit — this is checked by the server, not just this page.
      </p>
    </div>
  );
}
