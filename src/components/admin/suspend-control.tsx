"use client";

import { useState, useTransition } from "react";

/**
 * Shared suspend/reinstate UI — same shape used for customers
 * (rpc_set_customer_suspended) and providers (rpc_admin_set_provider_
 * suspended). Takes the actual server action as a prop rather than
 * importing either one, so this component has no opinion about which
 * entity it's suspending.
 */
export function SuspendControl({
  entityId,
  isSuspended,
  action,
}: {
  entityId: string;
  isSuspended: boolean;
  action: (
    id: string,
    suspended: boolean,
    reason: string
  ) => Promise<{ error?: string; success?: boolean; pending?: boolean; approvalId?: string }>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const label = isSuspended ? "Reinstate" : "Suspend";

  if (submitted) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold text-[var(--muted)] mb-1">Account action</p>
        <p className="text-sm">
          Submitted for approval — a different trust &amp; safety admin needs to approve this from{" "}
          <a href="/admin/approvals" className="underline">
            /admin/approvals
          </a>{" "}
          before it takes effect.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-[var(--muted)] mb-2">Account action</p>
      <p className="text-xs text-[var(--muted)] mb-2">
        Requires a second admin&apos;s approval (dual control) — this proposes the action, it doesn&apos;t apply it immediately.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Reason for ${label.toLowerCase()}ing this account (required, logged to the audit trail)`}
        className="w-full border rounded px-3 py-2 text-sm mb-2"
        rows={2}
      />
      {error && <p className="text-sm text-[var(--danger)] mb-2">{error}</p>}
      <button
        type="button"
        disabled={isPending || !reason.trim()}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await action(entityId, !isSuspended, reason.trim());
            if (result.error) setError(result.error);
            else setSubmitted(true);
          })
        }
        className={isSuspended ? "btn-primary text-sm" : "text-sm px-4 py-1.5 rounded bg-[var(--danger)] text-white disabled:opacity-50"}
      >
        {isPending ? "Submitting…" : `Propose ${label.toLowerCase()}`}
      </button>
    </div>
  );
}
