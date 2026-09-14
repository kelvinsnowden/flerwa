"use client";

import { useState, useTransition } from "react";
import { setCustomerSuspended } from "../actions";

export function SuspendControl({ profileId, isSuspended }: { profileId: string; isSuspended: boolean }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const action = isSuspended ? "Reinstate" : "Suspend";

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-[var(--muted)] mb-2">Account action</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Reason for ${action.toLowerCase()}ing this account (required, logged to the audit trail)`}
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
            const result = await setCustomerSuspended(profileId, !isSuspended, reason.trim());
            if (result.error) setError(result.error);
            else setReason("");
          })
        }
        className={isSuspended ? "btn-primary text-sm" : "text-sm px-4 py-1.5 rounded bg-[var(--danger)] text-white disabled:opacity-50"}
      >
        {isPending ? "Working…" : `${action} account`}
      </button>
    </div>
  );
}
