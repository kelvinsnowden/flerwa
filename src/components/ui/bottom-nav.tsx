"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
import type { UserRole } from "@/lib/types";

/**
 * The authenticated mobile app shell's tab bar — Home / Bookings /
 * Messages / Profile, matching the reference designs' actual bottom nav.
 * (An earlier pass substituted Notifications for Messages here because
 * no messaging schema existed yet; now that real in-app messaging is
 * wired up — see supabase/migrations/20260910080000_extend_messaging.sql
 * — this reflects the real reference nav. Notifications is still real
 * and still reachable, just no longer a primary tab: see its link on
 * /account and in the desktop header.)
 */
export function BottomNav({ role, unreadCount }: { role: UserRole | null; unreadCount?: number }) {
  const pathname = usePathname();
  const bookingsHref = role === "provider" ? "/provider" : "/account/bookings";

  const items = [
    { href: "/", label: "Home", icon: "home", match: (p: string) => p === "/" },
    {
      href: bookingsHref,
      label: "Bookings",
      icon: "calendar",
      match: (p: string) => p.startsWith("/account/bookings") || p.startsWith("/provider/jobs") || p === "/provider",
    },
    {
      href: "/messages",
      label: "Messages",
      icon: "message-circle",
      match: (p: string) => p.startsWith("/messages"),
    },
    { href: "/account", label: "Profile", icon: "user", match: (p: string) => p === "/account" },
  ] as const;

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-row">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.href} href={item.href} className="bottom-nav-item" data-active={active}>
              <span className="relative">
                <Icon name={item.icon} size={22} />
                {item.href === "/messages" && !!unreadCount && (
                  <span
                    className="absolute -top-1 -right-1.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                    style={{ background: "var(--danger)", minWidth: 14, height: 14, padding: "0 3px" }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
