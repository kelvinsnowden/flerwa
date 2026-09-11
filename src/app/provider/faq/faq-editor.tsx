"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import type { ProviderFaq } from "@/lib/types";
import { saveFaqs } from "./actions";

type Row = { question: string; answer: string };

export function FaqEditor({ initialFaqs }: { initialFaqs: ProviderFaq[] }) {
  const [rows, setRows] = useState<Row[]>(
    initialFaqs.length > 0 ? initialFaqs.map((f) => ({ question: f.question, answer: f.answer })) : [{ question: "", answer: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function addRow() {
    setRows((prev) => [...prev, { question: "", answer: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveFaqs(rows);
      if (res.error) {
        setError(res.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="card p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={row.question}
                  onChange={(e) => updateRow(i, { question: e.target.value })}
                  placeholder="Question, e.g. Do you travel outside Nairobi?"
                  className="font-medium"
                />
                <textarea
                  value={row.answer}
                  onChange={(e) => updateRow(i, { answer: e.target.value })}
                  placeholder="Your answer…"
                  rows={2}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove question"
                className="flex-shrink-0 text-[var(--muted)] hover:text-red-600 mt-1"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="btn-secondary mt-3 text-sm px-3 py-1.5">
        + Add a question
      </button>

      {error && <p className="notice-error mt-3">{error}</p>}

      <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary mt-4 w-full">
        {isPending ? "Saving…" : saved ? "Saved ✓" : "Save FAQ"}
      </button>
    </div>
  );
}
