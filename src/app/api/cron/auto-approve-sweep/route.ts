import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled entry point for rpc_run_auto_approve_sweep — the function that
 * auto-releases payment for a transaction whose evidence has sat unreviewed
 * past auto_approve_at (docs/06-trust-architecture.md: "customer silent 5
 * days -> auto-release"). Before this route existed, nothing ever called
 * that function at all — pg_cron isn't installed on the database and no
 * other scheduler was wired up (MARKETPLACE_SCALE_READINESS_AUDIT.md §4 #1).
 *
 * Invoked by Vercel Cron per vercel.json ("0 3 * * *" — 03:00 UTC daily,
 * 06:00 EAT, a low-traffic window for this product's Kenya-based users).
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
 * invocations when that env var is set on the project — see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs. That authentication
 * is documented Vercel behavior, not something invented here; setting the
 * actual CRON_SECRET value is a manual dashboard step (see .env.example).
 *
 * Fails CLOSED: if CRON_SECRET isn't configured at all, every request is
 * rejected rather than the endpoint silently accepting unauthenticated
 * calls to a privileged maintenance operation.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error(JSON.stringify({ event: "auto_approve_sweep", outcome: "rejected", reason: "CRON_SECRET not configured" }));
    return NextResponse.json({ error: "Scheduler not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const authorized =
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!authorized) {
    console.error(JSON.stringify({ event: "auto_approve_sweep", outcome: "rejected", reason: "invalid or missing bearer token" }));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await admin
    .from("scheduler_runs")
    .insert({ job_name: "auto_approve_sweep", started_at: startedAt })
    .select("id")
    .single();
  // A logging failure must never block the actual sweep from running —
  // the sweep's own safety doesn't depend on this bookkeeping table.
  const runId = runInsertError ? null : runRow?.id;

  const { data: releasedCount, error } = await admin.rpc("rpc_run_auto_approve_sweep_locked");
  const finishedAt = new Date().toISOString();

  if (error) {
    console.error(JSON.stringify({ event: "auto_approve_sweep", outcome: "error", error: error.message }));
    if (runId) {
      await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: false, error: error.message }).eq("id", runId);
    }
    return NextResponse.json({ error: "Sweep failed. See server logs." }, { status: 500 });
  }

  // -1 means another invocation was already in progress (rpc_run_auto_approve_sweep_locked's
  // overlap guard) — not a failure, just nothing done this time.
  const skipped = releasedCount === -1;
  console.log(JSON.stringify({ event: "auto_approve_sweep", outcome: skipped ? "skipped_overlap" : "success", released_count: skipped ? 0 : releasedCount }));

  if (runId) {
    await admin
      .from("scheduler_runs")
      .update({
        finished_at: finishedAt,
        success: true,
        result: { released_count: skipped ? 0 : releasedCount, skipped_overlap: skipped },
      })
      .eq("id", runId);
  }

  return NextResponse.json({ ok: true, skipped_overlap: skipped, released_count: skipped ? 0 : releasedCount });
}
