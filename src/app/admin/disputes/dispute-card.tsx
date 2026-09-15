"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { resolveDispute, assignDispute } from "./actions";

interface Props {
  dispute: {
    id: string;
    reason: string;
    description: string | null;
    createdAt: string;
    serviceAmountMinor: number;
    currency: string;
    serviceName: string;
    providerName: string;
    customerName: string;
    assignedTo: string | null;
    state: string;
    slaDeadline: string | null;
    escalatedAt: string | null;
    overdueNotifiedAt: string | null;
  };
  admins: { id: string; full_name: string | null }[];
}

export function DisputeCard({ dispute, admins }: Props) {
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isAssigning, startAssign] = useTransition();
  const [split, setSplit] = useState<"provider" | "customer" | "custom">("provider");
  const [customProviderKes, setCustomProviderKes] = useState(String(dispute.serviceAmountMinor / 100 / 2));
  const [resolution, setResolution] = useState("");
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (resolved) {
    return (
      <div className="card p-4">
        <p className="badge-info inline-flex mb-1">Submitted for approval</p>
        <p className="text-sm text-[var(--muted)]">
          A different trust &amp; safety or finance admin needs to approve this from{" "}
          <a href="/admin/approvals" className="underline">
            /admin/approvals
          </a>{" "}
          before any funds actually move (dual control — GOV-P4).
        </p>
      </div>
    );
  }

  const providerMinor =
    split === "provider"
      ? dispute.serviceAmountMinor
      : split === "customer"
        ? 0
        : Math.round(Number(customProviderKes || 0) * 100);
  const customerRefundMinor = dispute.serviceAmountMinor - providerMinor;
  const validSplit = providerMinor >= 0 && customerRefundMinor >= 0 && providerMinor <= dispute.serviceAmountMinor;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{dispute.serviceName}</p>
          <p className="text-xs text-[var(--muted)]">
            {dispute.customerName} vs {dispute.providerName} · {formatMoney(dispute.serviceAmountMinor, dispute.currency)}
          </p>
        </div>
        <span className={dispute.overdueNotifiedAt ? "badge-danger" : dispute.state === "under_review" ? "badge-warn" : "badge-info"}>
          {dispute.state === "under_review" ? "mediation" : "open"}
        </span>
      </div>

      <p className="text-sm mt-2 font-medium">{dispute.reason}</p>
      {dispute.description && <p className="text-sm text-[var(--muted)] mt-1">{dispute.description}</p>}
      <p className="text-xs text-[var(--muted-2)] mt-1">
        Opened {new Date(dispute.createdAt).toLocaleString("en-KE")}
      </p>
      {dispute.overdueNotifiedAt ? (
        <p className="text-xs text-[var(--danger)] font-medium mt-1">
          Overdue for adjudication since {new Date(dispute.slaDeadline!).toLocaleString("en-KE")} — needs a decision today.
        </p>
      ) : dispute.slaDeadline ? (
        <p className="text-xs text-[var(--muted-2)] mt-1">
          {dispute.escalatedAt
            ? `Escalated to mediation ${new Date(dispute.escalatedAt).toLocaleString("en-KE")} — respond by ${new Date(dispute.slaDeadline).toLocaleString("en-KE")}`
            : `Respond by ${new Date(dispute.slaDeadline).toLocaleString("en-KE")}`}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs font-medium" htmlFor={`assignee-${dispute.id}`}>
          Assigned to
        </label>
        <select
          id={`assignee-${dispute.id}`}
          defaultValue={dispute.assignedTo ?? ""}
          disabled={isAssigning}
          onChange={(e) =>
            startAssign(async () => {
              setAssignError(null);
              const res = await assignDispute(dispute.id, e.target.value || null);
              if (res?.error) setAssignError(res.error);
            })
          }
          className="text-xs border rounded px-2 py-1"
        >
          <option value="">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.id.slice(0, 8)}
            </option>
          ))}
        </select>
        {assignError && <span className="text-xs text-[var(--danger)]">{assignError}</span>}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium mb-1">Resolution split</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pill-tab" data-active={split === "provider"} onClick={() => setSplit("provider")}>
            Full pay to professional
          </button>
          <button type="button" className="pill-tab" data-active={split === "customer"} onClick={() => setSplit("customer")}>
            Full refund to customer
          </button>
          <button type="button" className="pill-tab" data-active={split === "custom"} onClick={() => setSplit("custom")}>
            Custom split
          </button>
        </div>
        {split === "custom" && (
          <label className="text-xs font-medium mt-2 block">
            Amount to professional (KSh)
            <input
              type="number"
              min="0"
              max={dispute.serviceAmountMinor / 100}
              value={customProviderKes}
              onChange={(e) => setCustomProviderKes(e.target.value)}
              className="mt-1"
            />
          </label>
        )}
        <p className="text-xs text-[var(--muted)] mt-1">
          Professional gets {formatMoney(providerMinor, dispute.currency)}, customer refunded {formatMoney(customerRefundMinor, dispute.currency)}.
        </p>
      </div>

      <textarea
        className="mt-3"
        rows={2}
        placeholder="Resolution notes (sent to both parties)"
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
      />
      {error && <p className="text-sm text-[var(--danger)] mt-1">{error}</p>}

      <button
        className="btn-primary text-sm mt-3"
        disabled={isPending || !validSplit || !resolution.trim()}
        onClick={() =>
          startTransition(async () => {
            const res = await resolveDispute(dispute.id, providerMinor, customerRefundMinor, resolution);
            if (res?.error) setError(res.error);
            else setResolved(true);
          })
        }
      >
        {isPending ? "Submitting…" : "Propose resolution"}
      </button>
    </div>
  );
}
