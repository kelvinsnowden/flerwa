import Link from "next/link";
import Image from "next/image";
import { Icon, type IconName } from "./icon";
import { formatMoney } from "@/lib/money";
import type { Service } from "@/lib/types";

export function RecommendedServiceCard({
  service,
  photoSrc,
  icon,
}: {
  service: Pick<Service, "slug" | "name" | "summary" | "base_price_minor" | "currency" | "turnaround_hours">;
  photoSrc: string;
  icon: IconName;
}) {
  return (
    <Link
      href={`/services/${service.slug}`}
      className="card card-shadow overflow-hidden flex flex-col hover:border-[var(--trust)] transition-colors"
    >
      <div className="relative w-full aspect-[4/3]">
        <Image src={photoSrc} alt="" fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover" />
        <span
          className="absolute top-2 left-2 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.9)", color: "var(--trust)" }}
        >
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm leading-tight">{service.name}</span>
          <Icon name="chevron-right" size={16} className="text-[var(--muted)] flex-shrink-0" />
        </div>
        <p className="text-xs text-[var(--muted)] line-clamp-2 leading-snug">{service.summary}</p>
        <p className="text-sm mt-1">
          From{" "}
          <span className="font-bold" style={{ color: "var(--trust)" }}>
            {formatMoney(service.base_price_minor, service.currency)}
          </span>
        </p>
        <div className="flex items-center gap-3 text-[11px] text-[var(--muted)] mt-1">
          <span className="flex items-center gap-1">
            <Icon name="clock" size={12} />
            {service.turnaround_hours}h turnaround
          </span>
          <span className="flex items-center gap-1">
            <Icon name="shield-check" size={12} />
            Verified pros
          </span>
        </div>
      </div>
    </Link>
  );
}
