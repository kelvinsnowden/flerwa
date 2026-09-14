import { formatMoney } from "@/lib/money";
import { MILESTONE_LABELS, type TransactionMilestone } from "@/lib/types";

/**
 * Renders nothing for a normal-sized transaction (no milestone rows at
 * all) — only jobs over KSh 25,000 get staged payment structure, per
 * docs/07-payments.md. See the milestone-payments migration for the
 * release triggers (scope_agreement at funding, materials at check-in,
 * balance at customer approval).
 */
export function MilestonesCard({ milestones, currency }: { milestones: TransactionMilestone[]; currency: string }) {
  if (!milestones.length) return null;

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-[var(--muted)] mb-2">Payment milestones</p>
      <dl className="text-sm space-y-2">
        {milestones.map((m) => (
          <div key={m.id} className="flex items-center justify-between">
            <dt className="text-[var(--muted)]">{MILESTONE_LABELS[m.kind]}</dt>
            <dd className="flex items-center gap-2">
              <span className="font-medium">{formatMoney(m.amount_minor, currency)}</span>
              <span className={m.state === "released" ? "badge-trust" : "badge-warn"}>
                {m.state === "released" ? "Released" : "Pending"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
