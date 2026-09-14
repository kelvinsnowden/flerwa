"use client";

import { useState, useTransition } from "react";
import { addBookingNote } from "../actions";

export function AddNoteForm({ transactionId }: { transactionId: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add an internal note (not visible to the customer or provider)"
        className="w-full border rounded px-3 py-2 text-sm mb-2"
        rows={2}
      />
      {error && <p className="text-sm text-[var(--danger)] mb-2">{error}</p>}
      <button
        type="button"
        disabled={isPending || !note.trim()}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await addBookingNote(transactionId, note);
            if (result.error) setError(result.error);
            else setNote("");
          })
        }
        className="btn-primary text-sm px-4 py-1.5 rounded disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Add note"}
      </button>
    </div>
  );
}
