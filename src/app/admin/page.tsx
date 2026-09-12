import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ count: pendingVerifications }, { count: pendingPayments }, { count: openDisputes }, { count: settledCount }, { data: settledSum }, { data: lastSweep }] =
    await Promise.all([
      supabase.from("provider_verifications").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("service_transactions").select("id", { count: "exact", head: true }).eq("state", "requested"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("state", "open"),
      supabase.from("service_transactions").select("id", { count: "exact", head: true }).in("state", ["settled", "reviewed", "closed"]),
      supabase.from("service_transactions").select("service_amount_minor").in("state", ["settled", "reviewed", "closed"]),
      supabase
        .from("scheduler_runs")
        .select("started_at, finished_at, success, error")
        .eq("job_name", "auto_approve_sweep")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // GMV excludes materials pass-through and platform fee — see
  // docs/10-business-model.md on why materials must never be counted as GMV.
  const gmvMinor = (settledSum ?? []).reduce((sum, t) => sum + t.service_amount_minor, 0);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Pending verifications" value={pendingVerifications ?? 0} urgent={(pendingVerifications ?? 0) > 0} />
        <Stat label="Payments to confirm" value={pendingPayments ?? 0} urgent={(pendingPayments ?? 0) > 0} />
        <Stat label="Open disputes" value={openDisputes ?? 0} urgent={(openDisputes ?? 0) > 0} />
        <Stat label="Completed jobs" value={settledCount ?? 0} />
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        GMV (settled, service amount only, excludes materials pass-through):{" "}
        <strong className="text-[var(--foreground)]">{formatMoney(gmvMinor)}</strong>
      </p>

      <div className="mt-4 card p-4">
        <p className="text-xs font-semibold text-[var(--muted)] mb-1">Auto-approve sweep (scheduled daily, 03:00 UTC)</p>
        {!lastSweep ? (
          <p className="text-sm text-[var(--danger)]">Never run — check that CRON_SECRET is set and the Vercel Cron job is registered.</p>
        ) : (
          <p className={`text-sm ${lastSweep.success ? "" : "text-[var(--danger)]"}`}>
            Last run {new Date(lastSweep.started_at).toLocaleString("en-KE")} —{" "}
            {lastSweep.success ? "succeeded" : `failed: ${lastSweep.error ?? "unknown error"}`}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div className="card p-4">
      <p className={`text-2xl font-bold ${urgent ? "text-[var(--danger)]" : ""}`}>{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
    </div>
  );
}
