import type { VerificationProviderAdapter, ParsedIdentityCheckResult } from "../provider";

/**
 * Kora Identity adapter — Kenya coverage confirmed (National ID, passport,
 * phone, KRA PIN) per https://developers.korapay.com/docs/kyc-kenya and
 * https://www.korahq.com/identity, pay-per-successful-check pricing.
 *
 * IMPORTANT, read before wiring this up: Kora's own docs describe
 * verification as request/query-based — you submit a verification
 * request and later `GET
 * https://api.korapay.com/merchant/api/v1/identities/verifications/:reference`
 * (https://developers.korapay.com/docs/managing-verifications) — not
 * confirmed here as a webhook-push vendor. That means the real
 * integration point is likely a direct, synchronous server-side call from
 * wherever a provider's verification is submitted (extend
 * `rpc_submit_for_verification`'s server action to call Kora, then call
 * `rpc_record_identity_check` directly with the result), NOT this
 * webhook route. This file exists so the adapter *interface* has a
 * concrete second example beside IntaSend, and in case Kora's identity
 * product does support a push webhook for asynchronous checks (e.g.
 * liveness, which often takes longer than a request/response cycle) —
 * confirm against their current docs before relying on either path.
 *
 * SIGNATURE VERIFICATION IS NOT IMPLEMENTED, same reasoning as the
 * IntaSend adapter: fails closed rather than fabricate a scheme this
 * session couldn't confirm against a real Kora account.
 */
export const koraAdapter: VerificationProviderAdapter = {
  key: "kora",

  verifyWebhookSignature(_rawBody: string, _headers: Headers): boolean {
    // TODO before activating: confirm Kora's webhook authenticity
    // mechanism (if they push at all — see file header) against
    // process.env.KORA_WEBHOOK_SECRET. Until then this must stay `false`.
    return false;
  },

  parseWebhookEvent(rawBody: string): ParsedIdentityCheckResult & { providerId: string } {
    const body = JSON.parse(rawBody) as {
      reference?: string;
      status?: string; // Kora's exact enum values not confirmed against a live account
      verification_type?: string;
      metadata?: { provider_id?: string };
    };

    const status: ParsedIdentityCheckResult["status"] =
      body.status === "verified" || body.status === "success"
        ? "passed"
        : body.status === "failed" || body.status === "declined"
          ? "failed"
          : body.status === "pending"
            ? "pending"
            : "manual_review";

    return {
      checkType: body.verification_type ?? "id_document",
      externalReference: body.reference ?? "",
      status,
      raw: body,
      // Our own provider id must be round-tripped through Kora as
      // metadata on the original verification request, same pattern as
      // IntaSend's api_ref — not fabricated here, needs a real account.
      providerId: body.metadata?.provider_id ?? "",
    };
  },
};
