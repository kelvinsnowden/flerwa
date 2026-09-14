"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantAdminRole, revokeAdminRole, type AdminRole } from "./actions";

const ROLES: { key: AdminRole; label: string }[] = [
  { key: "super_admin", label: "Super admin" },
  { key: "support_agent", label: "Support agent" },
  { key: "finance_admin", label: "Finance admin" },
  { key: "trust_safety_admin", label: "Trust & safety admin" },
  { key: "ops_admin", label: "Ops admin" },
];

export function RoleMatrix({
  admins,
  isViewerSuperAdmin,
}: {
  admins: { id: string; name: string; roles: AdminRole[] }[];
  isViewerSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isViewerSuperAdmin) {
    return <p className="text-sm text-[var(--muted)]">Only a super admin can view or change role assignments.</p>;
  }

  function toggle(profileId: string, role: AdminRole, has: boolean) {
    startTransition(async () => {
      setError(null);
      const res = has ? await revokeAdminRole(profileId, role) : await grantAdminRole(profileId, role);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      {error && <p className="text-sm text-[var(--danger)] mb-3">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4">Admin</th>
              {ROLES.map((r) => (
                <th key={r.key} className="text-center py-2 px-2 font-medium text-xs">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2 pr-4">{a.name}</td>
                {ROLES.map((r) => {
                  const has = a.roles.includes(r.key);
                  return (
                    <td key={r.key} className="text-center py-2 px-2">
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={isPending}
                        onChange={() => toggle(a.id, r.key, has)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
