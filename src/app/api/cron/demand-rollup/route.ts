import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOpsAlert } from "@/lib/alerts";

/**
 * MARKETPLACE-001 (MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md): rolls up
 * the previous UTC calendar day's demand_events into demand_rollup_daily
 * so admin demand reporting can read a small, indexed table instead of
 * scanning the raw event table on every page load as volume grows.
 *
 * Same shape as src/app/api/cron/ledger-reconciliation/route.ts on
 * purpose: fails closed without CRON_SECRET, constant-time bearer
 * check, logs a scheduler_runs row before/after. rpc_run_demand_rollup
 * fully overwrites each (day, category, location) grouping's counts on
 * every call, so this is naturally idempotent — a retried or manually
 * re-triggered run for the same day is always safe.
 *
 * Unlike ledger reconciliation, a failure here is not a financial-
 * safety incident — it only means yesterday's demand numbers are
 * temporarily stale, not silently wrong. Still alerts on failure (an
 * admin dashboard silently going stale for days is a real product
 * problem) but does not raise it to a 500-severity financial page.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error(JSON.stringify({ event: "demand_rollup", outcome: "rejected", reason: "CRON_SECRET not configured" }));
    return NextResponse.json({ error: "Scheduler not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const authorized =
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!authorized) {
    console.error(JSON.stringify({ event: "demand_rollup", outcome: "rejected", reason: "invalid or missing bearer token" }));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await admin
    .from("scheduler_runs")
    .insert({ job_name: "demand_rollup", started_at: startedAt })
    .select("id")
    .single();
  const runId = runInsertError ? null : runRow?.id;

  const { data: result, error } = await admin.rpc("rpc_run_demand_rollup_locked");
  const finishedAt = new Date().toISOString();

  if (error) {
    console.error(JSON.stringify({ event: "demand_rollup", outcome: "error", error: error.message }));
    if (runId) {
      await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: false, error: error.message }).eq("id", runId);
    }
    await sendOpsAlert({
      subject: "[flerwa] Demand rollup FAILED TO RUN",
      body: `The daily demand-events rollup did not complete.\n\nError: ${error.message}\n\nAdmin demand reporting will be stale until this is resolved.`,
    });
    return NextResponse.json({ error: "Demand rollup failed to run. See server logs." }, { status: 500 });
  }

  const skipped = (result as { skipped?: boolean } | null)?.skipped ?? false;
  console.log(JSON.stringify({ event: "demand_rollup", outcome: skipped ? "skipped_overlap" : "completed", result }));

  if (runId) {
    await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: true, result }).eq("id", runId);
  }

  return NextResponse.json({ ok: true, result });
}
