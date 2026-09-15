import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled entry point for rpc_escalate_overdue_disputes_locked (TXN-004)
 * — disputes/06-trust-architecture.md's five-tier ladder has no
 * enforcement without a sweep: a dispute opened and never responded to
 * would otherwise sit 'open' forever. This moves it open -> under_review
 * once the initial 48h window lapses, and flags it (once) as overdue for
 * adjudication after the following 72h mediation window. It never
 * auto-executes a refund/payout decision — that stays a human call via
 * /admin/disputes and the dual-control approval flow.
 *
 * Same shape as auto-approve-sweep/route.ts and
 * generate-recurring-occurrences/route.ts: Bearer $CRON_SECRET, fails
 * closed if unset, records each run in scheduler_runs.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error(JSON.stringify({ event: "escalate_overdue_disputes", outcome: "rejected", reason: "CRON_SECRET not configured" }));
    return NextResponse.json({ error: "Scheduler not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const authorized =
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!authorized) {
    console.error(JSON.stringify({ event: "escalate_overdue_disputes", outcome: "rejected", reason: "invalid or missing bearer token" }));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await admin
    .from("scheduler_runs")
    .insert({ job_name: "escalate_overdue_disputes", started_at: startedAt })
    .select("id")
    .single();
  const runId = runInsertError ? null : runRow?.id;

  const { data: result, error } = await admin.rpc("rpc_escalate_overdue_disputes_locked");
  const finishedAt = new Date().toISOString();

  if (error) {
    console.error(JSON.stringify({ event: "escalate_overdue_disputes", outcome: "error", error: error.message }));
    if (runId) {
      await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: false, error: error.message }).eq("id", runId);
    }
    return NextResponse.json({ error: "Sweep failed. See server logs." }, { status: 500 });
  }

  const outcome = result as { skipped_overlap: boolean; escalated: number; overdue_flagged: number };
  console.log(JSON.stringify({ event: "escalate_overdue_disputes", outcome: outcome.skipped_overlap ? "skipped_overlap" : "success", ...outcome }));

  if (runId) {
    await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: true, result: outcome }).eq("id", runId);
  }

  return NextResponse.json({ ok: true, ...outcome });
}
