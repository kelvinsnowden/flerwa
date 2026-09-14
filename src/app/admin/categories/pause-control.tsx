"use client";

import { useState, useTransition } from "react";
import { setCategoryActive } from "./actions";

export function PauseControl({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const action = isActive ? "Pause" : "Resume";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={isActive ? "text-xs px-3 py-1 rounded border border-[var(--danger)] text-[var(--danger)]" : "text-xs btn-primary px-3 py-1 rounded"}
      >
        {action}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Reason for ${action.toLowerCase()}ing this category (required, logged)`}
        className="w-56 border rounded px-2 py-1 text-xs"
        rows={2}
      />
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1 rounded border">
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await setCategoryActive(categoryId, !isActive, reason.trim());
              if (result.error) setError(result.error);
              else {
                setReason("");
                setOpen(false);
              }
            })
          }
          className={isActive ? "text-xs px-3 py-1 rounded bg-[var(--danger)] text-white disabled:opacity-50" : "text-xs btn-primary px-3 py-1 rounded disabled:opacity-50"}
        >
          {isPending ? "Working…" : `Confirm ${action.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}
