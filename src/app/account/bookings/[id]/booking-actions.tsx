"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { REVIEW_TAGS } from "@/lib/types";
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
  const [approved, setApproved] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (approved) {
    return (
      <div className="mt-4 card p-5 flex items-center gap-4" style={{ borderColor: "var(--trust)" }}>
        <Image src="/images/success/success-completion.svg" alt="" width={64} height={64} className="flex-shrink-0" />
        <div>
          <p className="font-semibold">Payment released</p>
          <p className="text-sm text-[var(--muted)]">Thanks for confirming — your professional has been paid.</p>
        </div>
      </div>
    );
  }

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
              else setApproved(true);
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
  revieweePhotoUrl,
}: {
  transactionId: string;
  revieweeId: string;
  revieweeName: string;
  revieweePhotoUrl?: string | null;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wouldBookAgain, setWouldBookAgain] = useState<"true" | "false" | "">("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return <p className="text-sm badge-trust inline-flex">Thanks for your review</p>;
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  return (
    <form
      className="flex flex-col gap-4"
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
      <input type="hidden" name="rating" value={rating} />
      {selectedTags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
      {wouldBookAgain && <input type="hidden" name="would_book_again" value={wouldBookAgain} />}

      <div className="flex items-center gap-3">
        <Avatar name={revieweeName} photoUrl={revieweePhotoUrl} />
        <div>
          <p className="font-semibold">{revieweeName}</p>
          <p className="text-xs text-[var(--muted)]">Professional</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1.5">How was your experience?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className="text-3xl leading-none"
              style={{ color: n <= rating ? "var(--trust)" : "var(--border)" }}
              aria-label={`${n} stars`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <label className="text-sm font-medium">
        Tell us more (optional)
        <textarea
          name="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          placeholder="Excellent service! Very detailed report with clear photos. Great communication throughout. Highly recommend."
          className="mt-1"
        />
        <span className="block text-right text-xs text-[var(--muted-2)] mt-0.5">{comment.length}/500</span>
      </label>

      <div>
        <p className="text-sm font-medium mb-1.5">What did you like most?</p>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="pill-tab"
              data-active={selectedTags.includes(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1.5">Would you book again?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWouldBookAgain(wouldBookAgain === "true" ? "" : "true")}
            className="pill-tab"
            data-active={wouldBookAgain === "true"}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldBookAgain(wouldBookAgain === "false" ? "" : "false")}
            className="pill-tab"
            data-active={wouldBookAgain === "false"}
          >
            Not sure
          </button>
        </div>
      </div>

      {error && <p className="notice-error">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
