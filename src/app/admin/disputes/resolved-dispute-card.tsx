import Link from "next/link";
import { formatMoney } from "@/lib/money";

interface Props {
  transactionId: string;
  reason: string;
  description: string | null;
  createdAt: string;
  serviceAmountMinor: number;
  currency: string;
  serviceName: string;
  providerName: string;
  customerName: string;
  state: string;
  resolution: string | null;
  financialOutcome: { provider_minor?: number; customer_refund_minor?: number } | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
}

export function ResolvedDisputeCard(d: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{d.serviceName}</p>
          <p className="text-xs text-[var(--muted)] truncate">
            {d.customerName} vs {d.providerName} · {formatMoney(d.serviceAmountMinor, d.currency)}
          </p>
        </div>
        <span className={d.state === "withdrawn" ? "badge-muted" : "badge-trust"}>
          {d.state === "withdrawn" ? "Withdrawn" : "Resolved"}
        </span>
      </div>

      <p className="text-sm mt-2 font-medium">{d.reason}</p>
      {d.description && <p className="text-sm text-[var(--muted)] mt-1">{d.description}</p>}

      {d.resolution && (
        <div className="mt-2 bg-[var(--surface)] rounded-[var(--radius-sm)] p-2.5">
          <p className="text-xs font-semibold mb-0.5">Resolution</p>
          <p className="text-sm">{d.resolution}</p>
          {d.financialOutcome && (
            <p className="text-xs text-[var(--muted)] mt-1">
              Professional got {formatMoney(d.financialOutcome.provider_minor ?? 0, d.currency)}, customer refunded{" "}
              {formatMoney(d.financialOutcome.customer_refund_minor ?? 0, d.currency)}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--muted-2)] mt-2">
        Opened {new Date(d.createdAt).toLocaleString("en-KE")}
        {d.resolvedAt && (
          <>
            {" "}
            · {d.state === "withdrawn" ? "Withdrawn" : "Resolved"} {new Date(d.resolvedAt).toLocaleString("en-KE")}
            {d.resolvedByName && ` by ${d.resolvedByName}`}
          </>
        )}
      </p>
      <Link href={`/admin/bookings/${d.transactionId}`} className="text-xs text-[var(--info)] hover:underline mt-1.5 inline-block">
        View booking
      </Link>
    </div>
  );
}
