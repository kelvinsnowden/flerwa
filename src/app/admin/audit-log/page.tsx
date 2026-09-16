import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { AuditLogTable } from "./audit-log-table";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md AUDIT-001. admin_actions has been
 * written to by every privileged RPC since the disputes/Deal Desk work —
 * nothing ever rendered it (SEC-005 in MARKETPLACE_REMEDIATION_REGISTER.md).
 * Pure read — RLS ("admin actions admin read": is_admin()) is the real
 * boundary; there is no insert policy on this table for any client role,
 * so it's genuinely append-only from the app's side. No server actions
 * needed — filters are a plain GET form so the page works without JS and
 * every view is a shareable/bookmarkable URL.
 *
 * There is no "result" column in the schema — a failing RPC raises an
 * exception and never inserts a row, so every row here is a success by
 * construction. Shown as a real, honestly-labeled constant rather than
 * invented failure states — explained in the row detail drawer too.
 */
const PAGE_SIZE = 50;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; table?: string; admin?: string; from?: string; to?: string; page?: string }>;
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
  if (params.admin) query = query.eq("admin_id", params.admin);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00Z`);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59Z`);

  const { data: actions, count, error } = await query;

  const [{ data: allAdmins }, { data: targetTables }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name"),
    supabase.from("admin_actions").select("target_table").not("target_table", "is", null),
  ]);

  const adminNameById: Record<string, string> = {};
  for (const a of allAdmins ?? []) adminNameById[a.id] = a.full_name ?? a.id.slice(0, 8);
  const distinctTables = [...new Set((targetTables ?? []).map((t) => t.target_table))].sort();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.action || params.table || params.admin || params.from || params.to);

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Audit log</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Every privileged admin action, in the order it happened. Append-only — nothing here can be edited or
        deleted from the app.
      </p>

      <form method="GET" className="flex flex-wrap gap-2 mb-6 text-sm items-end">
        <input
          type="text"
          name="action"
          defaultValue={params.action ?? ""}
          placeholder="Search action"
          className="!min-h-0 !py-2 text-sm flex-1 min-w-[160px]"
        />
        <select name="admin" defaultValue={params.admin ?? ""} className="!min-h-0 !py-2 text-sm">
          <option value="">All admins</option>
          {(allAdmins ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <select name="table" defaultValue={params.table ?? ""} className="!min-h-0 !py-2 text-sm">
          <option value="">All resources</option>
          {distinctTables.map((t) => (
            <option key={t} value={t ?? ""}>
              {t}
            </option>
          ))}
        </select>
        <label className="text-xs font-medium text-[var(--muted)]">
          From
          <input type="date" name="from" defaultValue={params.from ?? ""} className="!min-h-0 !py-2 text-sm block" />
        </label>
        <label className="text-xs font-medium text-[var(--muted)]">
          To
          <input type="date" name="to" defaultValue={params.to ?? ""} className="!min-h-0 !py-2 text-sm block" />
        </label>
        <button type="submit" className="btn-primary text-sm">
          Filter
        </button>
        {hasFilters && (
          <a href="/admin/audit-log" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load the audit log. Please refresh." />}

      {!error && !actions?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">{hasFilters ? "No admin actions match these filters." : "No admin actions recorded yet."}</p>
        </div>
      )}

      {!error && !!actions?.length && (
        <>
          <AuditLogTable actions={actions} adminNameById={adminNameById} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-[var(--muted)]">
                Page {page} of {totalPages} ({count} total)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`} className="px-3 py-1 border rounded hover:bg-[var(--surface)]">
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`} className="px-3 py-1 border rounded hover:bg-[var(--surface)]">
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
