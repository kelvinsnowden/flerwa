"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";

/**
 * Submits to the CURRENT admin page's own `q` search param rather than a
 * fabricated cross-entity search — there is no unified search backend
 * across providers/customers/bookings/transactions yet. Each admin list
 * page that supports search reads searchParams.q itself (see
 * /admin/verifications). Navigating to a page with no search support is
 * still safe: the param is just inert until that page adopts it.
 */
export function AdminTopbar({ unreadNotifications, onOpenMobileMenu }: { unreadNotifications: number; onOpenMobileMenu: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 h-16 bg-white"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <button type="button" className="md:hidden text-[var(--muted)]" onClick={onOpenMobileMenu} aria-label="Open menu">
        <Icon name="menu" size={20} />
      </button>

      <form
        className="flex-1 max-w-md relative"
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams(searchParams.toString());
          if (query.trim()) params.set("q", query.trim());
          else params.delete("q");
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search providers, customers, bookings..."
          className="w-full pl-9 pr-14 !min-h-0 !py-2 text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        />
        <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--muted-2)] border border-[var(--border)] rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </form>

      <Link href="/notifications" className="relative p-2 rounded-full hover:bg-[var(--surface)] text-[var(--muted)]" aria-label="Notifications">
        <Icon name="bell" size={19} />
        {unreadNotifications > 0 && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full"
            style={{ background: "var(--danger)" }}
            aria-label={`${unreadNotifications} unread`}
          />
        )}
      </Link>

      <Link href="/" className="btn-secondary text-xs px-3 py-1.5 hidden sm:inline-flex">
        View site
        <Icon name="external-link" size={13} />
      </Link>
    </header>
  );
}
