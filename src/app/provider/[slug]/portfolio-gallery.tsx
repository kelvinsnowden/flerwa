"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import type { PortfolioItem } from "@/lib/types";
import { PortfolioLightbox } from "./portfolio-lightbox";

export function PortfolioGallery({
  items,
  bookHref,
  requestSimilarHref,
  canReport,
}: {
  items: PortfolioItem[];
  bookHref: string | null;
  requestSimilarHref: string | null;
  canReport?: boolean;
}) {
  // Category chips are built entirely from real, provider-entered tags —
  // never a fixed/fabricated taxonomy. Only a category that at least one
  // real item actually uses ever appears here.
  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) if (item.tag) seen.add(item.tag);
    return Array.from(seen);
  }, [items]);

  const [filter, setFilter] = useState<string | null>(null);
  const filtered = filter ? items.filter((i) => i.tag === filter) : items;
  // Featured items surface first within whatever filter is active —
  // still only ever the provider's own real items, just reordered.
  const visible = useMemo(
    () => [...filtered].sort((a, b) => Number(b.is_featured) - Number(a.is_featured)),
    [filtered]
  );

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={
              filter === null
                ? { background: "var(--trust-dark)", color: "white" }
                : { background: "var(--surface)", color: "var(--muted)" }
            }
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilter(tag)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={
                filter === tag
                  ? { background: "var(--trust-dark)", color: "white" }
                  : { background: "var(--surface)", color: "var(--muted)" }
              }
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {visible.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={item.caption ? `View: ${item.caption}` : "View portfolio item"}
            className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)] block text-left"
          >
            <Image
              src={item.photo_url}
              alt={item.caption ?? ""}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {item.media_type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-8 w-8 rounded-full flex items-center justify-center bg-black/50 text-white">
                  <Icon name="video" size={16} />
                </span>
              </span>
            )}
            {item.is_featured && (
              <span className="absolute top-1 left-1 h-5 w-5 rounded-full flex items-center justify-center bg-black/50 text-white">
                <Icon name="star" size={11} />
              </span>
            )}
            {item.reach_label && (
              <span className="absolute bottom-1 left-1 text-xs font-semibold text-white bg-black/50 rounded-full px-1.5 py-0.5">
                {item.reach_label}
              </span>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <PortfolioLightbox
          items={visible}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          bookHref={bookHref}
          requestSimilarHref={requestSimilarHref}
          canReport={canReport}
        />
      )}
    </div>
  );
}
