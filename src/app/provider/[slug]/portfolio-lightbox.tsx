"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ReportButton } from "@/components/report/report-button";
import type { PortfolioItem } from "@/lib/types";

/**
 * Accessible media viewer for a portfolio item. Opened from
 * PortfolioGallery; renders on top of everything as a full-screen
 * overlay, same modal shell pattern already used by
 * src/app/provider/portfolio/portfolio-manager.tsx's item editor.
 *
 * - Escape closes; a visible close button always closes.
 * - Focus moves to the close button on open and is restored to the
 *   element that opened the lightbox on close.
 * - Native video plays in-app (muted by default, no autoplay — the
 *   customer presses play themselves); an external video link opens on
 *   its origin platform instead, since we don't host that content.
 * - CTAs reuse the EXISTING booking/message routes only — this never
 *   creates a new booking path.
 */
export function PortfolioLightbox({
  items,
  index,
  onClose,
  onNavigate,
  bookHref,
  requestSimilarHref,
  canReport,
}: {
  items: PortfolioItem[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
  bookHref: string | null;
  requestSimilarHref: string | null;
  canReport?: boolean;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && items.length > 1) {
        onNavigate((index - 1 + items.length) % items.length);
      } else if (e.key === "ArrowRight" && items.length > 1) {
        onNavigate((index + 1) % items.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, items.length, onClose, onNavigate]);

  const item = items[index];
  if (!item) return null;

  const isNativeVideo = item.media_type === "video" && item.video_source === "native" && item.video_url;
  const isExternalVideo = item.media_type === "video" && item.video_source !== "native" && item.video_url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption ?? "Portfolio item"}
      className="fixed inset-0 z-[60] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-end p-3">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-9 w-9 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70"
        >
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-2 relative min-h-0" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate((index - 1 + items.length) % items.length)}
            aria-label="Previous item"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70 z-10"
          >
            <Icon name="chevron-right" size={18} className="rotate-180" />
          </button>
        )}

        <div className="w-full h-full flex items-center justify-center">
          {isNativeVideo ? (
            <video
              key={item.id}
              src={item.video_url!}
              poster={item.photo_url}
              controls
              playsInline
              muted
              className="max-h-full max-w-full"
              style={{ maxHeight: "70vh" }}
            />
          ) : (
            <div className="relative w-full" style={{ maxHeight: "70vh", height: "70vh" }}>
              <Image src={item.photo_url} alt={item.caption ?? ""} fill className="object-contain" sizes="100vw" />
            </div>
          )}
        </div>

        {items.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % items.length)}
            aria-label="Next item"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70 z-10"
          >
            <Icon name="chevron-right" size={18} />
          </button>
        )}
      </div>

      <div className="bg-black text-white px-4 pt-3 pb-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }} onClick={(e) => e.stopPropagation()}>
        {(item.caption || item.tag || item.project_type || item.client_name) && (
          <div className="mb-3 text-sm">
            {item.caption && <p className="font-medium">{item.caption}</p>}
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-white/70">
              {item.tag && <span className="rounded-full bg-white/10 px-2 py-0.5">{item.tag}</span>}
              {item.project_type && <span className="rounded-full bg-white/10 px-2 py-0.5">{item.project_type}</span>}
              {item.client_name && <span className="rounded-full bg-white/10 px-2 py-0.5">For {item.client_name}</span>}
              {isExternalVideo && <span className="rounded-full bg-white/10 px-2 py-0.5">External video</span>}
            </div>
          </div>
        )}

        {canReport && (
          <div className="mb-3">
            <ReportButton
              targetType="portfolio_item"
              targetId={item.id}
              label="Report this item"
              className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
            />
          </div>
        )}

        {isExternalVideo && (
          <a
            href={item.video_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-1.5 text-sm text-white/90 hover:text-white"
          >
            <Icon name="external-link" size={14} />
            Watch the full video on its original platform
          </a>
        )}

        <div className="flex gap-2">
          {bookHref && (
            <Link href={bookHref} className="btn-primary flex-1 text-center">
              Book this creator
            </Link>
          )}
          {requestSimilarHref && (
            <Link href={requestSimilarHref} className="btn-secondary flex-1 text-center" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.3)" }}>
              Request similar content
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
