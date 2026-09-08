"use client";

import { useState, useTransition } from "react";
import { submitDealDeskRequest } from "./actions";

export function DealDeskForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await submitDealDeskRequest(formData);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label className="text-sm font-medium">
        Customer email
        <input name="customer_email" type="email" className="mt-1" />
      </label>
      <label className="text-sm font-medium">
        Customer phone
        <input name="customer_phone" type="tel" className="mt-1" placeholder="07XX XXX XXX" />
      </label>
      <label className="text-sm font-medium">
        What did you agree to do?
        <textarea name="description" rows={4} required className="mt-1" />
      </label>
      <label className="text-sm font-medium">
        Agreed price (KSh)
        <input name="amount_kes" type="number" min="0" step="1" className="mt-1" />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Submitting…" : "Submit for review"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        Our team reviews each Deal Desk request and reaches out to your
        customer to set up protected payment.
      </p>
    </form>
  );
}
