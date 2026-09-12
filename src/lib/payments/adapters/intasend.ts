import type { PaymentProviderAdapter, ParsedPaymentEvent } from "../provider";

/**
 * IntaSend collection-webhook adapter.
 *
 * Field names below (`invoice_id`, `state`, `api_ref`, `net_amount`,
 * `currency`, `failed_reason`) are taken from IntaSend's published
 * Payment Collection Events docs
 * (https://developers.intasend.com/docs/payment-collection-events,
 * https://developers.intasend.com/docs/payment-status) as of this
 * writing — confirm they still match before activating this in
 * production; a vendor's webhook schema can change between doc revisions
 * and this file was never run against a real IntaSend account.
 *
 * `api_ref` is the field IntaSend echoes back verbatim from whatever you
 * sent when you created the collection request — this is where our own
 * `service_transactions.id` must be placed at collection-creation time
 * (not built here; that's the "create a collection request" half of the
 * integration, which needs a real IntaSend account/API key to build and
 * test against and is intentionally not fabricated in this pass).
 *
 * SIGNATURE VERIFICATION IS NOT IMPLEMENTED. IntaSend's webhook
 * authenticity mechanism (per https://developers.intasend.com/docs/webhooks)
 * must be read and implemented here before this adapter is ever activated
 * — verifyWebhookSignature fails closed (always returns false) rather
 * than fabricate a verification scheme this session couldn't confirm
 * against a real account. A closed gate is the safe default: it means
 * every event lands as "processed: false, processing_error: signature did
 * not verify" for manual reconciliation, never a silently-trusted forgery.
 */
export const intasendAdapter: PaymentProviderAdapter = {
  key: "intasend",

  verifyWebhookSignature(_rawBody: string, _headers: Headers): boolean {
    // TODO before activating: implement IntaSend's actual webhook
    // authenticity check (challenge string or signature header — confirm
    // which from their current docs) and compare against
    // process.env.INTASEND_WEBHOOK_SECRET. Until then this must stay
    // `false` — see the file header.
    return false;
  },

  parseWebhookEvent(rawBody: string): ParsedPaymentEvent {
    const body = JSON.parse(rawBody) as {
      invoice_id?: string;
      state?: string;
      api_ref?: string;
      net_amount?: number;
      value?: number;
      currency?: string;
      failed_reason?: string;
    };

    const eventType: ParsedPaymentEvent["eventType"] =
      body.state === "COMPLETE"
        ? "collection.completed"
        : body.state === "FAILED"
          ? "collection.failed"
          : "other";

    // api_ref carries our transaction id, set when the collection request
    // was created — see the file header on why that half isn't built yet.
    const transactionId = body.api_ref ?? null;

    // net_amount vs value: IntaSend's docs list both; net_amount (after
    // their processing fee) is NOT what should be compared against
    // total_amount_minor — confirm which field represents the gross
    // customer-paid amount before wiring this for real.
    const amountMinorRaw = body.value ?? body.net_amount;

    return {
      eventType,
      transactionId,
      externalReference: body.invoice_id ?? "",
      amountMinor: typeof amountMinorRaw === "number" ? Math.round(amountMinorRaw * 100) : null,
      currency: body.currency ?? null,
    };
  },
};
