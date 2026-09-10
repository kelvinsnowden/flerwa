import Image from "next/image";

/**
 * The bottom band shared by every auth screen per design-references/
 * mobile/{01-login,02-otp}.png: pagination dots, a green skyline
 * illustration with the "Kenya Gets Things Done" tag overlaid top-left,
 * and a "SAFE · SIMPLE · TRUSTED" caption. A dedicated wide-format
 * SVGator skyline asset was never produced (SVGator was failing to
 * export at the time — see git history), so this reuses the existing
 * "kenya-gets-things-done" illustration rather than shipping an empty
 * gap. The mockups' handwritten script font also isn't part of this
 * project's type system, so the tag ships in italic body type instead.
 */
export function AuthSkylineFooter({ activeDot = 0 }: { activeDot?: 0 | 1 | 2 }) {
  return (
    <div className="mt-auto pt-8 flex flex-col items-center gap-4">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: i === activeDot ? 16 : 6,
              height: 6,
              background: i === activeDot ? "var(--trust)" : "var(--border)",
            }}
          />
        ))}
      </div>

      <Image
        src="/images/illustrations/kenya-gets-things-done.svg"
        alt=""
        width={400}
        height={300}
        className="w-full max-w-[220px] h-auto rounded-2xl"
      />
      <p className="text-sm italic font-semibold" style={{ color: "var(--trust-dark)" }}>
        Kenya Gets Things Done
      </p>

      <p className="text-center text-[11px] font-semibold tracking-[0.2em] text-[var(--muted-2)]">
        SAFE · SIMPLE · TRUSTED
      </p>
    </div>
  );
}
