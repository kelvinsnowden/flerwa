"use client";

import { useState, useTransition } from "react";
import { correctTransactionAmount, reassignProvider, forceResolveStuckTransaction } from "./repair-actions";

interface Props {
  transactionId: string;
  canCorrectAmount: boolean;
  canReassign: boolean;
  canForceResolve: boolean;
  serviceAmountKes: number;
  materialsAmountKes: number;
  clearedProviders: { id: string; display_name: string }[];
  serviceStillHeldKes: number;
}

type Tool = "amount" | "reassign" | "resolve" | null;

/** TXN-010 / OPS-002 repair tools. Each form only renders when the
 * transaction's current state allows that repair — mirrors the RPCs' own
 * server-side guards exactly, so this is a UX convenience, not the real
 * authorization boundary. */
export function RepairPanel({
  transactionId,
  canCorrectAmount,
  canReassign,
  canForceResolve,
  serviceAmountKes,
  materialsAmountKes,
  clearedProviders,
  serviceStillHeldKes,
}: Props) {
  const [open, setOpen] = useState<Tool>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [newService, setNewService] = useState(String(serviceAmountKes));
  const [newMaterials, setNewMaterials] = useState(String(materialsAmountKes));
  const [amountReason, setAmountReason] = useState("");

  const [newProviderId, setNewProviderId] = useState(clearedProviders[0]?.id ?? "");
  const [reassignReason, setReassignReason] = useState("");

  const [providerMinor, setProviderMinor] = useState("0");
  const [customerRefund, setCustomerRefund] = useState(String(serviceStillHeldKes));
  const [resolution, setResolution] = useState("");

  if (!canCorrectAmount && !canReassign && !canForceResolve) return null;

  if (done) {
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-2">Repair tools</h2>
        <div className="card p-4">
          <p className="badge-info inline-flex">{done}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold mb-2">Repair tools</h2>
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {canCorrectAmount && (
            <button className="pill-tab" data-active={open === "amount"} onClick={() => setOpen(open === "amount" ? null : "amount")}>
              Correct amount
            </button>
          )}
          {canReassign && (
            <button className="pill-tab" data-active={open === "reassign"} onClick={() => setOpen(open === "reassign" ? null : "reassign")}>
              Reassign provider
            </button>
          )}
          {canForceResolve && (
            <button className="pill-tab" data-active={open === "resolve"} onClick={() => setOpen(open === "resolve" ? null : "resolve")}>
              Force-resolve stuck job
            </button>
          )}
        </div>

        {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}

        {open === "amount" && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-[var(--muted)]">Only available before funding — the amount is locked once money moves.</p>
            <label className="text-xs font-medium">
              Service amount (KSh)
              <input type="number" min="0" value={newService} onChange={(e) => setNewService(e.target.value)} className="mt-1" />
            </label>
            <label className="text-xs font-medium">
              Materials amount (KSh)
              <input type="number" min="0" value={newMaterials} onChange={(e) => setNewMaterials(e.target.value)} className="mt-1" />
            </label>
            <input value={amountReason} onChange={(e) => setAmountReason(e.target.value)} placeholder="Reason (required)" />
            <button
              className="btn-primary text-sm"
              disabled={isPending || !amountReason.trim()}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await correctTransactionAmount(transactionId, Number(newService), Number(newMaterials), amountReason);
                  if (res?.error) setError(res.error);
                  else setDone("Amount corrected.");
                })
              }
            >
              {isPending ? "Saving…" : "Correct amount"}
            </button>
          </div>
        )}

        {open === "reassign" && (
          <div className="mt-3 flex flex-col gap-2">
            {!clearedProviders.length ? (
              <p className="text-xs text-[var(--danger)]">No other provider is cleared for this category — clear one first at /admin/providers.</p>
            ) : (
              <>
                <label className="text-xs font-medium">
                  New provider
                  <select value={newProviderId} onChange={(e) => setNewProviderId(e.target.value)} className="mt-1">
                    {clearedProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <input value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="Reason (required)" />
                <button
                  className="btn-primary text-sm"
                  disabled={isPending || !reassignReason.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const res = await reassignProvider(transactionId, newProviderId, reassignReason);
                      if (res?.error) setError(res.error);
                      else setDone("Provider reassigned.");
                    })
                  }
                >
                  {isPending ? "Saving…" : "Reassign"}
                </button>
              </>
            )}
          </div>
        )}

        {open === "resolve" && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-[var(--muted)]">
              Amount still held for the service portion: KSh {serviceStillHeldKes.toLocaleString()}. Provider + customer refund must add up to
              exactly that. This only proposes — a different admin must approve it from /admin/approvals before anything moves.
            </p>
            <label className="text-xs font-medium">
              To provider (KSh)
              <input type="number" min="0" value={providerMinor} onChange={(e) => setProviderMinor(e.target.value)} className="mt-1" />
            </label>
            <label className="text-xs font-medium">
              Refund to customer (KSh)
              <input type="number" min="0" value={customerRefund} onChange={(e) => setCustomerRefund(e.target.value)} className="mt-1" />
            </label>
            <textarea rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution notes (required, sent to both parties)" />
            <button
              className="btn-primary text-sm"
              disabled={isPending || !resolution.trim()}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await forceResolveStuckTransaction(transactionId, Number(providerMinor), Number(customerRefund), resolution);
                  if (res?.error) setError(res.error);
                  else setDone("Submitted for a second admin's approval.");
                })
              }
            >
              {isPending ? "Submitting…" : "Propose resolution"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
