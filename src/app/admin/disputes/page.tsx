import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { DisputeCard } from "./dispute-card";
import { ResolvedDisputeCard } from "./resolved-dispute-card";

/**
 * Previously this page ONLY ever queried state in (open, under_review) with
 * no pagination — a resolved or withdrawn dispute vanished from admin view
 * entirely with no way to look it back up. Broadened to real dispute_state
 * tabs + counts + pagination, matching the Verifications/Providers
 * treatment. Active disputes keep the full resolution workflow (DisputeCard);
 * resolved/withdrawn ones get a compact read-only summary — there's nothing
 * left to action on them.
 */
interface DisputeRow {
  id: string;
  transaction_id: string;
  opened_by: string;
  reason: string;
  description: string | null;
  state: string;
  resolution: string | null;
  financial_outcome: { provider_minor?: number; customer_refund_minor?: number } | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  assigned_to: string | null;
  sla_deadline: string | null;
  escalated_at: string | null;
  overdue_notified_at: string | null;
  service_transactions: {
    id: string;
    service_amount_minor: number;
    currency: string;
    services: { name: string } | null;
    providers: { display_name: string } | null;
    profiles: { full_name: string | null } | null;
  } | null;
}

const PAGE_SIZE = 30;

export default async function AdminDisputesPage({
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
    .from("disputes")
    .select(
      "*, service_transactions(id, service_amount_minor, currency, services(name), providers(display_name), profiles:customer_id(full_name))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.state) query = query.eq("state", params.state);
  else query = query.in("state", ["open", "under_review"]);

  const { data: disputes, count, error } = await query.returns<DisputeRow[]>();

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Disputes</h1>
        <ErrorNotice message="We couldn't load the dispute queue. Please refresh — this is not the same as there being no open disputes." />
      </div>
    );
  }

  const resolvedByIds = Array.from(new Set((disputes ?? []).map((d) => d.resolved_by).filter((id): id is string => !!id)));
  const [{ data: admins }, { data: resolvers }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "admin"),
    resolvedByIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", resolvedByIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const resolverById = new Map((resolvers ?? []).map((r) => [r.id, r.full_name]));

  const [{ count: openCount }, { count: mediationCount }, { count: resolvedCount }, { count: withdrawnCount }] = await Promise.all([
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("state", "open"),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("state", "under_review"),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("state", "resolved"),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("state", "withdrawn"),
  ]);

  const TABS = [
    { key: undefined, label: "Open queue", count: (openCount ?? 0) + (mediationCount ?? 0) },
    { key: "open", label: "Open", count: openCount ?? 0 },
    { key: "under_review", label: "Mediation", count: mediationCount ?? 0 },
    { key: "resolved", label: "Resolved", count: resolvedCount ?? 0 },
    { key: "withdrawn", label: "Withdrawn", count: withdrawnCount ?? 0 },
  ];

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Disputes</h1>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/admin/disputes?state=${t.key}` : "/admin/disputes"}
            className="pill-tab flex-shrink-0 whitespace-nowrap"
            data-active={(params.state ?? undefined) === t.key}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      {!disputes?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">No disputes match this filter.</p>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {disputes?.map((d) =>
          d.state === "resolved" || d.state === "withdrawn" ? (
            <ResolvedDisputeCard
              key={d.id}
              transactionId={d.transaction_id}
              reason={d.reason}
              description={d.description}
              createdAt={d.created_at}
              serviceAmountMinor={d.service_transactions?.service_amount_minor ?? 0}
              currency={d.service_transactions?.currency ?? "KES"}
              serviceName={d.service_transactions?.services?.name ?? "Service"}
              providerName={d.service_transactions?.providers?.display_name ?? "Professional"}
              customerName={d.service_transactions?.profiles?.full_name ?? "Customer"}
              state={d.state}
              resolution={d.resolution}
              financialOutcome={d.financial_outcome}
              resolvedAt={d.resolved_at}
              resolvedByName={d.resolved_by ? (resolverById.get(d.resolved_by) ?? null) : null}
            />
          ) : (
            <DisputeCard
              key={d.id}
              dispute={{
                id: d.id,
                reason: d.reason,
                description: d.description,
                createdAt: d.created_at,
                serviceAmountMinor: d.service_transactions?.service_amount_minor ?? 0,
                currency: d.service_transactions?.currency ?? "KES",
                serviceName: d.service_transactions?.services?.name ?? "Service",
                providerName: d.service_transactions?.providers?.display_name ?? "Professional",
                customerName: d.service_transactions?.profiles?.full_name ?? "Customer",
                assignedTo: d.assigned_to,
                state: d.state,
                slaDeadline: d.sla_deadline,
                escalatedAt: d.escalated_at,
                overdueNotifiedAt: d.overdue_notified_at,
              }}
              admins={admins ?? []}
            />
          )
        )}
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
    </div>
  );
}
