"use client";

import { useState, useTransition } from "react";
import { submitQuote } from "../actions";

export function QuoteForm({ requestId }: { requestId: string }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return <p className="badge-trust inline-flex">Quote sent — you&apos;ll be notified if it's accepted</p>;
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="font-semibold text-sm">Send a quote</p>
      <label className="text-sm font-medium">
        Your price (KES)
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 5000"
          className="mt-1"
        />
      </label>
      <label className="text-sm font-medium">
        Message (optional)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Your availability, relevant experience, anything the customer should know."
          className="mt-1"
        />
      </label>
      {error && <p className="notice-error">{error}</p>}
      <button
        type="button"
        className="btn-primary"
        disabled={isPending || !amount}
        onClick={() =>
          startTransition(async () => {
            const res = await submitQuote(requestId, amount, message);
            if (res?.error) setError(res.error);
            else setSubmitted(true);
          })
        }
      >
        {isPending ? "Sending…" : "Send quote"}
      </button>
    </div>
  );
}
