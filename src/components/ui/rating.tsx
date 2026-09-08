/**
 * Renders a real average rating + review count. Never called with fabricated
 * numbers — callers that have no reliability_scores/reviews row for a
 * provider must not render this at all (see ProviderCard/provider profile),
 * so "no rating yet" is a real empty state, not a hidden zero.
 */
export function Rating({
  value,
  count,
  size = "sm",
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const fontSize = size === "md" ? "0.9375rem" : "0.8125rem";
  return (
    <span className="inline-flex items-center gap-1" style={{ fontSize }}>
      <StarIcon />
      <span className="font-semibold">{value.toFixed(1)}</span>
      {count != null && <span className="text-[var(--muted)]">({count})</span>}
    </span>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="#f5a623" aria-hidden="true">
      <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />
    </svg>
  );
}
