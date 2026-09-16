import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { Icon } from "@/components/ui/icon";
import { HideControl } from "./hide-control";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md REV-K1/K3: no admin view of
 * reviews existed at all, and there was no way to hide an abusive one —
 * "reviews public read" was unconditionally true before this pass's
 * migration narrowed it to `not is_hidden or is_admin()`.
 *
 * reviewer_id/reviewee_id reference auth.users(id) directly, not
 * profiles(id) (confirmed via pg_constraint — unlike service_transactions,
 * there's no FK from reviews to profiles), so PostgREST can't embed
 * `profiles:reviewer_id(...)` the way other admin pages embed
 * `profiles:customer_id(...)`. Names are fetched with a second batched
 * query instead, same shape as the reliability-score lookup on the
 * Providers page.
 */
const PAGE_SIZE = 50;

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ hidden?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select("id, transaction_id, reviewer_id, reviewee_id, rating, comment, is_customer_review, is_hidden, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.hidden === "true") query = query.eq("is_hidden", true);
  else if (params.hidden === "false") query = query.eq("is_hidden", false);

  const { data: reviews, count, error } = await query;

  const peopleIds = Array.from(new Set((reviews ?? []).flatMap((r) => [r.reviewer_id, r.reviewee_id])));
  const { data: people } = peopleIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", peopleIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
  const peopleById = new Map((people ?? []).map((p) => [p.id, p]));

  const [{ count: allCount }, { count: visibleCount }, { count: hiddenCount }] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("is_hidden", false),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("is_hidden", true),
  ]);

  const TABS = [
    { key: undefined, label: "All", count: allCount ?? 0 },
    { key: "false", label: "Visible", count: visibleCount ?? 0 },
    { key: "true", label: "Hidden", count: hiddenCount ?? 0 },
  ];

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Reviews</h1>
      <p className="text-sm text-[var(--muted)] mb-4">
        Hiding a review removes it from public view immediately without deleting it — the author isn&apos;t
        notified and the review can be unhidden. Never silently edit review text.
      </p>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/admin/reviews?hidden=${t.key}` : "/admin/reviews"}
            className="pill-tab flex-shrink-0 whitespace-nowrap"
            data-active={(params.hidden ?? undefined) === t.key}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      {error && <ErrorNotice message="We couldn't load reviews. Please refresh." />}
      {!error && !reviews?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">No reviews match this filter.</p>
        </div>
      )}
      {!error && !!reviews?.length && (
        <>
          <div className="space-y-3">
            {reviews.map((r) => {
              const reviewer = peopleById.get(r.reviewer_id);
              const reviewee = peopleById.get(r.reviewee_id);
              return (
                <div key={r.id} className="card p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-2">
                      {reviewer?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={reviewer.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="avatar h-7 w-7 text-xs flex-shrink-0">{initialsOf(reviewer?.full_name ?? "?")}</span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {reviewer?.full_name ?? "Unknown"}{" "}
                          <span className="font-normal text-[var(--muted)]">
                            {r.is_customer_review ? "reviewed provider" : "reviewed customer"}
                          </span>{" "}
                          {reviewee?.full_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{new Date(r.created_at).toLocaleString("en-KE")}</p>
                      </div>
                    </div>
                    <p className="text-sm flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Icon
                          key={i}
                          name="star"
                          size={14}
                          className={i < r.rating ? "text-[var(--warn)]" : "text-[var(--border)]"}
                        />
                      ))}
                      {r.is_hidden && <span className="badge-danger ml-2">Hidden</span>}
                    </p>
                    {r.comment && <p className="text-sm mt-1.5">{r.comment}</p>}
                    <Link href={`/admin/bookings/${r.transaction_id}`} className="text-xs text-[var(--info)] hover:underline mt-1.5 inline-block">
                      View booking
                    </Link>
                  </div>
                  <HideControl reviewId={r.id} isHidden={r.is_hidden} />
                </div>
              );
            })}
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
