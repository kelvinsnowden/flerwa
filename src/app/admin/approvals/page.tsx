import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { ErrorNotice } from "@/components/error-notice";
import { ApprovalActions } from "./approval-actions";

type PendingApproval = {
  id: string;
  action_type: "refund" | "suspend_customer" | "suspend_provider" | "category_pause";
  payload: Record<string, unknown>;
  reason: string | null;
  proposed_by: string;
  proposed_at: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  error: string | null;
};

const ACTION_LABELS: Record<PendingApproval["action_type"], string> = {
  refund: "Dispute refund/payout split",
  suspend_customer: "Suspend/reinstate customer",
  suspend_provider: "Suspend/reinstate provider",
  category_pause: "Pause/resume category",
};

function summarizePayload(a: PendingApproval): string {
  const p = a.payload;
  switch (a.action_type) {
    case "refund":
      return `Provider gets ${formatMoney(Number(p.provider_minor), "KES")}, customer refunded ${formatMoney(Number(p.customer_refund_minor), "KES")}`;
    case "suspend_customer":
    case "suspend_provider":
      return p.suspended ? "Suspend" : "Reinstate";
    case "category_pause":
      return p.active ? "Resume" : "Pause";
    default:
      return JSON.stringify(p);
  }
}

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "pending" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from("pending_admin_approvals").select("*");
  if (status !== "all") query = query.eq("status", status);

  const { data: approvals, error } = await query
    .order("proposed_at", { ascending: false })
    .limit(50)
    .returns<PendingApproval[]>();

  if (error) return <ErrorNotice message="We couldn't load pending approvals. Please refresh." />;

  const adminIds = [...new Set((approvals ?? []).flatMap((a) => [a.proposed_by, a.decided_by].filter((v): v is string => !!v)))];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const nameById = new Map((admins ?? []).map((a) => [a.id, a.full_name || a.email || a.id.slice(0, 8)]));

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Approvals</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Every refund, ban/reinstatement, and category pause requires a <strong>different</strong> admin to approve it
        before it takes effect (dual control — see MARKETPLACE_REMEDIATION_REGISTER.md GOV-P4). Proposing one of these
        actions elsewhere in the admin console lands it here.
      </p>

      <form className="mb-4 flex gap-2" method="get">
        <select name="status" defaultValue={status} className="text-sm">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="executed">Executed</option>
          <option value="execution_failed">Execution failed</option>
          <option value="all">All</option>
        </select>
        <button type="submit" className="btn-secondary text-sm">
          Filter
        </button>
      </form>

      {!approvals?.length && <p className="text-sm text-[var(--muted)]">Nothing here.</p>}

      <div className="flex flex-col gap-3">
        {approvals?.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{ACTION_LABELS[a.action_type]}</p>
                <p className="text-sm text-[var(--muted)]">{summarizePayload(a)}</p>
                {a.reason && <p className="text-sm mt-1">&ldquo;{a.reason}&rdquo;</p>}
                <p className="text-xs text-[var(--muted-2)] mt-1">
                  Proposed by {nameById.get(a.proposed_by) ?? a.proposed_by.slice(0, 8)} · {new Date(a.proposed_at).toLocaleString("en-KE")}
                </p>
                {a.decided_by && (
                  <p className="text-xs text-[var(--muted-2)]">
                    Decided by {nameById.get(a.decided_by) ?? a.decided_by.slice(0, 8)}
                    {a.decided_at ? ` · ${new Date(a.decided_at).toLocaleString("en-KE")}` : ""}
                  </p>
                )}
                {a.error && <p className="text-xs text-[var(--danger)] mt-1">Execution error: {a.error}</p>}
              </div>
              <span
                className={
                  a.status === "pending"
                    ? "badge-warn"
                    : a.status === "executed"
                      ? "badge-trust"
                      : a.status === "execution_failed"
                        ? "badge-danger"
                        : "badge-muted"
                }
              >
                {a.status}
              </span>
            </div>

            {a.status === "pending" && <div className="mt-3">
              <ApprovalActions approvalId={a.id} isOwnProposal={a.proposed_by === user?.id} />
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}
