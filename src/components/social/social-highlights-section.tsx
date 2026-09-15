import type { SocialHighlight } from "@/lib/types";
import { SocialHighlightCard } from "./social-highlight-card";

/**
 * Supplementary section only — the native portfolio (PortfolioGallery)
 * remains the primary, always-first content-discovery experience on the
 * storefront. This section is skipped entirely when a provider hasn't
 * added any social highlights, never showing an empty promotional block.
 */
export function SocialHighlightsSection({ highlights }: { highlights: SocialHighlight[] }) {
  if (highlights.length === 0) return null;

  return (
    <div id="social" className="pt-8 scroll-mt-28">
      <h2 className="font-semibold mb-1">Social highlights</h2>
      <p className="text-xs text-[var(--muted)] mb-3">
        From this creator&apos;s Instagram and TikTok — view the original post on its own platform.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {highlights.map((h) => (
          <SocialHighlightCard key={h.id} highlight={h} />
        ))}
      </div>
    </div>
  );
}
