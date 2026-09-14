"use client";

import { useState, useTransition } from "react";
import { initiatePayment } from "./actions";

export function PayNowButton({ transactionId }: { transactionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="text-sm badge-trust inline-flex mt-2">
        Check your phone for the M-Pesa prompt
      </p>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await initiatePayment(transactionId);
            if (res?.error) setError(res.error);
            else if (res?.redirectUrl) window.location.href = res.redirectUrl;
            else setSent(true);
          })
        }
      >
        {isPending ? "Starting checkout…" : "Pay now"}
      </button>
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}
