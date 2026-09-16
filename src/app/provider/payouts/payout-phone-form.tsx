"use client";

import { useState, useTransition } from "react";
import { setPayoutPhone } from "./actions";
import { formatKenyanPhoneDisplay } from "@/lib/phone";

export function PayoutPhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold mb-1">Payout number</p>
      {currentPhone ? (
        <p className="text-sm text-[var(--muted)] mb-3">
          Currently set to <span className="font-mono">{formatKenyanPhoneDisplay(currentPhone)}</span>.
        </p>
      ) : (
        <p className="text-sm text-[var(--danger)] mb-3">
          No payout number on file yet — automatic payouts can&apos;t be sent until you set one.
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="tel"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDone(false);
          }}
          placeholder="0712345678"
          className="flex-1"
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={isPending || !value.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await setPayoutPhone(value);
              if (res?.error) setError(res.error);
              else {
                setDone(true);
                setValue("");
              }
            })
          }
        >
          {isPending ? "Saving…" : currentPhone ? "Update" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}
      {done && <p className="text-xs text-[var(--muted)] mt-2">Payout number updated.</p>}
    </div>
  );
}
