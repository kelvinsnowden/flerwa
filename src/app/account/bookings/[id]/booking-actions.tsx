"use client";

import { useState, useTransition } from "react";
import { approveBooking, openDispute, requestRevision, submitReview } from "./actions";

export function ApproveOrReviseControls({
  transactionId,
  revisionsUsed,
}: {
  transactionId: string;
  revisionsUsed: number;
}) {
  const [mode, setMode] = useState<"idle" | "revise" | "dispute">("idle");
  const [reason, setReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDetail, setDisputeDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (mode === "dispute") {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <p className="text-sm font-medium">Open a dispute</p>
        <p className="text-xs text-[var(--muted)]">
          Our team will review the job and evidence and reach a resolution.
          Payment stays held while a dispute is open.
        </p>
        <input
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
          placeholder="Reason (e.g. work not as described)"
        />
        <textarea
          rows={3}
          value={disputeDetail}
          onChange={(e) => setDisputeDetail(e.target.value)}
          placeholder="What went wrong? Be specific."
        />
        {error && <p className="notice-error">{error}</p>}
        <div className="flex gap-2">
          <button
            className="btn-danger"
            disabled={isPending || !disputeReason.trim()}
            onClick={() =>
              startTransition(async () => {
                const res = await openDispute(transactionId, disputeReason, disputeDetail);
                if (res?.error) setError(res.error);
                else setMode("idle");
              })
            }
          >
            {isPending ? "Opening…" : "Open dispute"}
          </button>
          <button className="btn-secondary" onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "revise") {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What needs to change? Be specific — reference what was agreed."
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex gap-2">
          <button
            className="btn-primary"
            disabled={isPending || !reason.trim()}
            onClick={() =>
              startTransition(async () => {
                const res = await requestRevision(transactionId, reason);
                if (res?.error) setError(res.error);
                else setMode("idle");
              })
            }
          >
            {isPending ? "Sending…" : "Send revision request"}
          </button>
          <button className="btn-secondary" onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await approveBooking(transactionId);
              if (res?.error) setError(res.error);
            })
          }
        >
          {isPending ? "Approving…" : "Approve & release payment"}
        </button>
        {revisionsUsed < 2 && (
          <button className="btn-secondary" onClick={() => setMode("revise")}>
            Request revision ({2 - revisionsUsed} left)
          </button>
        )}
      </div>
      <button
        className="text-sm font-medium self-start"
        style={{ color: "var(--danger)" }}
        onClick={() => setMode("dispute")}
      >
        Something's wrong — open a dispute
      </button>
    </div>
  );
}

export function ReviewForm({
  transactionId,
  revieweeId,
  revieweeName,
}: {
  transactionId: string;
  revieweeId: string;
  revieweeName: string;
}) {
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return <p className="text-sm badge-trust inline-flex">Thanks for your review</p>;
  }

  return (
    <form
      className="flex flex-col gap-2"
      action={(formData) => {
        startTransition(async () => {
          const res = await submitReview(formData);
          if (res?.error) setError(res.error);
          else setSubmitted(true);
        });
      }}
    >
      <input type="hidden" name="transaction_id" value={transactionId} />
      <input type="hidden" name="reviewee_id" value={revieweeId} />
      <p className="text-sm font-medium">Rate {revieweeName}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="text-2xl leading-none"
            style={{ color: n <= rating ? "var(--trust)" : "var(--border)" }}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
      <input type="hidden" name="rating" value={rating} />
      <textarea name="comment" rows={2} placeholder="Optional comment" />
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary w-fit">
        {isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
