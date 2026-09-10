"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { resolveDispute } from "./actions";

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
  };
}

export function DisputeCard({ dispute }: Props) {
  const [split, setSplit] = useState<"provider" | "customer" | "custom">("provider");
  const [customProviderKes, setCustomProviderKes] = useState(String(dispute.serviceAmountMinor / 100 / 2));
  const [resolution, setResolution] = useState("");
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (resolved) {
    return (
      <div className="card p-4">
        <p className="badge-trust inline-flex">Resolved</p>
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
        <span className="badge-warn">open</span>
      </div>

      <p className="text-sm mt-2 font-medium">{dispute.reason}</p>
      {dispute.description && <p className="text-sm text-[var(--muted)] mt-1">{dispute.description}</p>}
      <p className="text-xs text-[var(--muted-2)] mt-1">
        Opened {new Date(dispute.createdAt).toLocaleString("en-KE")}
      </p>

      <div className="mt-3">
        <p className="text-xs font-medium mb-1">Resolution split</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pill-tab" data-active={split === "provider"} onClick={() => setSplit("provider")}>
            Full pay to Pro
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
            Amount to Pro (KSh)
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
          Pro gets {formatMoney(providerMinor, dispute.currency)}, customer refunded {formatMoney(customerRefundMinor, dispute.currency)}.
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
        {isPending ? "Resolving…" : "Resolve dispute"}
      </button>
    </div>
  );
}
