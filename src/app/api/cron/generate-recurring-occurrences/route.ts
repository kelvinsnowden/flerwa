import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled entry point for rpc_generate_due_recurring_occurrences_locked
 * — the function that creates each recurring series' next occurrence a
 * few days before it's due (docs/07-payments.md §3: "funds each
 * occurrence shortly before it happens"). Same shape as
 * auto-approve-sweep/route.ts: Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` (per vercel.json), fails closed
 * if that env var isn't configured, and records each run in
 * scheduler_runs for operational visibility.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error(JSON.stringify({ event: "generate_recurring_occurrences", outcome: "rejected", reason: "CRON_SECRET not configured" }));
    return NextResponse.json({ error: "Scheduler not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const authorized =
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!authorized) {
    console.error(JSON.stringify({ event: "generate_recurring_occurrences", outcome: "rejected", reason: "invalid or missing bearer token" }));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await admin
    .from("scheduler_runs")
    .insert({ job_name: "generate_recurring_occurrences", started_at: startedAt })
    .select("id")
    .single();
  const runId = runInsertError ? null : runRow?.id;

  const { data: createdCount, error } = await admin.rpc("rpc_generate_due_recurring_occurrences_locked");
  const finishedAt = new Date().toISOString();

  if (error) {
    console.error(JSON.stringify({ event: "generate_recurring_occurrences", outcome: "error", error: error.message }));
    if (runId) {
      await admin.from("scheduler_runs").update({ finished_at: finishedAt, success: false, error: error.message }).eq("id", runId);
    }
    return NextResponse.json({ error: "Sweep failed. See server logs." }, { status: 500 });
  }

  // -1 means another invocation was already in progress — not a
  // failure, just nothing done this time (same convention as the
  // auto-approve sweep's own locked wrapper).
  const skipped = createdCount === -1;
  console.log(JSON.stringify({ event: "generate_recurring_occurrences", outcome: skipped ? "skipped_overlap" : "success", created_count: skipped ? 0 : createdCount }));

  if (runId) {
    await admin
      .from("scheduler_runs")
      .update({
        finished_at: finishedAt,
        success: true,
        result: { created_count: skipped ? 0 : createdCount, skipped_overlap: skipped },
      })
      .eq("id", runId);
  }

  return NextResponse.json({ ok: true, skipped_overlap: skipped, created_count: skipped ? 0 : createdCount });
}
