"use client";

import { useState, useTransition } from "react";
import { requestPayout } from "./actions";
import { formatMoney } from "@/lib/money";

export function WithdrawForm({ availableMinor, hasPayoutPhone }: { availableMinor: number; hasPayoutPhone: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canWithdraw = hasPayoutPhone && availableMinor > 0;

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold mb-1">Withdraw</p>
      {!hasPayoutPhone ? (
        <p className="text-sm text-[var(--muted)]">Set a payout number above before withdrawing.</p>
      ) : availableMinor <= 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing available to withdraw yet.</p>
      ) : (
        <p className="text-sm text-[var(--muted)] mb-3">
          Withdraw your full available balance, {formatMoney(availableMinor, "KES")}.
        </p>
      )}
      {canWithdraw && (
        <button
          type="button"
          className="btn-primary w-full"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setDone(false);
              const res = await requestPayout();
              if (res?.error) setError(res.error);
              else setDone(true);
            })
          }
        >
          {isPending ? "Requesting…" : `Withdraw ${formatMoney(availableMinor, "KES")}`}
        </button>
      )}
      {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}
      {done && <p className="text-xs text-[var(--muted)] mt-2">Withdrawal requested — see History below.</p>}
    </div>
  );
}
