"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { submitSupportRequest } from "./actions";

type Category = { id: string; name: string };

export function SupportForm({
  categories,
  defaultEmail,
  defaultName,
  isLoggedIn,
  relatedTransactionId,
  relatedTransactionLabel,
}: {
  categories: Category[];
  defaultEmail: string | null;
  defaultName: string | null;
  isLoggedIn: boolean;
  relatedTransactionId: string | null;
  relatedTransactionLabel: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<{ referenceNumber: string } | null>(null);

  if (confirmation) {
    return (
      <div className="card p-6 text-center">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--trust-tint)" }}
        >
          <Icon name="check-circle" size={24} className="text-[var(--trust)]" />
        </div>
        <h2 className="text-lg font-bold">We&apos;ve got your message</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your reference number is
          <span className="mx-1 font-mono font-semibold text-[var(--fg)]">{confirmation.referenceNumber}</span>
          — we&apos;ve sent a confirmation to your email. We&apos;ll reply there as soon as an agent responds; you can
          also reply directly to that email to add more detail.
        </p>
        <button className="btn-secondary mt-4" onClick={() => router.push(isLoggedIn ? "/account" : "/")}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form
      className="card flex flex-col gap-3 p-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await submitSupportRequest(formData);
          if (res?.error) setError(res.error);
          else if (res?.success) setConfirmation({ referenceNumber: res.referenceNumber });
        });
      }}
    >
      {relatedTransactionId && (
        <input type="hidden" name="related_transaction_id" value={relatedTransactionId} />
      )}
      {/* Honeypot: invisible to a real visitor (off-screen, never focusable
          via tab order, no label a screen reader would announce) but a
          plain scripted bot filling every input on the page will fill it.
          submitSupportRequest silently no-ops when this is non-empty —
          found missing during the Phase 2 production-readiness audit. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      {relatedTransactionLabel && (
        <p className="rounded-md bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
          Attached to booking: <span className="font-medium text-[var(--fg)]">{relatedTransactionLabel}</span>
        </p>
      )}

      {!isLoggedIn && (
        <label className="text-sm font-medium">
          Your email
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail ?? ""}
            placeholder="you@example.com"
            className="mt-1"
            autoComplete="email"
          />
        </label>
      )}

      <label className="text-sm font-medium">
        Your name (optional)
        <input name="name" defaultValue={defaultName ?? ""} className="mt-1" autoComplete="name" />
      </label>

      <label className="text-sm font-medium">
        Category
        <select name="category_id" className="mt-1" defaultValue="">
          <option value="">Not sure / other</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Subject
        <input name="subject" required maxLength={200} placeholder="A short summary" className="mt-1" />
      </label>

      <label className="text-sm font-medium">
        How can we help?
        <textarea name="body" required rows={5} maxLength={8000} placeholder="Tell us what happened…" className="mt-1" />
      </label>

      <label className="text-sm font-medium">
        Attachment (optional)
        <input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 text-sm" />
      </label>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <button type="submit" disabled={isPending} className="btn-primary mt-1">
        {isPending ? "Sending…" : "Send message"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        We reply by email — this isn&apos;t a live chat. Typical response time is within one business day.
      </p>
    </form>
  );
}
