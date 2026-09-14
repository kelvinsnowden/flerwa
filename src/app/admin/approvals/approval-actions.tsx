"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideAdminAction } from "./actions";

export function ApprovalActions({ approvalId, isOwnProposal }: { approvalId: string; isOwnProposal: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isOwnProposal) {
    return <p className="text-xs text-[var(--muted)]">Waiting on a different admin — you proposed this, you can't approve it yourself.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary text-xs px-3 py-1"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await decideAdminAction(approvalId, "approve");
              if (res?.error) setError(res.error);
              else router.refresh();
            })
          }
        >
          {isPending ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          className="text-xs px-3 py-1 rounded border border-[var(--danger)] text-[var(--danger)]"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await decideAdminAction(approvalId, "reject");
              if (res?.error) setError(res.error);
              else router.refresh();
            })
          }
        >
          {isPending ? "Working…" : "Reject"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
