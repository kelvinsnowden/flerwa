"use client";

import { useState, useTransition } from "react";
import { resolveReport } from "./actions";

interface Props {
  report: {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    description: string | null;
    reporterName: string;
    createdAt: string;
  };
}

export function ReportCard({ report }: Props) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (handled) return null;

  function act(state: "actioned" | "dismissed") {
    startTransition(async () => {
      setError(null);
      const res = await resolveReport(report.id, state, note);
      if (res?.error) setError(res.error);
      else setHandled(true);
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="badge-muted">{report.targetType.replace("_", " ")}</span>
        <span className="text-xs text-[var(--muted-2)]">{new Date(report.createdAt).toLocaleString("en-KE")}</span>
      </div>
      <p className="text-sm font-medium mt-2">{report.reason}</p>
      {report.description && <p className="text-sm text-[var(--muted)] mt-1">{report.description}</p>}
      <p className="text-xs text-[var(--muted-2)] mt-1">
        Reported by {report.reporterName} · target {report.targetId.slice(0, 8)}
      </p>

      <textarea
        className="mt-3"
        rows={2}
        placeholder="Resolution note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button className="btn-primary text-xs py-1.5 px-3" disabled={isPending} onClick={() => act("actioned")}>
          Mark actioned
        </button>
        <button className="text-xs text-[var(--muted)]" disabled={isPending} onClick={() => act("dismissed")}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
