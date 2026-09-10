"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { Rating } from "@/components/ui/rating";
import { formatMoney } from "@/lib/money";
import type { VerificationStatus } from "@/lib/types";
import { acceptQuote, declineQuote } from "./actions";

export interface QuoteRow {
  id: string;
  amount_minor: number;
  message: string | null;
  state: string;
  providers: {
    display_name: string;
    slug: string;
    headline: string | null;
    verification_status: VerificationStatus;
    profiles: { avatar_url: string | null } | null;
    reliability_scores: { avg_rating: number | null; jobs_completed: number }[];
  } | null;
}

export function QuoteList({ requestId, quotes }: { requestId: string; quotes: QuoteRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const pending = quotes.filter((q) => q.state === "pending");

  if (pending.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No responses yet — professionals in this category can see your task and will respond soon.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="notice-error">{error}</p>}
      {pending.map((q) => {
        const provider = q.providers;
        const rel = provider?.reliability_scores?.[0];
        return (
          <div key={q.id} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Avatar name={provider?.display_name ?? "Professional"} photoUrl={provider?.profiles?.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{provider?.display_name}</span>
                  {provider && <VerificationBadge status={provider.verification_status} />}
                </div>
                <p className="text-xs text-[var(--muted)] truncate">{provider?.headline}</p>
              </div>
              <span className="font-bold text-sm whitespace-nowrap">{formatMoney(q.amount_minor)}</span>
            </div>

            {rel?.avg_rating != null ? (
              <Rating value={rel.avg_rating} count={rel.jobs_completed} />
            ) : (
              <span className="text-xs text-[var(--muted)]">New professional — no reviews yet</span>
            )}

            {q.message && <p className="text-sm">{q.message}</p>}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                className="btn-primary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setPendingId(q.id);
                  startTransition(async () => {
                    const res = await acceptQuote(q.id, requestId);
                    if (res?.error) setError(res.error);
                  });
                }}
              >
                {isPending && pendingId === q.id ? "Accepting…" : "Accept"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setPendingId(q.id);
                  startTransition(async () => {
                    const res = await declineQuote(q.id, requestId);
                    if (res?.error) setError(res.error);
                  });
                }}
              >
                {isPending && pendingId === q.id ? "…" : "Decline"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
