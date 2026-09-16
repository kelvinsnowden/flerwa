"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { SignOutButton } from "@/components/sign-out-button";
import { ADMIN_NAV_ITEMS } from "./nav-items";

interface AdminUser {
  fullName: string | null;
  avatarUrl: string | null;
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({ badgeCounts, onNavigate }: { badgeCounts: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.badgeKey ? badgeCounts[item.badgeKey] : undefined;
        return (
          <Link key={item.href} href={item.href} className="admin-nav-item" data-active={active} onClick={onNavigate}>
            <Icon name={item.icon} size={17} />
            <span className="flex-1 truncate">{item.label}</span>
            {!!count && (
              <span
                className="text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center"
                style={{ background: active ? "rgba(255,255,255,0.25)" : "var(--trust)", color: "white" }}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ user }: { user: AdminUser }) {
  const initials = (user.fullName ?? "Admin")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="p-3 flex items-center gap-2.5" style={{ borderTop: "1px solid var(--admin-sidebar-border)" }}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: "var(--trust)", color: "white" }}
        >
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--admin-sidebar-fg)" }}>
          {user.fullName ?? "Admin"}
        </p>
        <p className="text-xs" style={{ color: "var(--admin-sidebar-muted)" }}>
          Admin
        </p>
      </div>
      <SignOutButton className="text-xs" />
    </div>
  );
}

export function AdminSidebar({ badgeCounts, user }: { badgeCounts: Record<string, number>; user: AdminUser }) {
  return (
    <aside
      className="hidden md:flex md:flex-col fixed inset-y-0 left-0 z-30"
      style={{ width: "var(--admin-sidebar-width)", background: "var(--admin-sidebar-bg)" }}
    >
      <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--admin-sidebar-border)" }}>
        <span className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--trust)" }}>
          <Icon name="shield-check" size={16} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "var(--admin-sidebar-fg)" }}>
            Trusted Services
          </p>
          <p className="text-[11px]" style={{ color: "var(--admin-sidebar-muted)" }}>
            Admin Console
          </p>
        </div>
      </div>
      <NavList badgeCounts={badgeCounts} />
      <SidebarFooter user={user} />
    </aside>
  );
}

export function AdminMobileDrawer({
  open,
  onClose,
  badgeCounts,
  user,
}: {
  open: boolean;
  onClose: () => void;
  badgeCounts: Record<string, number>;
  user: AdminUser;
}) {
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 flex flex-col" style={{ background: "var(--admin-sidebar-bg)" }}>
        <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--admin-sidebar-border)" }}>
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "var(--trust)" }}>
              <Icon name="shield-check" size={16} className="text-white" />
            </span>
            <p className="text-sm font-bold" style={{ color: "var(--admin-sidebar-fg)" }}>
              Trusted Services
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" style={{ color: "var(--admin-sidebar-muted)" }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <NavList badgeCounts={badgeCounts} onNavigate={onClose} />
        <SidebarFooter user={user} />
      </div>
    </div>
  );
}
