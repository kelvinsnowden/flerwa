import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { StateBadge } from "./state-badge";
import type { TxnState } from "@/lib/types";

export function BookingCard({
  href,
  title,
  subtitle,
  state,
  amountMinor,
  currency,
}: {
  href: string;
  title: string;
  subtitle: string;
  state: TxnState;
  amountMinor: number;
  currency: string;
}) {
  return (
    <Link
      href={href}
      className="card card-shadow p-4 flex items-center justify-between gap-3 hover:border-[var(--trust)] transition-colors"
    >
      <div className="min-w-0">
        <p className="font-semibold truncate">{title}</p>
        <p className="text-sm text-[var(--muted)] truncate">{subtitle}</p>
        <div className="mt-1.5">
          <StateBadge state={state} />
        </div>
      </div>
      <p className="font-bold text-sm whitespace-nowrap">{formatMoney(amountMinor, currency)}</p>
    </Link>
  );
}
