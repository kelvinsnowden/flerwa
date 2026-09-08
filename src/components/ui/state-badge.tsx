import type { TxnState } from "@/lib/types";
import { TXN_STATE_LABELS } from "@/lib/types";

const TONE: Record<TxnState, "trust" | "warn" | "info" | "muted" | "danger"> = {
  draft: "muted",
  requested: "info",
  quoted: "info",
  quote_accepted: "info",
  funded: "trust",
  scheduled: "trust",
  en_route: "trust",
  checked_in: "trust",
  in_progress: "trust",
  evidence_submitted: "warn",
  customer_review: "warn",
  revision_requested: "warn",
  approved: "trust",
  released: "trust",
  settled: "trust",
  reviewed: "muted",
  closed: "muted",
  cancelled_by_customer: "muted",
  cancelled_by_provider: "muted",
  expired: "muted",
  disputed: "danger",
  refunded: "muted",
};

export function StateBadge({ state }: { state: TxnState }) {
  const tone = TONE[state];
  const className =
    tone === "trust"
      ? "badge-trust"
      : tone === "warn"
        ? "badge-warn"
        : tone === "info"
          ? "badge-info"
          : tone === "danger"
            ? "badge-danger"
            : "badge-muted";
  return <span className={className}>{TXN_STATE_LABELS[state]}</span>;
}
