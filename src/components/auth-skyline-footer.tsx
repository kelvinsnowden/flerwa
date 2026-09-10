/**
 * The reference mockups show a thin decorative Nairobi-skyline line-art
 * silhouette + a handwritten "For a brighter Kenya" tagline at the foot
 * of the phone-entry screen. The line-art was meant to be a new SVGator
 * asset (per this session's own convention — see ASSETS.md), but SVGator
 * was failing to export even a single bare shape when this was built
 * (isolated with minimal repros, not a JSON mistake on this end) — so
 * this ships as the tagline alone rather than block on it or hand-author
 * the artwork against that convention. Swap in the real illustration
 * once SVGator is working again; nothing else needs to change.
 */
export function AuthSkylineFooter() {
  return (
    <p className="mt-auto pt-10 text-center text-xs text-[var(--muted-2)] italic">
      For a brighter Kenya
    </p>
  );
}
