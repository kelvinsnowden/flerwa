import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type TxnState } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PROV-E5: no admin view assembled
 * a provider's earnings/completion/cancellation history, category
 * clearances, verification documents, disputes, or admin history — same
 * gap as bookings (BK-B2), same fix shape. All tables read here were
 * confirmed admin-readable via pg_policies before writing this page.
 */
export default async function AdminProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: provider, error: providerError } = await supabase.from("providers").select("*").eq("id", id).maybeSingle();

  if (providerError) {
    return <ErrorNotice message="We couldn't load this provider. Please refresh." />;
  }
  if (!provider) notFound();

  const [
    { data: owner },
    { data: score },
    { data: categoryClearances },
    { data: verifications },
    { data: recentBookings },
    { data: adminActions },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", provider.user_id).maybeSingle(),
    supabase.from("reliability_scores").select("*").eq("provider_id", id).maybeSingle(),
    supabase
      .from("provider_categories")
      .select("*, categories(name)")
      .eq("provider_id", id)
      .returns<
        {
          provider_id: string;
          category_id: string;
          is_cleared: boolean;
          cleared_at: string | null;
          jobs_completed: number;
          categories: { name: string } | null;
        }[]
      >(),
    supabase.from("provider_verifications").select("id, kind, status, reviewed_at, notes, created_at").eq("provider_id", id).order("created_at", { ascending: false }),
    supabase
      .from("service_transactions")
      .select("id, state, total_amount_minor, currency, requested_at, services(name)")
      .eq("provider_id", id)
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
    supabase.from("admin_actions").select("id, admin_id, action, payload, created_at").eq("target_id", id).order("created_at", { ascending: false }),
  ]);

  const bookingIds = (recentBookings ?? []).map((b) => b.id);
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
      <Link href="/admin/providers" className="text-sm text-[var(--muted)] hover:underline">
        ← All providers
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-xl font-bold">{provider.display_name}</h1>
        <div className="flex gap-2">
          <span className="text-sm font-semibold px-3 py-1 rounded-full bg-[var(--surface)]">{provider.verification_status}</span>
          {provider.is_published && <span className="text-sm px-3 py-1 rounded-full bg-[var(--surface)]">Published</span>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Owner</p>
          <p className="text-sm font-medium">{owner?.full_name ?? "Unknown"}</p>
          <p className="text-xs text-[var(--muted)]">{owner?.phone ?? "No phone on file"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-[var(--muted)] mb-2">Reliability</p>
          {score ? (
            <dl className="text-sm space-y-1">
              <Row label="Score" value={Number(score.score).toFixed(1)} />
              <Row label="Completion rate" value={`${(Number(score.completion_rate) * 100).toFixed(0)}%`} />
              <Row label="Cancellation rate" value={`${(Number(score.cancellation_rate) * 100).toFixed(0)}%`} />
              <Row label="Avg rating" value={score.avg_rating ? Number(score.avg_rating).toFixed(1) : "—"} />
              <Row
                label="Disputes"
                value={score.dispute_count > 0 ? <span className="text-[var(--danger)]">{score.dispute_count}</span> : "0"}
              />
              <Row label="Jobs completed" value={score.jobs_completed} />
            </dl>
          ) : (
            <p className="text-sm text-[var(--muted)]">No score computed yet.</p>
          )}
        </div>
      </div>

      <Section title="Category clearances" empty={!categoryClearances?.length}>
        {categoryClearances?.map((c) => (
          <RowCard key={`${c.provider_id}-${c.category_id}`}>
            {c.categories?.name ?? c.category_id}
            {c.is_cleared ? (
              <span className="text-[var(--muted)]"> — cleared {c.cleared_at ? new Date(c.cleared_at).toLocaleDateString("en-KE") : ""}</span>
            ) : (
              <span className="text-[var(--danger)]"> — not cleared</span>
            )}
            {c.jobs_completed > 0 && <span className="block text-xs text-[var(--muted)]">{c.jobs_completed} jobs completed here</span>}
          </RowCard>
        ))}
      </Section>

      <Section title="Verification records" empty={!verifications?.length}>
        {verifications?.map((v) => (
          <RowCard key={v.id}>
            {v.kind} — {v.status}
            {v.notes && <span className="block text-xs mt-1">{v.notes}</span>}
            <span className="block text-xs text-[var(--muted)]">
              submitted {new Date(v.created_at).toLocaleString("en-KE")}
              {v.reviewed_at && ` · reviewed ${new Date(v.reviewed_at).toLocaleString("en-KE")}`}
            </span>
          </RowCard>
        ))}
      </Section>

      <Section title="Recent bookings" empty={!recentBookings?.length}>
        {recentBookings?.map((b) => (
          <RowCard key={b.id}>
            <Link href={`/admin/bookings/${b.id}`} className="font-medium hover:underline">
              {b.services?.name ?? "Booking"}
            </Link>{" "}
            — {TXN_STATE_LABELS[b.state as TxnState] ?? b.state} — {formatMoney(b.total_amount_minor, b.currency)}
            <span className="block text-xs text-[var(--muted)]">{new Date(b.requested_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      <Section title="Disputes (last 20 bookings)" empty={!disputes?.length}>
        {disputes?.map((d) => (
          <RowCard key={d.id}>
            <Link href={`/admin/bookings/${d.transaction_id}`} className="font-medium hover:underline">
              {d.state} — {d.reason}
            </Link>
            <span className="block text-xs text-[var(--muted)]">{new Date(d.created_at).toLocaleString("en-KE")}</span>
          </RowCard>
        ))}
      </Section>

      <Section title="Admin interventions on this provider" empty={!adminActions?.length}>
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
