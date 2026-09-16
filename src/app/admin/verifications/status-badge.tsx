import type { VerificationStatus } from "@/lib/types";

// Real enum values only (see verification_status in the schema) — no
// fabricated "Resubmitted" or "Flagged" states. "submitted" is labeled
// "Pending" here because that's what it means to an admin (awaiting
// their review) even though the enum's own literal value differs.
export const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: "Incomplete",
  submitted: "Pending",
  under_review: "Under review",
  verified: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

const STATUS_CLASS: Record<VerificationStatus, string> = {
  pending: "badge-muted",
  submitted: "badge-warn",
  under_review: "badge-info",
  verified: "badge-trust",
  rejected: "badge-danger",
  expired: "badge-danger",
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}
