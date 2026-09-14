import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type TxnState, type TransactionMilestone } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { MilestonesCard } from "@/components/ui/milestones-card";
import { AddNoteForm } from "./add-note-form";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md BK-B2/B3/B4/B13: the single
 * biggest gap the capability audit found — there was no admin view of a
 * booking's full picture (state history, payments, ledger, disputes,
 * evidence, admin interventions all live in separate tables with no page
 * assembling them). Every table queried here has an RLS SELECT policy that
 * includes is_admin() (confirmed directly against pg_policies before
 * writing this), so this is a plain admin-session read — no service role.
 */
export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: txn, error: txnError } = await supabase
    .from("service_transactions")
    .select("*, services(name), categories(name), locations(town, county)")
    .eq("id", id)
    .maybeSingle();

  if (txnError) {
    return <ErrorNotice message="We couldn't load this booking. Please refresh." />;
  }
  if (!txn) notFound();

  const [
    { data: customer },
    { data: provider },
    { data: events },
    { data: payments },
    { data: ledgerEntries },
    { data: disputes },
    { data: evidence },
    { data: review },
    { data: adminActions },
    { data: notes },
    { data: milestones },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("id", txn.customer_id).maybeSingle(),
    txn.provider_id
      ? supabase.from("providers").select("id, display_name, user_id").eq("id", txn.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("transaction_events").select("*").eq("transaction_id", id).order("created_at", { ascending: true }),
    supabase.from("payments").select("*").eq("transaction_id", id).order("created_at", { ascending: true }),
    supabase.from("ledger_entries").select("*").eq("transaction_id", id).order("created_at", { ascending: true }),
    supabase.from("disputes").select("*").eq("transaction_id", id).order("created_at", { ascending: true }),
    supabase
      .from("transaction_evidence")
      .select("id, type, description, captured_in_app, uploaded_by, created_at")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("reviews").select("*").eq("transaction_id", id).maybeSingle(),
    supabase
      .from("admin_actions")
      .select("id, admin_id, action, payload, created_at")
      .eq("target_table", "service_transactions")
      .eq("target_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("booking_notes").select("id, admin_id, note, created_at").eq("transaction_id", id).order("created_at", { ascending: false }),
    supabase.from("transaction_milestones").select("*").eq("transaction_id", id).order("sort_order").returns<TransactionMilestone[]>(),
  ]);

  const providerOwnerId = provider?.user_id;
  const { data: providerOwner } = providerOwnerId
    ? await supabase.from("profiles").select("full_name").eq("id", providerOwnerId).maybeSingle()
    : { data: null };

  const adminIds = [...new Set([...(adminActions ?? []).map((a) => a.admin_id), ...(notes ?? []).map((n) => n.admin_id)])];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const adminNameById = new Map((admins ?? []).map((a) => [a.id, a.full_name ?? a.id.slice(0, 8)]));

  const ledgerBalanced =
    (ledgerEntries ?? []).reduce(
      (sum, e) => sum + (e.direction === "debit" ? e.amount_minor : -e.amount_minor),
      0
    ) === 0;

  return (
    <div>
      <Link href="/admin/transactions" className="text-sm text-[var(--muted)] hover:underline">
        ← All transactions
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-xl font-bold">
          {txn.services?.name ?? txn.categories?.name ?? "Booking"}{" "}
          <span className="text-sm font-normal text-[var(--muted)]">#{id.slice(0, 8)}</span>
        </h1>
        <span className="text-sm font-semibold px-3 py-1 rounded-full bg-[var(--surface)]">
          {TXN_STATE_LABELS[txn.state as TxnState] ?? txn.state}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Customer</p>
          <p className="text-sm font-medium">{customer?.full_name ?? "Unknown"}</p>
          <p className="text-xs text-[var(--muted)]">{txn.contact_phone ?? customer?.phone ?? "No phone on file"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Provider</p>
          <p className="text-sm font-medium">{provider?.display_name ?? "Unassigned"}</p>
          {providerOwner?.full_name && <p className="text-xs text-[var(--muted)]">{providerOwner.full_name}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Scope</p>
          <dl className="text-sm space-y-1">
            <Row label="Category" value={txn.categories?.name ?? "—"} />
            <Row label="Fulfilment" value={txn.fulfilment_mode} />
            <Row label="Origin" value={txn.origin} />
            <Row label="Location" value={txn.locations ? `${txn.locations.town}, ${txn.locations.county}` : txn.address_text ?? "—"} />
            <Row label="Scheduled for" value={txn.scheduled_for ? new Date(txn.scheduled_for).toLocaleString("en-KE") : "—"} />
            <Row label="Requested" value={new Date(txn.requested_at).toLocaleString("en-KE")} />
          </dl>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Financials</p>
          <dl className="text-sm space-y-1">
            <Row label="Service amount" value={formatMoney(txn.service_amount_minor, txn.currency)} />
            <Row label="Materials" value={formatMoney(txn.materials_amount_minor, txn.currency)} />
            <Row label="Customer fee" value={formatMoney(txn.platform_fee_minor, txn.currency)} />
            <Row label="Provider fee (deducted from payout)" value={formatMoney(txn.provider_fee_minor, txn.currency)} />
            <Row
              label="Provider payout"
              value={formatMoney(txn.service_amount_minor - txn.provider_fee_minor, txn.currency)}
            />
            <Row label="Total" value={<strong>{formatMoney(txn.total_amount_minor, txn.currency)}</strong>} />
          </dl>
        </div>
      </div>

      {!!milestones?.length && (
        <div className="mb-6">
          <MilestonesCard milestones={milestones} currency={txn.currency} />
        </div>
      )}

      <Section title="Payments" empty={!payments?.length}>
        {payments?.map((p) => (          <RowCard key={p.id}>
            {p.provider_key} — {p.state} — {formatMoney(p.amount_minor, p.currency)}
            {p.external_reference && <span className="text-[var(--muted)]"> · ref {p.external_reference}</span>}
            <span className="block text-xs text-[var(--muted)]">{new Date(p.created_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      <Section
        title={`Ledger entries${ledgerEntries?.length ? (ledgerBalanced ? " (balanced)" : " (⚠ imbalanced)") : ""}`}
        empty={!ledgerEntries?.length}
      >
        {ledgerEntries?.map((e) => (
          <RowCard key={e.id}>
            {e.account_type} — {e.direction} {formatMoney(e.amount_minor, e.currency)}
            <span className="block text-xs text-[var(--muted)]">
              group {e.transaction_group.slice(0, 8)} · {new Date(e.created_at).toLocaleString("en-KE")}
            </span>
          </RowCard>
        ))}
      </Section>

      <Section title="Disputes" empty={!disputes?.length}>
        {disputes?.map((d) => (
          <RowCard key={d.id}>
            <Link href="/admin/disputes" className="font-medium hover:underline">
              {d.state} — {d.reason}
            </Link>
            {d.resolution && <span className="block text-xs">Resolution: {d.resolution}</span>}
            <span className="block text-xs text-[var(--muted)]">{new Date(d.created_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      <Section title="Evidence" empty={!evidence?.length}>
        {evidence?.map((e) => (
          <RowCard key={e.id}>
            {e.type}
            {!e.captured_in_app && <span className="text-[var(--danger)]"> · not captured in-app</span>}
            {e.description && <span className="block text-xs">{e.description}</span>}
            <span className="block text-xs text-[var(--muted)]">{new Date(e.created_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      {review && (
        <Section title="Review" empty={false}>
          <RowCard>
            {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
            {review.comment && <span className="block text-xs mt-1">{review.comment}</span>}
          </RowCard>
        </Section>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-2">Internal notes</h2>
        <AddNoteForm transactionId={id} />
        {!notes?.length ? (
          <p className="text-sm text-[var(--muted)]">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <RowCard key={n.id}>
                {n.note}
                <span className="block text-xs text-[var(--muted)] mt-1">
                  {adminNameById.get(n.admin_id) ?? n.admin_id.slice(0, 8)} · {new Date(n.created_at).toLocaleString("en-KE")}
                </span>
              </RowCard>
            ))}
          </div>
        )}
      </div>

      <Section title="State-transition history" empty={!events?.length}>
        {events?.map((e) => (
          <RowCard key={e.id}>
            {e.from_state && e.to_state ? (
              <span>
                {TXN_STATE_LABELS[e.from_state as TxnState] ?? e.from_state} → {TXN_STATE_LABELS[e.to_state as TxnState] ?? e.to_state}
              </span>
            ) : (
              <span className="font-mono text-xs">{e.event_type}</span>
            )}
            <span className="block text-xs text-[var(--muted)]">
              {e.actor_role ?? "system"} · {new Date(e.created_at).toLocaleString("en-KE")}
            </span>
          </RowCard>
        ))}
      </Section>

      <Section title="Admin interventions on this booking" empty={!adminActions?.length}>
        {adminActions?.map((a) => (
          <RowCard key={a.id}>
            <span className="font-mono text-xs">{a.action}</span> by {adminNameById.get(a.admin_id) ?? a.admin_id.slice(0, 8)}
            <span className="block text-xs text-[var(--muted)]">{new Date(a.created_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      {empty ? <p className="text-sm text-[var(--muted)]">Nothing here.</p> : <div className="space-y-2">{children}</div>}
    </div>
  );
}

function RowCard({ children }: { children: React.ReactNode }) {
  return <div className="card p-3 text-sm">{children}</div>;
}
