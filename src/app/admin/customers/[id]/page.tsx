import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type TxnState } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { SuspendControl } from "@/components/admin/suspend-control";
import { setCustomerSuspended } from "../actions";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md CUST-D2: booking/payment/dispute/
 * review history assembled in one place, same pattern as the booking and
 * provider detail pages. CUST-D3/D4 (suspend/reinstate) closed alongside
 * this — see rpc_set_customer_suspended and the register for why the
 * existing is_suspended column + guard trigger were unreachable before.
 */
export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer, error: customerError } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();

  if (customerError) {
    return <ErrorNotice message="We couldn't load this customer. Please refresh." />;
  }
  if (!customer || customer.role !== "customer") notFound();

  const [{ data: bookings }, { data: reviewsGiven }, { data: adminActions }] = await Promise.all([
    supabase
      .from("service_transactions")
      .select("id, state, total_amount_minor, currency, requested_at, services(name)")
      .eq("customer_id", id)
      .order("requested_at", { ascending: false })
      .limit(20)
      .returns<
        {
          id: string;
          state: string;
          total_amount_minor: number;
          currency: string;
          requested_at: string;
          services: { name: string } | null;
        }[]
      >(),
    supabase.from("reviews").select("id, transaction_id, rating, comment, created_at").eq("reviewer_id", id).order("created_at", { ascending: false }),
    supabase.from("admin_actions").select("id, admin_id, action, payload, created_at").eq("target_id", id).order("created_at", { ascending: false }),
  ]);

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const { data: disputes } = bookingIds.length
    ? await supabase.from("disputes").select("id, transaction_id, state, reason, created_at").in("transaction_id", bookingIds)
    : { data: [] as { id: string; transaction_id: string; state: string; reason: string; created_at: string }[] };

  const adminIds = [...new Set((adminActions ?? []).map((a) => a.admin_id))];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const adminNameById = new Map((admins ?? []).map((a) => [a.id, a.full_name ?? a.id.slice(0, 8)]));

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-[var(--muted)] hover:underline">
        ← All customers
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-xl font-bold">{customer.full_name ?? "Unnamed customer"}</h1>
        {customer.is_suspended && <span className="text-sm font-semibold px-3 py-1 rounded-full bg-[var(--danger-tint)] text-[var(--danger)]">Suspended</span>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Contact</p>
          <dl className="text-sm space-y-1">
            <Row label="Phone" value={customer.phone ?? "—"} />
            <Row label="Email" value={customer.email ?? "—"} />
            <Row label="Joined" value={new Date(customer.created_at).toLocaleDateString("en-KE")} />
          </dl>
        </div>
        <SuspendControl entityId={id} isSuspended={customer.is_suspended} action={setCustomerSuspended} />
      </div>

      <Section title="Recent bookings" empty={!bookings?.length}>
        {bookings?.map((b) => (
          <RowCard key={b.id}>
            <Link href={`/admin/bookings/${b.id}`} className="font-medium hover:underline">
              {b.services?.name ?? "Booking"}
            </Link>{" "}
            — {TXN_STATE_LABELS[b.state as TxnState] ?? b.state} — {formatMoney(b.total_amount_minor, b.currency)}
            <span className="block text-xs text-[var(--muted)]">{new Date(b.requested_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      <Section title="Disputes raised (last 20 bookings)" empty={!disputes?.length}>
        {disputes?.map((d) => (
          <RowCard key={d.id}>
            <Link href={`/admin/bookings/${d.transaction_id}`} className="font-medium hover:underline">
              {d.state} — {d.reason}
            </Link>
            <span className="block text-xs text-[var(--muted)]">{new Date(d.created_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      <Section title="Reviews given" empty={!reviewsGiven?.length}>
        {reviewsGiven?.map((r) => (
          <RowCard key={r.id}>
            <Link href={`/admin/bookings/${r.transaction_id}`} className="hover:underline">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </Link>
            {r.comment && <span className="block text-xs mt-1">{r.comment}</span>}
          </RowCard>
        ))}
      </Section>

      <Section title="Admin interventions on this account" empty={!adminActions?.length}>
        {adminActions?.map((a) => (
          <RowCard key={a.id}>
            <span className="font-mono text-xs">{a.action}</span> by {adminNameById.get(a.admin_id) ?? a.admin_id.slice(0, 8)}
            {a.payload?.reason && <span className="block text-xs mt-1">Reason: {a.payload.reason}</span>}
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
