"use client";

import { useState } from "react";
import { Suspense } from "react";
import { AdminSidebar, AdminMobileDrawer } from "./sidebar";
import { AdminTopbar } from "./topbar";

interface AdminUser {
  fullName: string | null;
  avatarUrl: string | null;
}

export function AdminShell({
  badgeCounts,
  user,
  unreadNotifications,
  children,
}: {
  badgeCounts: Record<string, number>;
  user: AdminUser;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AdminSidebar badgeCounts={badgeCounts} user={user} />
      <AdminMobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} badgeCounts={badgeCounts} user={user} />

      <div className="md:pl-[var(--admin-sidebar-width)]">
        <Suspense fallback={<div className="h-16" style={{ borderBottom: "1px solid var(--border)" }} />}>
          <AdminTopbar unreadNotifications={unreadNotifications} onOpenMobileMenu={() => setMobileOpen(true)} />
        </Suspense>
        <main className="p-4 md:p-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
