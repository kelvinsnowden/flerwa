"use client";

import { useState, useTransition } from "react";
import { openDispute } from "./actions";

/** A standalone dispute trigger for active states outside the evidence-review
 * decision point (e.g. the provider never showed up after payment was
 * confirmed) — ApproveOrReviseControls covers the evidence_submitted case. */
export function DisputeLink({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        className="text-sm font-medium mt-4"
        style={{ color: "var(--danger)" }}
        onClick={() => setOpen(true)}
      >
        Something's wrong — open a dispute
      </button>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. professional hasn't shown up)" />
      <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What went wrong? Be specific." />
      {error && <p className="notice-error">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn-danger"
          disabled={isPending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await openDispute(transactionId, reason, detail);
              if (res?.error) setError(res.error);
              else setOpen(false);
            })
          }
        >
          {isPending ? "Opening…" : "Open dispute"}
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
