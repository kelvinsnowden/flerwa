import type { VerificationStatus } from "@/lib/types";

/**
 * The only place a "Verified" badge is allowed to render. Only the
 * `verified` status gets the trust-green treatment — every other status
 * either shows nothing (pending, not yet claim-worthy) or a neutral/warn
 * badge, never a fabricated trust signal. See SECURITY.md on verification
 * claims and QA_REPORT.md's trust-messaging audit.
 */
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "verified") {
    return (
      <span className="badge-trust">
        <CheckIcon /> Verified
      </span>
    );
  }
  if (status === "rejected" || status === "expired") {
    return null;
  }
  return null;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16.667 5L7.5 14.167 3.333 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
