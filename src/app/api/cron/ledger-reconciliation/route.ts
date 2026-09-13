import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PAY-006 (MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md): asserts the
 * ledger's own double-entry invariant daily — every ledger_entries
 * transaction_group's debits must equal its credits. Nothing has ever
 * checked this; it's the cheapest, highest-value financial-safety gap
 * identified in the marketplace remediation continuation pass, and needs
 * no connected payment aggregator to be useful — every ledger row written
 * so far comes from the already-live manual-payment/dispute/cancellation
 * paths.
 *
 * Same shape as src/app/api/cron/auto-approve-sweep/route.ts on purpose:
 * fails closed without CRON_SECRET, constant-time bearer check, logs a
 * scheduler_runs row before/after. A logging failure must never block the
 * check itself from running.
 *
 * Unlike the auto-approve sweep, this never mutates anything — it is a
 * pure read/assertion. An imbalance is recorded as `success: true` with
 * the imbalance detail in `result` (the *check ran successfully and found
 * a problem*, which is different from the check itself failing to run) so
 * a real reconciliation failure is never confused with routine
 * infrastructure noise in the scheduler_runs history.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error(JSON.stringify({ event: "ledger_reconciliation", outcome: "rejected", reason: "CRON_SECRET not configured" }));
    return NextResponse.json({ error: "Scheduler not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const authorized =
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!authorized) {
    console.error(JSON.stringify({ event: "ledger_reconciliation", outcome: "rejected", reason: "invalid or missing bearer token" }));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await admin
    .from("scheduler_runs")
    .insert({ job_name: "ledger_reconciliation", started_at: startedAt })
    .select("id")
    .single();
  const runId = runInsertError ? null : runRow?.id;

  const { data: result, error } = await admin.rpc("rpc_run_ledger_reconciliation");
  const finishedAt = new Date().toISOString();

  if (error) {
    console.error(JSON.stringify({ event: "ledger_reconciliation", outcome: "error", error: error.message }));
    if (runId) {
      await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: false, error: error.message }).eq("id", runId);
    }
    return NextResponse.json({ error: "Reconciliation check failed to run. See server logs." }, { status: 500 });
  }

  const imbalanceCount = (result as { imbalance_count?: number } | null)?.imbalance_count ?? 0;
  const outcome = imbalanceCount > 0 ? "imbalance_found" : "balanced";
  console.log(JSON.stringify({ event: "ledger_reconciliation", outcome, imbalance_count: imbalanceCount }));

  if (runId) {
    await admin
      .from("scheduler_runs")
      .update({ finished_at: finishedAt, success: true, result })
      .eq("id", runId);
  }

  return NextResponse.json({ ok: true, imbalance_count: imbalanceCount, result });
}
