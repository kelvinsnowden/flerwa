import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Service } from "@/lib/types";

export function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/services/${service.slug}`}
      className="card card-shadow p-4 flex flex-col gap-1 hover:border-[var(--trust)] transition-colors"
    >
      <span className="font-semibold leading-snug">{service.name}</span>
      <span className="text-sm text-[var(--muted)] line-clamp-2">{service.summary}</span>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-[var(--muted)]">
          From <span className="font-bold" style={{ color: "var(--trust)" }}>{formatMoney(service.base_price_minor, service.currency)}</span>
        </span>
        <span className="text-xs text-[var(--muted)]">{service.turnaround_hours}h turnaround</span>
      </div>
    </Link>
  );
}
