import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { ErrorNotice } from "@/components/error-notice";
import { RetryButton } from "./retry-button";
import type { Payout } from "@/lib/types";

const PAGE_SIZE = 50;
const STATES: Payout["state"][] = ["pending", "processing", "paid", "failed"];

const STATE_LABEL: Record<Payout["state"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "badge-warn" },
  processing: { label: "Sending…", className: "badge-warn" },
  paid: { label: "Paid", className: "badge-trust" },
  failed: { label: "Needs attention", className: "badge-danger" },
};

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("payouts")
    .select("*, providers(display_name, slug)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.state && STATES.includes(params.state as Payout["state"])) {
    query = query.eq("state", params.state);
  }

  const { data: payouts, count, error } = await query.returns<(Payout & { providers: { display_name: string; slug: string } | null })[]>();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Payouts</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Every withdrawal a provider has requested from their earnings balance — automatic once a
        payout vendor is connected on <Link href="/admin/integrations" className="underline">Integrations</Link>,
        otherwise pay out by hand and use Retry to re-check once a vendor is active.
      </p>

      <div className="flex gap-2 mb-6 text-sm flex-wrap">
        <Link href="/admin/payouts" className={!params.state ? "btn-primary text-xs px-3 py-1.5" : "btn-secondary text-xs px-3 py-1.5"}>
          All
        </Link>
        {STATES.map((s) => (
          <Link
            key={s}
            href={`/admin/payouts?state=${s}`}
            className={params.state === s ? "btn-primary text-xs px-3 py-1.5" : "btn-secondary text-xs px-3 py-1.5"}
          >
            {STATE_LABEL[s].label}
          </Link>
        ))}
      </div>

      {error && <ErrorNotice message="We couldn't load payouts. Please refresh." />}
      {!error && !payouts?.length && <p className="text-sm text-[var(--muted)]">No payouts match this filter.</p>}

      <div className="flex flex-col gap-2">
        {payouts?.map((p) => {
          const state = STATE_LABEL[p.state];
          return (
            <div key={p.id} className="card p-3 flex items-center justify-between text-sm gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{formatMoney(p.amount_minor, p.currency)}</p>
                <p className="text-xs text-[var(--muted)] truncate">{p.providers?.display_name ?? "Unknown provider"}</p>
                <p className="text-xs font-mono text-[var(--muted)]">{p.destination_phone}</p>
                {p.state === "failed" && p.failure_reason && <p className="text-xs text-[var(--danger)] mt-1">{p.failure_reason}</p>}
                <p className="text-xs text-[var(--muted)] mt-0.5">{new Date(p.created_at).toLocaleString("en-KE")}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={state.className}>{state.label}</span>
                {p.state === "failed" && <RetryButton payoutId={p.id} />}
              </div>
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
    </div>
  );
}
