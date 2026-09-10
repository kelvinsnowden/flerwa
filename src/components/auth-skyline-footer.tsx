import Image from "next/image";

/**
 * The reference mockups show a thin decorative Nairobi-skyline line-art
 * silhouette + a handwritten "For a brighter Kenya" tagline at the foot
 * of the phone-entry screen. A dedicated skyline SVGator asset was never
 * produced (SVGator was failing to export at the time — see git history),
 * so this reuses the existing "kenya-gets-things-done" illustration
 * instead of shipping an empty gap. Swap in a purpose-built skyline asset
 * later if desired; nothing else needs to change.
 */
export function AuthSkylineFooter() {
  return (
    <div className="mt-auto pt-10 flex flex-col items-center gap-3">
      <Image
        src="/images/illustrations/kenya-gets-things-done.svg"
        alt=""
        width={200}
        height={150}
        className="w-40 h-auto"
      />
      <p className="text-center text-xs text-[var(--muted-2)] italic">
        For a brighter Kenya
      </p>
    </div>
  );
}
