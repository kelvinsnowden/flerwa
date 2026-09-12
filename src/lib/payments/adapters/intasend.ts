import crypto from "crypto";
import type { PaymentProviderAdapter, ParsedPaymentEvent } from "../provider";

/**
 * IntaSend collection adapter — webhook verification, event parsing, and
 * the outbound "create a collection request" call (M-Pesa STK push).
 *
 * Grounded in IntaSend's published docs as of this writing:
 * - Webhooks: https://developers.intasend.com/docs/webhooks — IntaSend's
 *   authenticity mechanism is a "challenge" string you set once when
 *   configuring the webhook endpoint in their dashboard; IntaSend echoes
 *   it back on every webhook call and you compare it against the value
 *   you stored. This is NOT an HMAC signature — it's a shared secret
 *   compared directly, so a constant-time string compare is what matters
 *   here, not a digest.
 * - Payment Collection Events: https://developers.intasend.com/docs/payment-collection-events,
 *   https://developers.intasend.com/docs/payment-status — field names
 *   (`invoice_id`, `state`, `api_ref`, `net_amount`/`value`, `currency`,
 *   `failed_reason`).
 * - M-Pesa STK Push: https://developers.intasend.com/docs/m-pesa-stk-push
 *   — `POST /api/v1/payment/mpesa-stk-push/`, `Authorization: Bearer
 *   <secret key>`, body includes `amount`, `phone_number`, `currency`,
 *   `api_ref`, `public_key`.
 *
 * Confirm all of the above against IntaSend's current docs before
 * activating in production — API surfaces change between doc revisions
 * and none of this was tested against a live IntaSend account.
 */

function intasendBaseUrl(): string {
  const env = process.env.INTASEND_ENV ?? "sandbox";
  return env === "production" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so this branch takes
    // roughly the same time either way — a cheap mitigation against
    // length-leaking timing, not a substitute for equal-length inputs.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export const intasendAdapter: PaymentProviderAdapter = {
  key: "intasend",

  verifyWebhookSignature(rawBody: string): boolean {
    const configuredChallenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
    if (!configuredChallenge) return false; // not configured yet — fail closed, don't guess

    let body: { challenge?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return false;
    }
    if (!body.challenge) return false;
    return timingSafeStringEqual(body.challenge, configuredChallenge);
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

    const transactionId = body.api_ref ?? null;

    // net_amount vs value: IntaSend's docs list both; confirm which one
    // represents the gross customer-paid amount (not net-of-fees) before
    // relying on this for the amount-match guard in rpc_ingest_payment_event.
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

export interface CreateCollectionResult {
  ok: boolean;
  invoiceId?: string;
  error?: string;
}

/**
 * Initiates an M-Pesa STK push for a transaction. Requires
 * `INTASEND_SECRET_KEY` (and optionally `INTASEND_PUBLIC_KEY`) to be set —
 * without a real IntaSend account these are unset, so this returns a
 * clear `{ ok: false, error: "..." }` rather than pretending to succeed.
 * `transactionId` is sent as `api_ref` so the webhook above can round-trip
 * it back to fund the right row.
 */
export async function createIntasendCollection(
  transactionId: string,
  amountMinor: number,
  currency: string,
  phoneNumber: string
): Promise<CreateCollectionResult> {
  const secretKey = process.env.INTASEND_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "INTASEND_SECRET_KEY is not configured — no real IntaSend account is connected yet." };
  }

  try {
    const res = await fetch(`${intasendBaseUrl()}/api/v1/payment/mpesa-stk-push/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        public_key: process.env.INTASEND_PUBLIC_KEY,
        amount: amountMinor / 100,
        phone_number: phoneNumber,
        currency,
        api_ref: transactionId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: typeof data?.detail === "string" ? data.detail : `IntaSend returned HTTP ${res.status}.` };
    }
    return { ok: true, invoiceId: data?.invoice?.invoice_id ?? data?.invoice_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach IntaSend." };
  }
}
