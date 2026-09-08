import Link from "next/link";
import { Avatar } from "./avatar";
import { Rating } from "./rating";
import { VerificationBadge } from "./verification-badge";
import type { Provider, ReliabilityScore } from "@/lib/types";

export function ProviderCard({
  provider,
  reliability,
}: {
  provider: Pick<Provider, "slug" | "display_name" | "headline" | "verification_status">;
  reliability?: ReliabilityScore | null;
}) {
  return (
    <Link
      href={`/provider/${provider.slug}`}
      className="card card-shadow p-4 flex items-center gap-3 hover:border-[var(--trust)] transition-colors"
    >
      <Avatar name={provider.display_name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{provider.display_name}</span>
          <VerificationBadge status={provider.verification_status} />
        </div>
        {provider.headline && (
          <p className="text-sm text-[var(--muted)] truncate">{provider.headline}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted)]">
          {reliability?.avg_rating != null ? (
            <Rating value={reliability.avg_rating} count={reliability.sample_size} />
          ) : (
            <span>New provider</span>
          )}
          {reliability?.jobs_completed != null && reliability.jobs_completed > 0 && (
            <span>{reliability.jobs_completed} jobs done</span>
          )}
        </div>
      </div>
    </Link>
  );
}
