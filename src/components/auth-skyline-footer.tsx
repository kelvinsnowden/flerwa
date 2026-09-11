"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Slide {
  src: string;
  alt: string;
  caption: string;
}

// Three different professionals across three real categories on the
// platform (Personal, Errands & Tasks, Business & Creator Services) —
// supplied directly for this slideshow. Every slide shares one caption
// rather than a per-photo claim like "personal chefs available" — the
// catalogue's actual services vary by what's really been seeded/listed,
// and this tagline stays true regardless. Adding more is a one-line
// change: just append to SLIDES.
const SLIDES: Slide[] = [
  {
    src: "/images/professionals/personal-chef.png",
    alt: "A personal chef plating a dish",
    caption: "Kenyans Get Things Done",
  },
  {
    src: "/images/professionals/errands-shopper.png",
    alt: "A professional running errands in Nairobi",
    caption: "Kenyans Get Things Done",
  },
  {
    src: "/images/professionals/content-creator.png",
    alt: "A content creator filming with a ring light",
    caption: "Kenyans Get Things Done",
  },
];

const ROTATE_MS = 4500;

/**
 * The bottom band shared by every auth screen per design-references/
 * mobile/{01-login,02-otp}.png: pagination dots + a caption. Auto-rotates
 * through SLIDES; dots are tappable to jump directly to a slide. The
 * `activeDot` prop from earlier callers is gone — both existing call
 * sites always passed 0, so the dots were never actually used to show
 * cross-screen progress; they're free to become real slideshow pagination.
 */
export function AuthSkylineFooter() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="mt-auto pt-8 flex flex-col items-center gap-4">
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured slide">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className="rounded-full transition-all"
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              background: i === index ? "var(--trust)" : "var(--border)",
            }}
          />
        ))}
      </div>

      <div
        className="relative w-full max-w-[220px] aspect-square rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          sizes="220px"
          className="object-contain"
        />
      </div>
      <p className="text-sm italic font-semibold" style={{ color: "var(--trust-dark)" }}>
        {slide.caption}
      </p>

      <p className="text-center text-[11px] font-semibold tracking-[0.2em] text-[var(--muted-2)]">
        SAFE · SIMPLE · TRUSTED
      </p>
    </div>
  );
}
