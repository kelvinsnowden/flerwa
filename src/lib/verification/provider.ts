/**
 * The seam a real KYC/identity vendor plugs into — same abstraction
 * philosophy as src/lib/payments/provider.ts, applied to identity checks
 * instead of money. `manual` (admin reviews uploaded documents at
 * /admin/verifications) is not an adapter here; it's the existing
 * behaviour, untouched.
 *
 * Deliberately narrow: an adapter only ever produces a *result record*
 * (rpc_record_identity_check). It never itself flips
 * `providers.verification_status` — that stays behind the existing
 * admin-gated `rpc_set_verification_status`, on purpose. See
 * docs/06-trust-architecture.md: "verified" is a claim made to a
 * customer, and this project's rule is a human makes that claim, a vendor
 * result only informs them. See docs/16-* for the (deliberately deferred)
 * design for an opt-in auto-approve path.
 */

export interface ParsedIdentityCheckResult {
  checkType: string; // e.g. "id_document", "liveness", "phone", "tax_pin"
  externalReference: string;
  status: "pending" | "passed" | "failed" | "manual_review";
  raw: unknown;
}

export interface VerificationProviderAdapter {
  key: string;
  /** Same authenticity requirement as PaymentProviderAdapter — verify
   * before trusting anything in the payload, for any vendor that pushes
   * results via webhook. */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhookEvent(rawBody: string): ParsedIdentityCheckResult & { providerId: string };
}
