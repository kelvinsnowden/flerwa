import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Server-side admin guard. This is defence in depth, not the security
 * boundary — the real boundary is RLS ("is_admin()") and the rpc_*
 * functions' internal checks. A non-admin hitting any /admin/* route
 * is redirected here before any admin page even queries data, so a
 * bug in one admin page's own logic can't accidentally expose the UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role, full_name, avatar_url").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  // Real counts only — the sidebar badge and the topbar's notification
  // dot both come from the same queries the pages themselves use, never
  // a placeholder number.
  const [{ count: pendingVerifications }, { count: unreadNotifications }] = await Promise.all([
    supabase
      .from("providers")
      .select("id", { count: "exact", head: true })
      .in("verification_status", ["submitted", "under_review", "pending"]),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);

  return (
    <AdminShell
      badgeCounts={{ pendingVerifications: pendingVerifications ?? 0 }}
      user={{ fullName: profile?.full_name ?? null, avatarUrl: profile?.avatar_url ?? null }}
      unreadNotifications={unreadNotifications ?? 0}
    >
      {children}
    </AdminShell>
  );
}
