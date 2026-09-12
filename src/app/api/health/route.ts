import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Phase 11 (MARKETPLACE_SCALE_READINESS_AUDIT.md /
 * MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md): liveness/readiness endpoint
 * for uptime monitoring and Vercel's own deployment health checks. Before
 * this, there was no way to distinguish "the app is up but the database
 * connection is broken" from "everything is fine" without hitting a real
 * page.
 *
 * Deliberately uses the normal RLS-scoped server client, not the
 * service-role admin client — a public health endpoint has no business
 * holding an all-access key, and a trivial read against `categories`
 * (publicly readable — see the "categories readable" RLS policy) proves
 * the same thing a privileged query would: the app can reach Postgres and
 * get a real row back. No session/auth required to call this route, by
 * design, matching how uptime monitors and load balancers call it.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("categories").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json(
      { ok: true, checks: { database: "ok" }, latency_ms: Date.now() - startedAt },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String(err.message) : "unknown";
    console.error(JSON.stringify({ event: "health_check", outcome: "error", error: message }));
    return NextResponse.json(
      { ok: false, checks: { database: "error" }, latency_ms: Date.now() - startedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
