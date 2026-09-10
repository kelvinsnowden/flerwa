import type { TxnState } from "@/lib/types";

const STEPS: { label: string; states: TxnState[] }[] = [
  { label: "Booked", states: ["requested", "quoted", "quote_accepted"] },
  { label: "Payment confirmed", states: ["funded", "scheduled"] },
  { label: "Professional on site", states: ["en_route", "checked_in", "in_progress"] },
  { label: "Report ready", states: ["evidence_submitted", "customer_review", "revision_requested"] },
  { label: "Completed", states: ["approved", "released", "settled", "reviewed", "closed"] },
];

const OFF_PATH: Partial<Record<TxnState, string>> = {
  cancelled_by_customer: "Cancelled by you",
  cancelled_by_provider: "Cancelled by the professional",
  expired: "This booking expired",
  disputed: "Under dispute review",
  refunded: "Refunded",
  draft: "Draft — not yet submitted",
};

/**
 * A real progress readout driven by service_transactions.state — the same
 * server-authoritative field every RPC writes. Never a client-guessed
 * step count: a state outside the happy path (cancelled/disputed/expired/
 * refunded) renders as its own honest banner instead of forcing it onto
 * the linear timeline.
 */
export function StatusTimeline({ state }: { state: TxnState }) {
  const offPathLabel = OFF_PATH[state];
  if (offPathLabel) {
    return (
      <div className="card p-4 text-sm font-medium" style={{ borderColor: "var(--warn)" }}>
        {offPathLabel}
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.states.includes(state));

  return (
    <ol className="flex flex-col gap-0">
      {STEPS.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        const upcoming = currentIndex >= 0 && i > currentIndex;
        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: done || active ? "var(--trust)" : "var(--surface)",
                  border: active ? "2px solid var(--trust)" : "1px solid var(--border)",
                }}
              >
                {done && (
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M16.667 5L7.5 14.167 3.333 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className="w-px flex-1 min-h-6"
                  style={{ background: done ? "var(--trust)" : "var(--border)" }}
                />
              )}
            </div>
            <p
              className="pb-6 text-sm"
              style={{
                fontWeight: active ? 700 : 500,
                color: upcoming ? "var(--muted)" : "var(--foreground)",
              }}
            >
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
