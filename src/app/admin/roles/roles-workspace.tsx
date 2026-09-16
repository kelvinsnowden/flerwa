"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantAdminRole, revokeAdminRole, type AdminRole } from "./actions";
import { Icon } from "@/components/ui/icon";

const ROLES: { key: AdminRole; label: string; description: string }[] = [
  { key: "super_admin", label: "Super admin", description: "Bypasses every domain check below it, including managing other admins' roles." },
  { key: "support_agent", label: "Support agent", description: "Support tickets (the /admin/support helpdesk inbox)." },
  { key: "finance_admin", label: "Finance admin", description: "Payments, payouts, ledger, refunds, and other money-moving actions." },
  { key: "trust_safety_admin", label: "Trust & safety admin", description: "Verifications, disputes, moderation, suspensions." },
  { key: "ops_admin", label: "Ops admin", description: "Categories, services, matching, and other catalog/operations config." },
];

export interface AdminRow {
  id: string;
  name: string;
  isSuspended: boolean;
  createdAt: string;
  lastActivityAt: string | null;
  roles: AdminRole[];
}

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function RolesWorkspace({ admins, isViewerSuperAdmin }: { admins: AdminRow[]; isViewerSuperAdmin: boolean }) {
  const [selected, setSelected] = useState<AdminRow | null>(null);

  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last activity</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="flex items-center gap-2.5">
                    <span className="avatar h-7 w-7 text-xs flex-shrink-0">{initialsOf(a.name)}</span>
                    <span className="text-sm font-medium">{a.name}</span>
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {a.roles.length ? (
                      a.roles.map((r) => (
                        <span key={r} className="badge-info">
                          {ROLES.find((x) => x.key === r)?.label ?? r}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Base admin only</span>
                    )}
                  </div>
                </td>
                <td>{a.isSuspended ? <span className="badge-danger">Suspended</span> : <span className="badge-trust">Active</span>}</td>
                <td className="text-sm text-[var(--muted)] whitespace-nowrap">
                  {a.lastActivityAt ? new Date(a.lastActivityAt).toLocaleDateString("en-KE") : "No recorded actions"}
                </td>
                <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString("en-KE")}</td>
                <td>
                  <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => setSelected(a)}>
                    {isViewerSuperAdmin ? "Manage roles" : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <RoleDrawer admin={selected} isViewerSuperAdmin={isViewerSuperAdmin} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function RoleDrawer({ admin, isViewerSuperAdmin, onClose }: { admin: AdminRow; isViewerSuperAdmin: boolean; onClose: () => void }) {
  const router = useRouter();
  const [roles, setRoles] = useState<AdminRole[]>(admin.roles);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(role: AdminRole) {
    const has = roles.includes(role);
    startTransition(async () => {
      setError(null);
      const res = has ? await revokeAdminRole(admin.id, role) : await grantAdminRole(admin.id, role);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setRoles((prev) => (has ? prev.filter((r) => r !== role) : [...prev, role]));
      router.refresh();
    });
  }

  return (
    <>
      <div className="admin-drawer-overlay" onClick={onClose} />
      <div className="admin-drawer-panel">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold">{admin.name}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)]">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Permission matrix</p>
          {!isViewerSuperAdmin && (
            <p className="text-sm text-[var(--muted)] mb-3">Only a super admin can change role assignments.</p>
          )}
          {error && <p className="text-sm text-[var(--danger)] mb-3">{error}</p>}
          <div className="space-y-1">
            {ROLES.map((r) => {
              const has = roles.includes(r.key);
              return (
                <label
                  key={r.key}
                  className="flex items-start gap-3 p-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={has}
                    disabled={!isViewerSuperAdmin || isPending}
                    onChange={() => toggle(r.key)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-xs text-[var(--muted)]">{r.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
