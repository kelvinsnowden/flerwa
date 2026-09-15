"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { submitReport, type ReportTargetType } from "./actions";

const REASONS: Record<ReportTargetType, string[]> = {
  message: ["Harassment or abuse", "Scam or fraud attempt", "Spam", "Something else"],
  review: ["Fake or misleading", "Harassment or abuse", "Off-topic / spam", "Something else"],
  provider_profile: ["Suspicious or fraudulent listing", "Impersonation", "Inappropriate content", "Something else"],
  customer_profile: ["Harassment or abuse", "Scam or fraud attempt", "Something else"],
  portfolio_item: ["Not their own work / stolen content", "Inappropriate content", "Misleading claims", "Something else"],
  social_highlight: ["Not their own post", "Inappropriate content", "Broken or suspicious link", "Something else"],
};

const REPORT_LABEL: Record<ReportTargetType, string> = {
  message: "message",
  review: "review",
  provider_profile: "professional",
  customer_profile: "customer",
  portfolio_item: "portfolio item",
  social_highlight: "social highlight",
};

/**
 * Reusable report/flag affordance (TSF-007) — a small flag icon that opens
 * an inline form. Works for messages, reviews, and provider/customer
 * profiles; the reasons offered are tailored per target type but the
 * submit path (rpc-free — a plain RLS-checked insert into `reports`) is
 * shared. See supabase/migrations/20260915110000_tsf007_report_flag_mechanism.sql.
 */
export function ReportButton({
  targetType,
  targetId,
  label = "Report",
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <p className="text-xs text-[var(--muted)]">Thanks — our team will take a look.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center gap-1 text-xs text-[var(--muted-2)] hover:text-[var(--danger)]"}
        aria-label={label}
      >
        <Icon name="flag" size={13} />
        {label}
      </button>
    );
  }

  return (
    <div className="card p-3 text-sm" style={{ maxWidth: 320 }}>
      <p className="font-semibold mb-2">Report this {REPORT_LABEL[targetType]}</p>
      <div className="flex flex-col gap-1.5">
        {REASONS[targetType].map((r) => (
          <label key={r} className="flex items-center gap-2 text-xs">
            <input type="radio" name={`report-reason-${targetId}`} value={r} checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <textarea
        className="mt-2 text-xs"
        rows={2}
        placeholder="Anything else we should know? (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          className="btn-primary text-xs py-1.5 px-3"
          disabled={isPending || !reason}
          onClick={() =>
            startTransition(async () => {
              const res = await submitReport(targetType, targetId, reason, description);
              if (res?.error) setError(res.error);
              else setDone(true);
            })
          }
        >
          {isPending ? "Submitting…" : "Submit report"}
        </button>
        <button type="button" className="text-xs text-[var(--muted)]" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
