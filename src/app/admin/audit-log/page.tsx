import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md AUDIT-001. admin_actions has been
 * written to by every privileged RPC since the disputes/Deal Desk work —
 * nothing ever rendered it (SEC-005 in MARKETPLACE_REMEDIATION_REGISTER.md).
 * Pure read — RLS ("admin actions admin read": is_admin()) is the real
 * boundary; there is no insert policy on this table for any client role,
 * so it's genuinely append-only from the app's side. No server actions
 * needed — filters are a plain GET form so the page works without JS and
 * every view is a shareable/bookmarkable URL.
 */
const PAGE_SIZE = 50;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; table?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("admin_actions")
    .select("id, admin_id, action, target_table, target_id, payload, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.action) query = query.ilike("action", `%${params.action}%`);
  if (params.table) query = query.eq("target_table", params.table);

  const { data: actions, count, error } = await query;

  const adminIds = [...new Set((actions ?? []).map((a) => a.admin_id))];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const adminNameById = new Map((admins ?? []).map((a) => [a.id, a.full_name ?? a.id.slice(0, 8)]));

  const { data: targetTables } = await supabase
    .from("admin_actions")
    .select("target_table")
    .not("target_table", "is", null);
  const distinctTables = [...new Set((targetTables ?? []).map((t) => t.target_table))].sort();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Audit log</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Every privileged admin action, in the order it happened. Append-only — nothing here can be edited or deleted from the app.
      </p>

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <input
          type="text"
          name="action"
          defaultValue={params.action ?? ""}
          placeholder="Search action (e.g. resolve_dispute)"
          className="border rounded px-3 py-1.5 flex-1 min-w-[200px]"
        />
        <select name="table" defaultValue={params.table ?? ""} className="border rounded px-3 py-1.5">
          <option value="">All target tables</option>
          {distinctTables.map((t) => (
            <option key={t} value={t ?? ""}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
        {(params.action || params.table) && (
          <a href="/admin/audit-log" className="text-[var(--muted)] hover:underline self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load the audit log. Please refresh." />}

      {!error && !actions?.length && (
        <p className="text-sm text-[var(--muted)]">
          {params.action || params.table ? "No admin actions match these filters." : "No admin actions recorded yet."}
        </p>
      )}

      {!error && !!actions?.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Admin</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 text-xs text-[var(--muted)] whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString("en-KE")}
                    </td>
                    <td className="py-2 pr-4">{adminNameById.get(a.admin_id) ?? a.admin_id.slice(0, 8)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a.action}</td>
                    <td className="py-2 pr-4 text-xs">
                      {a.target_table ? (
                        <span>
                          {a.target_table}
                          {a.target_id ? `#${a.target_id.slice(0, 8)}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      {a.payload && Object.keys(a.payload).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-[var(--muted)]">view</summary>
                          <pre className="text-xs bg-[var(--surface)] rounded p-2 mt-1 overflow-x-auto max-w-xs">
                            {JSON.stringify(a.payload, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-[var(--muted)]">
                Page {page} of {totalPages} ({count} total)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                    className="px-3 py-1 border rounded hover:bg-[var(--surface)]"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                    className="px-3 py-1 border rounded hover:bg-[var(--surface)]"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
