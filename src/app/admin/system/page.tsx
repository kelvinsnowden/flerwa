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

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <select name="job" defaultValue={params.job ?? ""} className="border rounded px-3 py-1.5">
          <option value="">All jobs</option>
          {jobNames.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
        {params.job && (
          <a href="/admin/system" className="text-[var(--muted)] hover:underline self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load scheduler history. Please refresh." />}
      {!error && !runs?.length && (
        <p className="text-sm text-[var(--muted)]">
          {params.job ? "No runs match this filter." : "No scheduled job has ever run — check that CRON_SECRET is set and the Vercel Cron jobs are registered."}
        </p>
      )}
      {!error && !!runs?.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b">
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const durationMs = r.finished_at ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime() : null;
                  return (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-4 font-mono text-xs">{r.job_name}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--muted)] whitespace-nowrap">
                        {new Date(r.started_at).toLocaleString("en-KE")}
                      </td>
                      <td className="py-2 pr-4 text-xs text-[var(--muted)]">
                        {r.finished_at ? `${((durationMs ?? 0) / 1000).toFixed(1)}s` : "still running / never finished"}
                      </td>
                      <td className="py-2 pr-4">
                        {r.success === null ? (
                          <span className="text-[var(--muted)]">pending</span>
                        ) : r.success ? (
                          "succeeded"
                        ) : (
                          <span className="text-[var(--danger)]">failed</span>
                        )}
                      </td>
                      <td className="py-2 text-xs">
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
