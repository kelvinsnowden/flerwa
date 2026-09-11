"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import type { PortfolioItem } from "@/lib/types";

export function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) if (item.tag) seen.add(item.tag);
    return Array.from(seen);
  }, [items]);

  const [filter, setFilter] = useState<string | null>(null);
  const visible = filter ? items.filter((i) => i.tag === filter) : items;

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

      <div className="grid grid-cols-3 gap-2">
        {visible.map((item) => {
          const content = (
            <>
              <Image src={item.photo_url} alt={item.caption ?? ""} fill className="object-cover" />
              {item.media_type === "video" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-8 w-8 rounded-full flex items-center justify-center bg-black/50 text-white">
                    <Icon name="video" size={16} />
                  </span>
                </span>
              )}
              {item.reach_label && (
                <span className="absolute bottom-1 left-1 text-[10px] font-semibold text-white bg-black/50 rounded-full px-1.5 py-0.5">
                  {item.reach_label}
                </span>
              )}
            </>
          );
          const className = "relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)] block";
          return item.media_type === "video" && item.video_url ? (
            <a key={item.id} href={item.video_url} target="_blank" rel="noopener noreferrer" className={className}>
              {content}
            </a>
          ) : (
            <div key={item.id} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
