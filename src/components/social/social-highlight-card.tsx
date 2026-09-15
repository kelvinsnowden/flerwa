import { Icon } from "@/components/ui/icon";
import { SOCIAL_PLATFORM_LABEL } from "@/lib/social-embed";
import type { SocialHighlight } from "@/lib/types";

/**
 * Safe fallback card for a creator-authorized Instagram/TikTok link —
 * NOT an embed. No iframe, no dangerouslySetInnerHTML, no third-party
 * script: post_url was already validated server-side against a fixed
 * hostname allowlist (src/lib/social-embed.ts) before this row could
 * ever exist, and this component only ever renders it as a plain,
 * clearly-labeled external link. If the underlying post is later
 * deleted or made private on the origin platform, this card still
 * renders fine — nothing here depends on the link resolving.
 */
export function SocialHighlightCard({ highlight }: { highlight: SocialHighlight }) {
  const platformLabel = SOCIAL_PLATFORM_LABEL[highlight.platform];
  return (
    <a
      href={highlight.post_url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="card p-4 flex flex-col gap-2 hover:border-[var(--trust)] transition-colors"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
        <Icon name={highlight.platform} size={14} />
        Social highlight · {platformLabel}
      </span>
      <span className="text-sm font-medium leading-snug line-clamp-2">
        {highlight.title || `View this creator's ${platformLabel} post`}
      </span>
      <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--trust)" }}>
        View on {platformLabel}
        <Icon name="external-link" size={12} />
      </span>
    </a>
  );
}
