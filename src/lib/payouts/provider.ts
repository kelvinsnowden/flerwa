/**
 * The seam a real payout (disbursement) vendor plugs into — the outbound
 * counterpart to src/lib/payments/provider.ts's collection adapter
 * interface, and deliberately a SEPARATE registry: which vendor
 * collects customer payments and which vendor sends provider payouts
 * are independent choices (see migration_proposals/PROPOSED_automated_
 * provider_payouts.sql for why payout_providers is its own table rather
 * than a new `kind` on payment_providers).
 *
 * `manual` (ops sends money by hand) is NOT an adapter here, same as
 * payments/provider.ts's `manual` — there is no inbound webhook to
 * verify for a manual payout, only rpc_admin_retry_payout as the human
 * escape hatch when nothing here is active.
 */

export interface InitiatePayoutParams {
  payoutId: string;
  amountMinor: number;
  currency: string;
  destinationPhone: string;
}

export interface InitiatePayoutResult {
  ok: boolean;
  externalReference?: string;
  error?: string;
}

export interface ParsedPayoutEvent {
  /** Only 'payout.completed'/'payout.failed' change a payout's state; every
   * other event type is still recorded (see rpc_ingest_payout_event) but
   * never acted on. */
  eventType: "payout.completed" | "payout.failed" | "other";
  /** Our own payout id — must be recoverable from whatever reference the
   * adapter attached when it initiated the transfer, never guessed. */
  payoutId: string | null;
  externalReference: string;
  amountMinor: number | null;
  currency: string | null;
}

export interface PayoutProviderAdapter {
  key: string;
  /** Sends the actual money. Called once per attempt from the server
   * action layer (never from the browser) with a phone number already
   * snapshotted onto the payouts row at release time — see the
   * money-safety notes in the migration proposal. */
  initiatePayout(params: InitiatePayoutParams): Promise<InitiatePayoutResult>;
  /** Same authenticity contract as PaymentProviderAdapter.verifyWebhookSignature
   * — return false on any doubt. */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean | Promise<boolean>;
  parseWebhookEvent(rawBody: string, headers: Headers): ParsedPayoutEvent | Promise<ParsedPayoutEvent>;
}
