import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOpsAlert } from "@/lib/alerts";
import { attemptAllPendingPayouts } from "@/lib/payouts/initiate";

/**
 * Catches every payout still 'pending' that the fast path (src/lib/
 * payouts/initiate.ts's attemptPendingPayouts, called right after
 * rpc_approve_and_release) never reached — a milestone release fired
 * from check-in or funding, an auto-approved booking (the nightly sweep
 * releases in bulk and doesn't call the fast path per-transaction), or a
 * payout an admin just reset to 'pending' via rpc_admin_retry_payout.
 * Never touches 'failed' payouts directly — those need an admin's
 * explicit rpc_admin_retry_payout first (see /admin/payouts), so a
 * transient vendor error can't loop forever unnoticed.
 *
 * Same auth/logging shape as the other cron routes in this codebase
 * (src/app/api/cron/ledger-reconciliation, auto-approve-sweep): fails
 * closed without CRON_SECRET, constant-time bearer check, a
 * scheduler_runs row for observability. Runs daily (vercel.json) — was
 * hourly until the Vercel Hobby plan's daily-cron-only limit forced a
 * downgrade; a failed payout can now sit up to 24h before the next
 * retry instead of 1h.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error(JSON.stringify({ event: "payout_retry_sweep", outcome: "rejected", reason: "CRON_SECRET not configured" }));
    return NextResponse.json({ error: "Scheduler not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const authorized =
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!authorized) {
    console.error(JSON.stringify({ event: "payout_retry_sweep", outcome: "rejected", reason: "invalid or missing bearer token" }));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await admin
    .from("scheduler_runs")
    .insert({ job_name: "payout_retry_sweep", started_at: startedAt })
    .select("id")
    .single();
  const runId = runInsertError ? null : runRow?.id;

  let attempted = 0;
  try {
    ({ attempted } = await attemptAllPendingPayouts());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error(JSON.stringify({ event: "payout_retry_sweep", outcome: "error", error: message }));
    if (runId) {
      await admin.from("scheduler_runs").update({ finished_at: new Date().toISOString(), success: false, error: message }).eq("id", runId);
    }
    await sendOpsAlert({
      subject: "[flerwa] Payout retry sweep FAILED TO RUN",
      body: `The daily payout retry sweep did not complete.\n\nError: ${message}\n\nPayouts owed to providers may be sitting unsent until this is resolved.`,
    });
    return NextResponse.json({ error: "Payout retry sweep failed to run. See server logs." }, { status: 500 });
  }

  const finishedAt = new Date().toISOString();
  const { count: failedCount } = await admin.from("payouts").select("id", { count: "exact", head: true }).eq("state", "failed");

  console.log(JSON.stringify({ event: "payout_retry_sweep", outcome: "success", attempted, failed_awaiting_admin: failedCount ?? 0 }));

  if (runId) {
    await admin
      .from("scheduler_runs")
      .update({ finished_at: finishedAt, success: true, result: { attempted, failed_awaiting_admin: failedCount ?? 0 } })
      .eq("id", runId);
  }

  if ((failedCount ?? 0) > 0) {
    await sendOpsAlert({
      subject: `[flerwa] ${failedCount} payout(s) need admin attention`,
      body: `${failedCount} provider payout(s) are in 'failed' state on /admin/payouts. Review and either fix the underlying issue (e.g. ask the provider to set a payout number) then retry, or pay out manually and record it there.`,
    });
  }

  return NextResponse.json({ ok: true, attempted, failed_awaiting_admin: failedCount ?? 0 });
}
