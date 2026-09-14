"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRecurringSeries } from "./actions";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

export function RecurringSeriesCard({
  id,
  serviceName,
  providerName,
  frequency,
  nextOccurrenceDate,
}: {
  id: string;
  serviceName: string;
  providerName: string;
  frequency: string;
  nextOccurrenceDate: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{serviceName}</p>
          <p className="text-xs text-[var(--muted)]">
            {providerName} · {FREQUENCY_LABELS[frequency] ?? frequency}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Next occurrence created around {new Date(nextOccurrenceDate).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
          </p>
        </div>
        <button
          type="button"
          className="text-xs px-3 py-1 rounded border border-[var(--danger)] text-[var(--danger)] whitespace-nowrap"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await cancelRecurringSeries(id);
              if (res?.error) setError(res.error);
              else router.refresh();
            })
          }
        >
          {isPending ? "Stopping…" : "Stop"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}
    </div>
  );
}
