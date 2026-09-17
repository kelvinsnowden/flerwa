/**
 * The seam a real payment aggregator plugs into. Nothing in the rest of
 * the app (webhook route, RPCs, admin UI) knows or cares which vendor is
 * behind this interface — same "provider abstraction" pattern this
 * codebase already uses for the SMS vendor behind phone OTP (see
 * SECURITY.md, "Phone + OTP authentication"). Adding a new aggregator
 * means writing one adapter file and registering it in `registry.ts`,
 * never touching the webhook route, the RPCs, or the admin UI.
 *
 * `manual` (M-Pesa Till/Paybill, admin-confirmed via /admin/payments) is
 * NOT an adapter here — it has no inbound webhook to verify, it's driven
 * entirely by the existing `rpc_confirm_manual_payment` admin action. This
 * registry only covers automated aggregators.
 */

export interface ParsedPaymentEvent {
  /** Only 'collection.completed' triggers funding; every other event type is
   * still recorded (see rpc_ingest_payment_event) but never acted on. */
  eventType: "collection.completed" | "collection.failed" | "refund" | "other";
  /** Our own transaction id — must be recoverable from whatever reference
   * the adapter attached when it created the collection request (an
   * `api_ref`/`metadata` field on the vendor's side), never guessed. */
  transactionId: string | null;
  externalReference: string;
  amountMinor: number | null;
  currency: string | null;
}

export interface PaymentProviderAdapter {
  key: string;
  /**
   * MUST verify the webhook's authenticity using the vendor's own signing
   * scheme (HMAC header, shared "challenge" string, IP allowlist — whatever
   * that vendor actually documents) before anything in the payload is
   * trusted. Return false on any doubt; a false negative just means an
   * admin reconciles it by hand later — a false positive lets an attacker
   * fabricate a "payment complete" event. Never skip this to "get it
   * working" — see rpc_ingest_payment_event's own guard, which refuses to
   * fund a transaction when this comes back false.
   */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean | Promise<boolean>;
  /**
   * Called regardless of what verifyWebhookSignature returned (the route
   * still records an unverified event for reconciliation) — never used to
   * decide trust itself. `signatureVerified` above is what
   * rpc_ingest_payment_event actually gates funding on.
   *
   * Return type is `| Promise<...>` because not every vendor's
   * authenticity check is "hash this payload against a shared secret":
   * Pesapal's IPN carries no signature at all — the only way to know an
   * inbound tracking id is real is to call back Pesapal's own API with
   * our own OAuth credentials and read the authoritative status, which is
   * inherently async. A vendor like IntaSend that can verify+parse
   * synchronously just returns a plain value; `await` resolves that
   * immediately either way.
   */
  parseWebhookEvent(rawBody: string, headers: Headers): ParsedPaymentEvent | Promise<ParsedPaymentEvent>;

  /**
   * Optional: a real, side-effect-free authenticated call to the vendor's
   * API proving the configured credentials actually work — not a presence
   * check. Absent entirely if a vendor has no safe way to do this without
   * creating a real collection/order. Must never throw; return
   * { ok: false, error } exactly like every other adapter method here.
   */
  testConnection?(): Promise<{ ok: boolean; error?: string }>;
}
