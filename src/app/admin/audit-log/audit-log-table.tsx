"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

export interface AuditLogRow {
  id: string;
  admin_id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export function AuditLogTable({ actions, adminNameById }: { actions: AuditLogRow[]; adminNameById: Record<string, string> }) {
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Result</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} data-selected={selected?.id === a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                <td className="text-xs text-[var(--muted)] whitespace-nowrap">{new Date(a.created_at).toLocaleString("en-KE")}</td>
                <td className="text-sm">{adminNameById[a.admin_id] ?? a.admin_id.slice(0, 8)}</td>
                <td className="text-xs font-mono">{a.action}</td>
                <td className="text-xs text-[var(--muted)]">
                  {a.target_table ? `${a.target_table}${a.target_id ? `#${a.target_id.slice(0, 8)}` : ""}` : "—"}
                </td>
                <td>
                  <span className="badge-trust">Success</span>
                </td>
                <td>
                  <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => setSelected(a)}>
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div className="admin-drawer-overlay" onClick={() => setSelected(null)} />
          <div className="admin-drawer-panel">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <p className="text-sm font-semibold font-mono">{selected.action}</p>
              <button type="button" onClick={() => setSelected(null)} className="p-1.5 rounded hover:bg-[var(--surface)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1">Admin</p>
                <p>{adminNameById[selected.admin_id] ?? selected.admin_id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1">Timestamp</p>
                <p>{new Date(selected.created_at).toLocaleString("en-KE")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1">Resource</p>
                <p>
                  {selected.target_table ?? "—"}
                  {selected.target_id && <span className="block font-mono text-xs text-[var(--muted)] mt-0.5">{selected.target_id}</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1">Result</p>
                <span className="badge-trust">Success</span>
                <p className="text-xs text-[var(--muted)] mt-1">
                  admin_actions only records completed actions — an RPC that fails raises an exception and never
                  inserts a row here, so every entry in this log is, by construction, a success.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1">Metadata</p>
                {Object.keys(selected.payload ?? {}).length > 0 ? (
                  <pre className="text-xs bg-[var(--surface)] rounded p-2.5 overflow-x-auto">{JSON.stringify(selected.payload, null, 2)}</pre>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No additional metadata.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
