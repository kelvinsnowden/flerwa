import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { HideControl } from "./hide-control";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md REV-K1/K3: no admin view of
 * reviews existed at all, and there was no way to hide an abusive one —
 * "reviews public read" was unconditionally true before this pass's
 * migration narrowed it to `not is_hidden or is_admin()`.
 */
const PAGE_SIZE = 50;

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

  const { data: reviews, count, error } = await query;

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Reviews</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Hiding a review removes it from public view immediately without deleting it — the author isn&apos;t
        notified and the review can be unhidden. Never silently edit review text.
      </p>

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hidden" value="true" defaultChecked={params.hidden === "true"} />
          Hidden only
        </label>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
      </form>

      {error && <ErrorNotice message="We couldn't load reviews. Please refresh." />}
      {!error && !reviews?.length && <p className="text-sm text-[var(--muted)]">No reviews yet.</p>}
      {!error && !!reviews?.length && (
        <>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="card p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                    {r.is_hidden && (
                      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--danger-tint)] text-[var(--danger)]">
                        Hidden
                      </span>
                    )}
                  </p>
                  {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {r.is_customer_review ? "Customer review of provider" : "Provider review of customer"} ·{" "}
                    {new Date(r.created_at).toLocaleString("en-KE")}
                  </p>
                </div>
                <HideControl reviewId={r.id} isHidden={r.is_hidden} />
              </div>
            ))}
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
