import { Icon } from "./icon";

const SIGNALS = [
  { icon: "wallet", label: "Payment held until you confirm" },
  { icon: "shield-check", label: "ID-verified pros only" },
  { icon: "file-text", label: "Every job comes with evidence" },
] as const;

/**
 * Static, generic trust claims the platform can actually back today —
 * deliberately NOT a place for numbers (X providers verified, Y jobs
 * done) unless a real aggregate query backs them. See SECURITY.md and
 * QA_REPORT.md's trust-messaging audit on why fabricated counts are
 * treated as a defect, not a style choice.
 */
export function TrustSignal() {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
      {SIGNALS.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <Icon name={s.icon} size={16} className="text-[var(--trust)]" />
          {s.label}
        </span>
      ))}
    </div>
  );
}
