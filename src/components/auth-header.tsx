import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * The centered brand lockup shared by every auth screen (phone entry,
 * OTP, email login, signup) per the reference mockups — replaces each
 * screen's own ad-hoc header. `backHref` is optional since the phone
 * entry screen (the flow's root) has nothing to go back to.
 *
 * `showHelp` renders the "Need help?" pill from the mockups top-right.
 * It's decorative only (no support inbox exists yet to link it to) —
 * an honest simplification rather than a link to nowhere.
 */
export function AuthHeader({
  backHref,
  backLabel = "Back",
  showHelp = false,
}: {
  backHref?: string;
  backLabel?: string;
  showHelp?: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center text-center mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="absolute left-0 top-1 text-sm text-[var(--muted)] flex items-center gap-1"
        >
          <Icon name="chevron-right" size={14} className="rotate-180" />
          {backLabel}
        </Link>
      )}
      {showHelp && (
        <span className="absolute right-0 top-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
          <Icon name="message-circle" size={13} className="text-[var(--trust)]" />
          Need help?
        </span>
      )}
      <span
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
        style={{ background: "var(--trust)" }}
      >
        <Icon name="shield-check" size={26} />
      </span>
      <p className="mt-2 font-bold text-lg leading-tight">
        Trusted<span style={{ color: "var(--trust)" }}>Services</span>
      </p>
      <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--muted-2)]">KENYA</p>
    </div>
  );
}
