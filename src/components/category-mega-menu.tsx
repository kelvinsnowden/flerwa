"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

export interface NavCategory {
  slug: string;
  name: string;
  icon: string | null;
  services: { slug: string; name: string }[];
}

/**
 * A persistent, always-reachable category browse point in the header —
 * previously discovery only existed as a section partway down the
 * homepage, invisible from every other page and requiring a scroll even
 * there. Same categories/services data the homepage's own "Browse by
 * category" section already uses, just made reachable from anywhere.
 */
export function CategoryMegaMenu({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!categories.length) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)]"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Browse
        <Icon name="chevron-right" size={12} className={open ? "-rotate-90 transition-transform" : "rotate-90 transition-transform"} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] max-w-[560px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] shadow-lg p-4 grid grid-cols-2 gap-x-6 gap-y-5"
          role="menu"
        >
          {categories.map((c) => (
            <div key={c.slug}>
              <Link
                href={`/?category=${c.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 font-semibold text-sm mb-2 hover:text-[var(--trust)]"
              >
                <Icon name={(c.icon as IconName | null) ?? "grid"} size={16} className="text-[var(--trust)] flex-shrink-0" />
                {c.name}
              </Link>
              <ul className="flex flex-col gap-1.5">
                {c.services.slice(0, 5).map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/services/${s.slug}`}
                      onClick={() => setOpen(false)}
                      className="text-sm text-[var(--muted)] hover:text-[var(--trust)]"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
                {c.services.length === 0 && <li className="text-xs text-[var(--muted)]">Coming soon</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
