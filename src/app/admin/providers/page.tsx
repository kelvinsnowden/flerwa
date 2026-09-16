import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { Icon } from "@/components/ui/icon";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PROV-E4: the only providers
 * visible anywhere in admin UI before this were the ones in the
 * verification queue (submitted/under_review/pending only) — a verified,
 * published provider had no admin list entry at all. "providers self
 * read" RLS already grants admins unconditional read on every provider
 * row (confirmed via pg_policies before writing this).
 *
 * Visual pass reuses the exact same query/pagination/filter logic as
 * before — only the presentation changed to match the rest of the
 * redesigned admin console (avatar/table styling, compact status pills).
 */
const PAGE_SIZE = 50;

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

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
    .select(
      "id, display_name, headline, verification_status, is_published, is_accepting_work, is_suspended, created_at, profiles:user_id(email, avatar_url), provider_categories(categories(name))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) query = query.ilike("display_name", `%${params.q}%`);
  if (params.status === "suspended") query = query.eq("is_suspended", true);
  else if (params.status) query = query.eq("verification_status", params.status);

  const { data: providers, count, error } = await query.returns<
    {
      id: string;
      display_name: string;
      headline: string | null;
      verification_status: string;
      is_published: boolean;
      is_accepting_work: boolean;
      is_suspended: boolean;
      created_at: string;
      profiles: { email: string | null; avatar_url: string | null } | null;
      provider_categories: { categories: { name: string } | null }[];
    }[]
  >();

  const providerIds = (providers ?? []).map((p) => p.id);
  const { data: scores } = providerIds.length
    ? await supabase.from("reliability_scores").select("provider_id, score, dispute_count").in("provider_id", providerIds)
    : { data: [] as { provider_id: string; score: number; dispute_count: number }[] };
  const scoreByProvider = new Map((scores ?? []).map((s) => [s.provider_id, s]));

  const [{ count: allCount }, { count: pendingCount }, { count: verifiedCount }, { count: suspendedCount }] = await Promise.all([
    supabase.from("providers").select("id", { count: "exact", head: true }),
    supabase.from("providers").select("id", { count: "exact", head: true }).in("verification_status", ["submitted", "under_review", "pending"]),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("is_suspended", true),
  ]);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.q || params.status);

  const TABS = [
    { key: undefined, label: "All", count: allCount ?? 0 },
    { key: "submitted", label: "Pending", count: pendingCount ?? 0 },
    { key: "verified", label: "Verified", count: verifiedCount ?? 0 },
    { key: "suspended", label: "Suspended", count: suspendedCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Providers</h1>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/admin/providers?status=${t.key}` : "/admin/providers"}
            className="pill-tab flex-shrink-0 whitespace-nowrap"
            data-active={(params.status ?? undefined) === t.key}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      <form method="GET" className="flex flex-wrap gap-2 mb-4 text-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
          <input type="text" name="q" defaultValue={params.q ?? ""} placeholder="Search by name" className="w-full pl-9 !min-h-0 !py-2 text-sm" />
        </div>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <button type="submit" className="btn-secondary text-sm">
          Search
        </button>
        {hasFilters && (
          <Link href="/admin/providers" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2 self-center">
            Reset filters
          </Link>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load providers. Please refresh." />}
      {!error && !providers?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">{hasFilters ? "No providers match these filters" : "No providers yet"}</p>
        </div>
      )}
      {!error && !!providers?.length && (
        <>
          <div className="card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Service(s)</th>
                  <th>Reliability</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const score = scoreByProvider.get(p.id);
                  const cats = p.provider_categories.map((c) => c.categories?.name).filter((n): n is string => !!n);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/providers/${p.id}`} className="flex items-center gap-2.5">
                          {p.profiles?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <span className="avatar h-8 w-8 text-xs flex-shrink-0">{initialsOf(p.display_name)}</span>
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold truncate">{p.display_name}</span>
                            <span className="block text-xs text-[var(--muted)] truncate max-w-[200px]">{p.profiles?.email ?? p.headline ?? ""}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {cats.slice(0, 1).map((name) => (
                            <span key={name} className="badge-muted">
                              {name}
                            </span>
                          ))}
                          {cats.length > 1 && <span className="badge-muted">+{cats.length - 1}</span>}
                          {cats.length === 0 && <span className="text-xs text-[var(--muted)]">—</span>}
                        </div>
                      </td>
                      <td className="text-sm whitespace-nowrap">
                        {score ? (
                          <span className="flex items-center gap-1">
                            <Icon name="star" size={13} className="text-[var(--warn)]" />
                            {Number(score.score).toFixed(1)}
                            {score.dispute_count > 0 && <span className="text-[var(--danger)] text-xs ml-1">({score.dispute_count} disputes)</span>}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={
                              p.verification_status === "verified"
                                ? "badge-trust"
                                : p.verification_status === "rejected"
                                  ? "badge-danger"
                                  : "badge-warn"
                            }
                          >
                            {p.verification_status}
                          </span>
                          {p.is_suspended && <span className="badge-danger">Suspended</span>}
                        </div>
                      </td>
                      <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("en-KE")}</td>
                      <td>
                        <Link href={`/admin/providers/${p.id}`} className="btn-secondary text-xs px-3 py-1.5">
                          View
                        </Link>
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
