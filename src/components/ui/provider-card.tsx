import Link from "next/link";
import { Avatar } from "./avatar";
import { Rating } from "./rating";
import { VerificationBadge } from "./verification-badge";
import { SaveButton } from "./save-button";
import type { Provider, ReliabilityScore } from "@/lib/types";

export function ProviderCard({
  provider,
  photoUrl,
  reliability,
  saved,
  selectHref,
}: {
  provider: Pick<Provider, "id" | "slug" | "display_name" | "headline" | "verification_status">;
  photoUrl?: string | null;
  reliability?: ReliabilityScore | null;
  /** Omit entirely (rather than false) when the viewer isn't signed in — hides the button instead of showing a save action that would just fail. */
  saved?: boolean;
  /** When given, renders a "Select" button (booking-flow provider picker) alongside the card's normal tap-through-to-profile behaviour. */
  selectHref?: string;
}) {
  return (
    <div className="relative card card-shadow p-4 flex items-center gap-3 hover:border-[var(--trust)] transition-colors">
      <Link href={`/provider/${provider.slug}`} className="absolute inset-0 z-0" aria-label={provider.display_name} />
      <Avatar name={provider.display_name} photoUrl={photoUrl} />
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
      {saved !== undefined && (
        <div className="relative z-10">
          <SaveButton providerId={provider.id} initialSaved={saved} size="sm" />
        </div>
      )}
      {selectHref && (
        <Link href={selectHref} className="btn-primary text-xs px-3 py-1.5 relative z-10 whitespace-nowrap">
          Select
        </Link>
      )}
    </div>
  );
}
