import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * The centered brand lockup shared by every auth screen (phone entry,
 * OTP, email login, signup) per the reference mockups — replaces each
 * screen's own ad-hoc header. `backHref` is optional since the phone
 * entry screen (the flow's root) has nothing to go back to.
 */
export function AuthHeader({ backHref, backLabel = "Back" }: { backHref?: string; backLabel?: string }) {
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
