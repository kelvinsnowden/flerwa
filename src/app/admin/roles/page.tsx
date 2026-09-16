import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { RolesWorkspace, type AdminRow } from "./roles-workspace";
import type { AdminRole } from "./actions";

/**
 * "Last activity" = this admin's most recent admin_actions row — a real,
 * honest proxy (their last privileged action), not a fabricated login
 * timestamp (there is no session/login-log table). Computed from the
 * 2000 most recent admin_actions rows across ALL admins, reduced
 * client-side to "first occurrence per admin_id" (rows arrive newest
 * first, so that's the latest) — same bounded-scan tradeoff as the
 * Payouts wallet section, documented for the same reason: correct at
 * today's volume, needs a real aggregate if this table gets very large.
 */
const ACTIVITY_SCAN_LIMIT = 2000;

export default async function AdminRolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: adminProfiles, error: profilesError }, { data: allRoles, error: rolesError }, { data: recentActions }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, is_suspended, created_at").eq("role", "admin").order("full_name"),
    supabase.from("admin_roles").select("profile_id, role"),
    supabase.from("admin_actions").select("admin_id, created_at").order("created_at", { ascending: false }).limit(ACTIVITY_SCAN_LIMIT),
  ]);

  if (profilesError || rolesError) {
    return <ErrorNotice message="We couldn't load admin roles. Please refresh." />;
  }

  const isViewerSuperAdmin = (allRoles ?? []).some((r) => r.profile_id === user?.id && r.role === "super_admin");

  const rolesByProfile = new Map<string, AdminRole[]>();
  for (const r of allRoles ?? []) {
    const list = rolesByProfile.get(r.profile_id) ?? [];
    list.push(r.role as AdminRole);
    rolesByProfile.set(r.profile_id, list);
  }

  const lastActivityByAdmin = new Map<string, string>();
  for (const a of recentActions ?? []) {
    if (!lastActivityByAdmin.has(a.admin_id)) lastActivityByAdmin.set(a.admin_id, a.created_at);
  }

  const admins: AdminRow[] = (adminProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || p.id.slice(0, 8),
    isSuspended: p.is_suspended,
    createdAt: p.created_at,
    lastActivityAt: lastActivityByAdmin.get(p.id) ?? null,
    roles: rolesByProfile.get(p.id) ?? [],
  }));

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Admin roles</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        GOV-P1–P4 (MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md). Super admin bypasses every domain check below it. Every
        admin-type account keeps its base <code>is_admin()</code> access regardless of roles here — these are the
        granular, domain-scoped permissions layered on top (support tickets, finance/payments, trust &amp; safety,
        ops/catalog).
      </p>

      <RolesWorkspace admins={admins} isViewerSuperAdmin={isViewerSuperAdmin} />
    </div>
  );
}
