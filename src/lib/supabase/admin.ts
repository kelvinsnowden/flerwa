import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE ROLE client. Bypasses RLS entirely.
 *
 * `import "server-only"` makes any accidental client-side import a BUILD
 * ERROR, not a runtime leak — this is the load-bearing safety net for the
 * single most dangerous file in the codebase.
 *
 * Legitimate uses are narrow and enumerated in SECURITY.md: the auto-approve
 * sweep's own service action, and admin-panel reads that genuinely need to
 * cross RLS boundaries in ways is_admin()-gated RPCs don't already cover.
 * Prefer the rpc_* SECURITY DEFINER functions (called via the normal server
 * client) over this file for anything that isn't purely a read.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This is expected in most of the " +
        "app — if you're seeing this, you probably want src/lib/supabase/server.ts instead."
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
