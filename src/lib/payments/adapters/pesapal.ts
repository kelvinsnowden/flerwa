import type { PaymentProviderAdapter, ParsedPaymentEvent } from "../provider";
import { resolveCredentials } from "@/lib/integrations/resolve-credential";

/**
 * Pesapal adapter — grounded in Pesapal's published API v3 docs
 * (developers.pesapal.com) as of this writing. Confirm all of this
 * against Pesapal's current docs before activating in production — none
 * of it was tested against a live Pesapal account.
 *
 * Pesapal's integration shape is structurally different from IntaSend's,
 * which is why this adapter exists rather than trying to force IntaSend's
 * shape onto it:
 *
 * - IntaSend prompts the customer's phone directly (STK push) and pushes
 *   a signed-ish webhook payload carrying the actual result.
 * - Pesapal redirects the customer to a Pesapal-hosted checkout page
 *   (they pick M-Pesa, card, etc. there) and its IPN callback carries
 *   only an `OrderTrackingId` — no amount, no status, no signature. The
 *   only trustworthy way to know what actually happened is to call
 *   `GetTransactionStatus` back on Pesapal's own API, authenticated with
 *   our own OAuth bearer token. That authenticated call-back *is* this
 *   adapter's signature verification — nobody can forge a "COMPLETED"
 *   response without our consumer secret, regardless of what an attacker
 *   POSTs to our IPN URL.
 *
 * Docs referenced:
 * - Auth: POST {base}/api/Auth/RequestToken — body { consumer_key,
 *   consumer_secret }, returns { token, expiryDate }.
 * - Register IPN (one-time, dashboard/CLI setup, not runtime): POST
 *   {base}/api/URLSetup/RegisterIPN — returns ipn_id, used below as
 *   PESAPAL_IPN_ID.
 * - Submit order: POST {base}/api/Transactions/SubmitOrderRequest — body
 *   { id, currency, amount, description, callback_url, notification_id,
 *   billing_address: { email_address, phone_number, ... } }, returns
 *   { order_tracking_id, redirect_url }.
 * - IPN callback: Pesapal POSTs { OrderTrackingId, OrderMerchantReference,
 *   OrderNotificationType } to whatever callback_url/IPN URL was
 *   registered.
 * - Status: GET {base}/api/Transactions/GetTransactionStatus?orderTrackingId=...
 *   — returns { payment_status_description, amount, currency,
 *   merchant_reference, confirmation_code, payment_method }.
 */

function pesapalBaseUrl(env: string | undefined): string {
  return env === "production" ? "https://pay.pesapal.com/v3" : "https://cybqa.pesapal.com/pesapalv3";
}

/** Admin-managed if saved via /admin/integrations, else falls back to this
 * deployment's own PESAPAL_* env vars — see resolve-credential.ts. Every
 * caller in this file is already async, so there's no sync/webhook-path
 * constraint like Kora's or the email adapters' inbound signature checks. */
async function getPesapalCredentials() {
  return resolveCredentials("payment", "pesapal");
}

type PesapalStatus = {
  payment_status_description?: string;
  amount?: number;
  currency?: string;
  merchant_reference?: string;
  confirmation_code?: string;
  payment_method?: string;
  error?: { code?: string; message?: string } | null;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getPesapalToken(): Promise<string | null> {
  const { PESAPAL_CONSUMER_KEY: consumerKey, PESAPAL_CONSUMER_SECRET: consumerSecret, PESAPAL_ENV } = await getPesapalCredentials();
  if (!consumerKey || !consumerSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  try {
    const res = await fetch(`${pesapalBaseUrl(PESAPAL_ENV)}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data?.token !== "string") return null;

    // Pesapal tokens are short-lived (~5 min per their docs); refresh a
    // little early rather than risk using one that just expired.
    cachedToken = { token: data.token, expiresAt: Date.now() + 4 * 60 * 1000 };
    return data.token;
  } catch {
    return null;
  }
}

// Short-lived cache so verifyWebhookSignature and parseWebhookEvent (which
// both need the same authoritative status for one IPN delivery) don't have
// to make two round-trips to Pesapal for the same OrderTrackingId.
const statusCache = new Map<string, { status: PesapalStatus; expiresAt: number }>();

async function getPesapalTransactionStatus(orderTrackingId: string): Promise<PesapalStatus | null> {
  const cached = statusCache.get(orderTrackingId);
  if (cached && cached.expiresAt > Date.now()) return cached.status;

  const token = await getPesapalToken();
  if (!token) return null;

  const { PESAPAL_ENV } = await getPesapalCredentials();

  try {
    const res = await fetch(
      `${pesapalBaseUrl(PESAPAL_ENV)}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    const data = (await res.json().catch(() => null)) as PesapalStatus | null;
    if (!res.ok || !data) return null;

    statusCache.set(orderTrackingId, { status: data, expiresAt: Date.now() + 30 * 1000 });
    return data;
  } catch {
    return null;
  }
}

function extractOrderTrackingId(rawBody: string): string | null {
  try {
    const body = JSON.parse(rawBody) as { OrderTrackingId?: string };
    return body.OrderTrackingId ?? null;
  } catch {
    return null;
  }
}

export const pesapalAdapter: PaymentProviderAdapter = {
  key: "pesapal",

  async verifyWebhookSignature(rawBody: string): Promise<boolean> {
    const orderTrackingId = extractOrderTrackingId(rawBody);
    if (!orderTrackingId) return false;

    // "Verified" here means: we successfully authenticated back to
    // Pesapal's own API with our own consumer secret and got a real
    // status for this tracking id — not a header/HMAC check, because
    // Pesapal's IPN doesn't send one. An attacker can pick which real
    // OrderTrackingId to relay to us, but cannot fabricate what Pesapal
    // says about it, and rpc_ingest_payment_event's own transaction/
    // amount-match guards reject anything that doesn't correspond to a
    // transaction we actually created.
    const status = await getPesapalTransactionStatus(orderTrackingId);
    return status !== null && !status.error;
  },

  async parseWebhookEvent(rawBody: string): Promise<ParsedPaymentEvent> {
    const orderTrackingId = extractOrderTrackingId(rawBody);
    const status = orderTrackingId ? await getPesapalTransactionStatus(orderTrackingId) : null;

    if (!status) {
      return { eventType: "other", transactionId: null, externalReference: orderTrackingId ?? "", amountMinor: null, currency: null };
    }

    const eventType: ParsedPaymentEvent["eventType"] =
      status.payment_status_description === "COMPLETED"
        ? "collection.completed"
        : status.payment_status_description === "FAILED" ||
            status.payment_status_description === "INVALID" ||
            status.payment_status_description === "REVERSED"
          ? "collection.failed"
          : "other";

    return {
      eventType,
      // Our own transaction id, as returned by Pesapal's authoritative
      // status call — not read from the unauthenticated raw IPN body —
      // since we set merchant_reference to it in createPesapalOrder below.
      transactionId: status.merchant_reference ?? null,
      externalReference: orderTrackingId ?? "",
      amountMinor: typeof status.amount === "number" ? Math.round(status.amount * 100) : null,
      currency: status.currency ?? null,
    };
  },

  // Reuses the exact same RequestToken call getPesapalTransactionStatus
  // already depends on — no new endpoint, no side effects, nothing
  // billable. A successful token fetch proves PESAPAL_CONSUMER_KEY/SECRET
  // are valid and Pesapal's auth endpoint is reachable, which is the
  // entire trust chain this adapter's webhook verification rests on.
  async testConnection() {
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = await getPesapalCredentials();
    if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
      return { ok: false, error: "PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET are not configured." };
    }
    cachedToken = null; // force a real round-trip rather than reusing a cached token
    const token = await getPesapalToken();
    return token
      ? { ok: true }
      : { ok: false, error: "Could not authenticate with Pesapal — credentials were rejected or the API is unreachable." };
  },
};

export interface CreatePesapalOrderResult {
  ok: boolean;
  redirectUrl?: string;
  orderTrackingId?: string;
  error?: string;
}

/**
 * Submits a Pesapal order and returns the hosted checkout URL to redirect
 * the customer to — Pesapal has no STK-push equivalent; the customer
 * picks M-Pesa/card/etc. on Pesapal's own page. Requires
 * `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID`
 * (from the one-time RegisterIPN setup) and `PESAPAL_CALLBACK_URL` (where
 * Pesapal returns the browser after checkout) to be set — without a real
 * Pesapal account these are unset, so this returns a clear
 * `{ ok: false, error: "..." }` rather than pretending to succeed.
 * `transactionId` is sent as `merchant_reference` so the IPN callback
 * above can round-trip it back to fund the right row.
 */
export async function createPesapalOrder(
  transactionId: string,
  amountMinor: number,
  currency: string,
  email: string | null,
  phoneNumber: string
): Promise<CreatePesapalOrderResult> {
  const { PESAPAL_IPN_ID: ipnId, PESAPAL_CALLBACK_URL: callbackUrl } = await getPesapalCredentials();
  if (!ipnId || !callbackUrl) {
    return { ok: false, error: "PESAPAL_IPN_ID / PESAPAL_CALLBACK_URL are not configured — no real Pesapal account is connected yet." };
  }

  const token = await getPesapalToken();
  if (!token) {
    return { ok: false, error: "Could not authenticate with Pesapal — PESAPAL_CONSUMER_KEY/SECRET missing or rejected." };
  }
  const { PESAPAL_ENV } = await getPesapalCredentials();

  try {
    const res = await fetch(`${pesapalBaseUrl(PESAPAL_ENV)}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: transactionId,
        currency,
        amount: amountMinor / 100,
        description: "Marketplace service booking",
        callback_url: callbackUrl,
        notification_id: ipnId,
        billing_address: {
          email_address: email ?? undefined,
          phone_number: phoneNumber,
          country_code: "KE",
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      return { ok: false, error: typeof data?.error?.message === "string" ? data.error.message : `Pesapal returned HTTP ${res.status}.` };
    }
    if (!data?.redirect_url) {
      return { ok: false, error: "Pesapal accepted the order but returned no redirect URL." };
    }
    return { ok: true, redirectUrl: data.redirect_url, orderTrackingId: data.order_tracking_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach Pesapal." };
  }
}
