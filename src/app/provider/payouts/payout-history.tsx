import { formatMoney } from "@/lib/money";
import type { Payout } from "@/lib/types";

const STATE_LABEL: Record<Payout["state"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "badge-warn" },
  processing: { label: "Sending…", className: "badge-warn" },
  paid: { label: "Paid", className: "badge-trust" },
  failed: { label: "Needs attention", className: "badge-danger" },
};

export function PayoutHistory({ payouts }: { payouts: Payout[] }) {
  if (payouts.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No payouts yet — they&apos;ll show up here once a customer approves your work.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {payouts.map((p) => {
        const state = STATE_LABEL[p.state];
        return (
          <div key={p.id} className="card p-3 flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold">{formatMoney(p.amount_minor, p.currency)}</p>
              <p className="text-xs text-[var(--muted)]">{new Date(p.created_at).toLocaleString("en-KE")}</p>
              {p.state === "failed" && p.failure_reason && <p className="text-xs text-[var(--danger)] mt-1">{p.failure_reason}</p>}
            </div>
            <span className={state.className}>{state.label}</span>
          </div>
        );
      })}
    </div>
  );
}
