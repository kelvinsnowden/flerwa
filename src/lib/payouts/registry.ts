import "server-only";
import type { PayoutProviderAdapter } from "./provider";
import { intasendPayoutAdapter } from "./adapters/intasend-payout";

/**
 * Every vendor this codebase knows how to speak to for OUTBOUND provider
 * payouts, keyed exactly like `payout_providers.key`. Deliberately does
 * NOT include 'pesapal': Pesapal is a collections/checkout gateway with
 * no publicly documented outbound B2C disbursement API, unlike
 * src/lib/payments/registry.ts, which covers collections for both
 * vendors. Do not add a Pesapal payout adapter here without first
 * confirming Pesapal actually offers one — see the migration proposal's
 * design notes (migration_proposals/PROPOSED_automated_provider_payouts.sql).
 */
export const payoutAdapters: Record<string, PayoutProviderAdapter> = {
  intasend: intasendPayoutAdapter,
};
