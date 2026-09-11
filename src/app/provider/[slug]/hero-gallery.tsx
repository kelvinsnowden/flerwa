"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";

export function HeroGallery({ photoUrls, alt }: { photoUrls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);

  if (photoUrls.length === 0) {
    return (
      <div
        className="relative w-full aspect-[4/5] flex items-center justify-center"
        style={{ background: "var(--surface)" }}
      >
        <Icon name="camera" size={32} className="text-[var(--muted-2)]" />
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/5] bg-[var(--surface)]">
      <Image src={photoUrls[index]} alt={alt} fill className="object-cover" priority />
      {photoUrls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center bg-black/40 text-white"
          >
            <Icon name="chevron-right" size={16} className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % photoUrls.length)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center bg-black/40 text-white"
          >
            <Icon name="chevron-right" size={16} />
          </button>
          <span className="absolute bottom-3 right-3 text-xs font-semibold text-white bg-black/40 rounded-full px-2 py-0.5">
            {index + 1}/{photoUrls.length}
          </span>
        </>
      )}
    </div>
  );
}
