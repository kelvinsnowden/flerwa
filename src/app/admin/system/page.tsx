import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md SYS-O3: /admin only ever showed
 * the single latest scheduler_runs row per job — the full history (which
 * already exists, RLS-confirmed admin-readable, no write policy for any
 * client role since only the service-role cron routes insert into it) had
 * no view at all. Pure read — no RPC needed.
 */
const PAGE_SIZE = 50;

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("scheduler_runs")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(from, to);

  if (params.job) query = query.eq("job_name", params.job);

  const { data: runs, count, error } = await query;

  const { data: jobNamesRaw } = await supabase.from("scheduler_runs").select("job_name");
  const jobNames = [...new Set((jobNamesRaw ?? []).map((r) => r.job_name))].sort();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">System health</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Full run history for every scheduled background job.</p>

      <form method="GET" className="flex flex-wrap gap-2 mb-6 text-sm">
        <select name="job" defaultValue={params.job ?? ""} className="!min-h-0 !py-2 text-sm">
          <option value="">All jobs</option>
          {jobNames.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary text-sm">
          Filter
        </button>
        {params.job && (
          <a href="/admin/system" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2 self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load scheduler history. Please refresh." />}
      {!error && !runs?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">
            {params.job ? "No runs match this filter." : "No scheduled job has ever run — check that CRON_SECRET is set and the Vercel Cron jobs are registered."}
          </p>
        </div>
      )}
      {!error && !!runs?.length && (
        <>
          <div className="card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Result</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const durationMs = r.finished_at ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime() : null;
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.job_name}</td>
                      <td className="text-xs text-[var(--muted)] whitespace-nowrap">
                        {new Date(r.started_at).toLocaleString("en-KE")}
                      </td>
                      <td className="text-xs text-[var(--muted)]">
                        {r.finished_at ? `${((durationMs ?? 0) / 1000).toFixed(1)}s` : "still running / never finished"}
                      </td>
                      <td>
                        {r.success === null ? (
                          <span className="badge-muted">Pending</span>
                        ) : r.success ? (
                          <span className="badge-trust">Succeeded</span>
                        ) : (
                          <span className="badge-danger">Failed</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {r.error && <span className="text-[var(--danger)]">{r.error}</span>}
                        {!r.error && r.result && Object.keys(r.result).length > 0 && (
                          <details>
                            <summary className="cursor-pointer text-[var(--muted)]">view</summary>
                            <pre className="bg-[var(--surface)] rounded p-2 mt-1 overflow-x-auto max-w-xs">
                              {JSON.stringify(r.result, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
