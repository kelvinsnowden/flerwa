import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PROV-E4: the only providers
 * visible anywhere in admin UI before this were the ones in the
 * verification queue (submitted/under_review/pending only) — a verified,
 * published provider had no admin list entry at all. "providers self
 * read" RLS already grants admins unconditional read on every provider
 * row (confirmed via pg_policies before writing this).
 */
const PAGE_SIZE = 50;

export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("providers")
    .select("id, display_name, verification_status, is_published, is_accepting_work, is_suspended, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) query = query.ilike("display_name", `%${params.q}%`);
  if (params.status) query = query.eq("verification_status", params.status);

  const { data: providers, count, error } = await query;

  const providerIds = (providers ?? []).map((p) => p.id);
  const { data: scores } = providerIds.length
    ? await supabase.from("reliability_scores").select("provider_id, score, completion_rate, dispute_count").in("provider_id", providerIds)
    : { data: [] as { provider_id: string; score: number; completion_rate: number; dispute_count: number }[] };
  const scoreByProvider = new Map((scores ?? []).map((s) => [s.provider_id, s]));

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.q || params.status);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Providers</h1>

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search by name"
          className="border rounded px-3 py-1.5 flex-1 min-w-[200px]"
        />
        <select name="status" defaultValue={params.status ?? ""} className="border rounded px-3 py-1.5">
          <option value="">All verification statuses</option>
          {["pending", "submitted", "under_review", "verified", "rejected", "expired"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
        {hasFilters && (
          <a href="/admin/providers" className="text-[var(--muted)] hover:underline self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load providers. Please refresh." />}
      {!error && !providers?.length && (
        <p className="text-sm text-[var(--muted)]">{hasFilters ? "No providers match these filters." : "No providers yet."}</p>
      )}
      {!error && !!providers?.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Verification</th>
                  <th className="py-2 pr-4">Published</th>
                  <th className="py-2 pr-4">Accepting work</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2">Disputes</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const score = scoreByProvider.get(p.id);
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Link href={`/admin/providers/${p.id}`} className="font-medium hover:underline">
                          {p.display_name}
                        </Link>
                        {p.is_suspended && (
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--danger-tint)] text-[var(--danger)]">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{p.verification_status}</td>
                      <td className="py-2 pr-4">{p.is_published ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4">{p.is_accepting_work ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4">{score ? `${Number(score.score).toFixed(1)}` : "—"}</td>
                      <td className="py-2">
                        {score && score.dispute_count > 0 ? (
                          <span className="text-[var(--danger)]">{score.dispute_count}</span>
                        ) : (
                          "0"
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
