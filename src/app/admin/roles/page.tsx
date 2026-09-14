import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { RoleMatrix } from "./role-matrix";
import type { AdminRole } from "./actions";

export default async function AdminRolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: adminProfiles, error: profilesError }, { data: allRoles, error: rolesError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("role", "admin").order("full_name"),
    supabase.from("admin_roles").select("profile_id, role"),
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

  const admins = (adminProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || p.id.slice(0, 8),
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

      <RoleMatrix admins={admins} isViewerSuperAdmin={isViewerSuperAdmin} />
    </div>
  );
}
