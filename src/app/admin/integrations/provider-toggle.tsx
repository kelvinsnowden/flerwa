"use client";

import { useState, useTransition } from "react";
import { setActivePaymentProvider, setActiveVerificationProvider } from "./actions";

interface Row {
  key: string;
  display_name: string;
  is_active: boolean;
  connected_at: string | null;
}

export function ProviderToggleList({ kind, rows }: { kind: "payment" | "verification"; rows: Row[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const action = kind === "payment" ? setActivePaymentProvider : setActiveVerificationProvider;

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.key} className="card p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{row.display_name}</p>
            <p className="text-xs text-[var(--muted)]">
              {row.is_active ? (
                <span className="badge-trust">Active</span>
              ) : (
                `key: ${row.key}`
              )}
              {row.is_active && row.connected_at && (
                <span className="ml-2">since {new Date(row.connected_at).toLocaleDateString()}</span>
              )}
            </p>
          </div>
          {!row.is_active && (
            <button
              type="button"
              className="btn-secondary text-xs shrink-0"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const res = await action(row.key);
                  if (res?.error) setError(res.error);
                })
              }
            >
              Make active
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
