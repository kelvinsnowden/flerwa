import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Phase 7 (MARKETPLACE_SCALE_READINESS_AUDIT.md /
 * MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md): thin wrapper around
 * rpc_check_rate_limit for Server Actions to call before doing real work
 * (booking, quoting, messaging, task-posting, signup). `action` and the
 * limit/window are always fixed constants chosen by the calling code —
 * never derived from request input — and the RPC itself derives "who" from
 * auth.uid() server-side, so this can't be used to target another user's
 * bucket even by a caller who invokes the RPC directly.
 *
 * Fails OPEN on an infrastructure error (can't reach the DB, unexpected
 * RPC error): rate limiting is an abuse/load safeguard, not an authz
 * boundary — RLS and each RPC's own ownership checks are what actually
 * keep the app safe, and those don't depend on this. A rate-limiter
 * outage blocking every booking/message/signup site-wide would be a far
 * worse outcome than occasionally letting extra requests through.
 */
export async function checkRateLimit(
  action: string,
  opts: { max: number; windowSeconds: number }
): Promise<{ allowed: boolean }> {
  const supabase = await createClient();

  // Only used for the pre-auth path (rpc_check_rate_limit ignores this
  // entirely once a session exists) — the best identity signal available
  // before a user has an account, same as every basic app-layer limiter.
  const hdrs = await headers();
  const anonKey = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;

  const { data, error } = await supabase.rpc("rpc_check_rate_limit", {
    p_action: action,
    p_max_count: opts.max,
    p_window_seconds: opts.windowSeconds,
    p_anon_key: anonKey,
  });

  if (error) {
    console.error(JSON.stringify({ event: "rate_limit_check_failed", action, error: error.message }));
    return { allowed: true };
  }
  return { allowed: data === true };
}
