import crypto from "crypto";
import type { PayoutProviderAdapter, ParsedPayoutEvent, InitiatePayoutParams, InitiatePayoutResult } from "../provider";

/**
 * IntaSend payout ("Send Money" / B2C) adapter.
 *
 * Grounded in IntaSend's publicly documented Send Money / Payouts API as
 * of this writing:
 * - https://developers.intasend.com/docs/send-money-mpesa-b2c — B2C
 *   disbursement to an M-Pesa number, requires a funded IntaSend wallet.
 *   POST /api/v1/send-money/initiate/ with `Authorization: Bearer
 *   <secret key>`, body { currency, provider: "MPESA-B2C", transactions:
 *   [{ name, account, amount, narrative }] } — `account` is the
 *   recipient's phone number.
 * - Status/webhooks reuse the SAME shared-"challenge" mechanism as
 *   collections (https://developers.intasend.com/docs/webhooks) — one
 *   webhook endpoint configured in the IntaSend dashboard, IntaSend
 *   echoes back the configured challenge string on every delivery
 *   (collection AND payout events both), so verification here is
 *   identical to src/lib/payments/adapters/intasend.ts's.
 *
 * IMPORTANT — unlike the collection adapter, the exact response/webhook
 * field names for a Send Money transaction (the tracking id used to
 * correlate an async completion callback back to the transactions[]
 * entry that was submitted) were not independently re-verified against
 * a live IntaSend payouts account for this pass. Confirm the response
 * shape (`tracking_id` vs `transaction_id` vs something else) and the
 * payout webhook's actual field names against IntaSend's current docs
 * before activating this in production — same standard already applied
 * to the collection adapters in this codebase, which also carry this
 * disclaimer.
 *
 * Correlating a webhook back to OUR payout row does not rely on IntaSend
 * echoing any custom reference we set (Send Money's `narrative` field is
 * free text, not guaranteed to round-trip structurally) — instead,
 * initiatePayout below returns whatever tracking reference IntaSend's
 * own API hands back, which gets stored as payouts.external_reference
 * (via rpc_record_payout_attempt), and the payout webhook route
 * (src/app/api/webhooks/payouts/route.ts) looks up the payout by that
 * same external_reference before calling rpc_ingest_payout_event — the
 * same "resolve by our own stored value, never trust an unauthenticated
 * payload's claim" principle the Pesapal collection adapter uses.
 */

function intasendBaseUrl(): string {
  const env = process.env.INTASEND_ENV ?? "sandbox";
  return env === "production" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export const intasendPayoutAdapter: PayoutProviderAdapter = {
  key: "intasend",

  async initiatePayout(params: InitiatePayoutParams): Promise<InitiatePayoutResult> {
    const secretKey = process.env.INTASEND_PAYOUT_SECRET_KEY ?? process.env.INTASEND_SECRET_KEY;
    if (!secretKey) {
      return { ok: false, error: "INTASEND_PAYOUT_SECRET_KEY / INTASEND_SECRET_KEY is not configured — no real IntaSend payouts account is connected yet." };
    }

    try {
      const res = await fetch(`${intasendBaseUrl()}/api/v1/send-money/initiate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}` },
        body: JSON.stringify({
          currency: params.currency,
          provider: "MPESA-B2C",
          transactions: [
            {
              name: "Provider payout",
              account: params.destinationPhone,
              amount: params.amountMinor / 100,
              narrative: `Payout ${params.payoutId}`,
            },
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: typeof data?.detail === "string" ? data.detail : `IntaSend returned HTTP ${res.status}.` };
      }
      const trackingId = data?.tracking_id ?? data?.transactions?.[0]?.tracking_id ?? data?.id;
      if (!trackingId) {
        return { ok: false, error: "IntaSend accepted the payout request but returned no tracking reference." };
      }
      return { ok: true, externalReference: String(trackingId) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach IntaSend." };
    }
  },

  verifyWebhookSignature(rawBody: string): boolean {
    const configuredChallenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
    if (!configuredChallenge) return false;

    let body: { challenge?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return false;
    }
    if (!body.challenge) return false;
    return timingSafeStringEqual(body.challenge, configuredChallenge);
  },

  parseWebhookEvent(rawBody: string): ParsedPayoutEvent {
    const body = JSON.parse(rawBody) as {
      tracking_id?: string;
      transaction_id?: string;
      state?: string;
      value?: number;
      amount?: number;
      currency?: string;
    };

    const externalReference = body.tracking_id ?? body.transaction_id ?? "";

    const eventType: ParsedPayoutEvent["eventType"] =
      body.state === "COMPLETE" ? "payout.completed" : body.state === "FAILED" ? "payout.failed" : "other";

    const amountMinorRaw = body.value ?? body.amount;

    return {
      eventType,
      // Resolved by the webhook route from payouts.external_reference,
      // not trusted from this unauthenticated payload — see file header.
      payoutId: null,
      externalReference,
      amountMinor: typeof amountMinorRaw === "number" ? Math.round(amountMinorRaw * 100) : null,
      currency: body.currency ?? null,
    };
  },
};
