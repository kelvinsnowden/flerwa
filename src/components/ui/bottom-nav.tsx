"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
import type { UserRole } from "@/lib/types";

/**
 * The authenticated mobile app shell's tab bar. "Messages" from the
 * reference designs is intentionally not a tab here — there is no chat/
 * messaging table or infrastructure in the schema, and building a fake or
 * disconnected inbox would violate the "use real data, never fabricate"
 * instruction. Notifications (backed by the real `notifications` table,
 * already written to by every state-changing RPC) is the honest
 * equivalent: it surfaces the same "what's happening with my jobs" need
 * without pretending a two-way chat exists.
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
      href: "/notifications",
      label: "Updates",
      icon: "bell",
      match: (p: string) => p.startsWith("/notifications"),
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
                {item.href === "/notifications" && !!unreadCount && (
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
