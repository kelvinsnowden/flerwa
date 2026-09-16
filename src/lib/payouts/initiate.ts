import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutAdapters } from "./registry";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type PendingPayoutRow = { id: string; amount_minor: number; currency: string; destination_phone: string };

/**
 * Attempts to actually send money for a single already-created payout
 * (withdrawal request) row. Shared by attemptPayout (called right after
 * rpc_request_payout succeeds) and the retry-sweep cron (scoped to
 * everything still 'pending' regardless of why — including one an admin
 * just reset via rpc_admin_retry_payout). Never throws — every outcome
 * is recorded via rpc_record_payout_attempt.
 */
async function attemptOnePayout(admin: SupabaseAdminClient, payout: PendingPayoutRow, activeProvider: { key: string } | null): Promise<void> {
  if (!activeProvider) {
    // No automated payout vendor is active — leave it 'pending' for an
    // admin to see on /admin/payouts and either configure a vendor or
    // pay it out by hand. Not an error: expected until one is connected.
    return;
  }

  const adapter = payoutAdapters[activeProvider.key];
  if (!adapter) {
    await admin.rpc("rpc_record_payout_attempt", {
      p_payout_id: payout.id,
      p_provider_key: activeProvider.key,
      p_success: false,
      p_external_reference: null,
      p_failure_reason: `Provider '${activeProvider.key}' is active but has no payout adapter registered in src/lib/payouts/registry.ts.`,
    });
    return;
  }

  try {
    const result = await adapter.initiatePayout({
      payoutId: payout.id,
      amountMinor: payout.amount_minor,
      currency: payout.currency,
      destinationPhone: payout.destination_phone,
    });
    await admin.rpc("rpc_record_payout_attempt", {
      p_payout_id: payout.id,
      p_provider_key: activeProvider.key,
      p_success: result.ok,
      p_external_reference: result.externalReference ?? null,
      p_failure_reason: result.ok ? null : (result.error ?? "Unknown payout initiation failure."),
    });
  } catch (err) {
    console.error("attemptOnePayout: initiatePayout threw", err);
    await admin.rpc("rpc_record_payout_attempt", {
      p_payout_id: payout.id,
      p_provider_key: activeProvider.key,
      p_success: false,
      p_external_reference: null,
      p_failure_reason: err instanceof Error ? err.message : "Unknown error initiating payout.",
    });
  }
}

/**
 * Fast path: attempts to send a single freshly-requested withdrawal
 * immediately. Called right after rpc_request_payout succeeds — outside
 * that DB transaction on purpose, so a slow/failed vendor HTTP call can
 * never block or fail the withdrawal request itself. Never throws (see
 * attemptOnePayout) — a missing SUPABASE_SERVICE_ROLE_KEY or any other
 * admin-client construction failure just leaves the payout 'pending' for
 * the retry-sweep cron to pick up.
 */
export async function attemptPayout(payoutId: string): Promise<void> {
  let admin: SupabaseAdminClient;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("attemptPayout: createAdminClient failed", err);
    return;
  }

  const { data: payout, error: payoutError } = await admin
    .from("payouts")
    .select("id, amount_minor, currency, destination_phone")
    .eq("id", payoutId)
    .eq("state", "pending")
    .maybeSingle();

  if (payoutError || !payout) return;

  const { data: activeProvider } = await admin.from("payout_providers").select("key").eq("is_active", true).maybeSingle();
  await attemptOnePayout(admin, payout, activeProvider ?? null);
}

/**
 * Sweep path: attempts every still-'pending' payout system-wide,
 * however it got there — a fast-path attempt that never fired (e.g. no
 * vendor was active yet at request time), or an admin's
 * rpc_admin_retry_payout resetting a failed one back to pending. Called
 * from the payout-retry-sweep cron route.
 */
export async function attemptAllPendingPayouts(limit = 200): Promise<{ attempted: number }> {
  const admin = createAdminClient();

  const { data: pending, error: pendingError } = await admin
    .from("payouts")
    .select("id, amount_minor, currency, destination_phone")
    .eq("state", "pending")
    .order("created_at")
    .limit(limit);

  if (pendingError || !pending?.length) return { attempted: 0 };

  const { data: activeProvider } = await admin.from("payout_providers").select("key").eq("is_active", true).maybeSingle();
  if (!activeProvider) return { attempted: 0 }; // nothing to do without a vendor to call

  for (const payout of pending) {
    await attemptOnePayout(admin, payout, activeProvider);
  }
  return { attempted: pending.length };
}
