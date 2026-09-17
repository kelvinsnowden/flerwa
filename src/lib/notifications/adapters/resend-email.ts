import crypto from "crypto";
import type { EmailProviderAdapter, InboundAttachment, InboundWebhookBody, OutboundEmail, ParsedInboundEmail } from "../email-provider";

/**
 * Resend adapter — the first (not the only) EmailProviderAdapter
 * implementation. Nothing outside this file knows this is Resend; see
 * email-provider.ts's own header comment for why.
 *
 * Grounded in Resend/Svix's published docs as of this writing:
 * - Sending: https://resend.com/docs (POST https://api.resend.com/emails,
 *   Authorization: Bearer <RESEND_API_KEY>) — this exact endpoint is
 *   already proven working in this codebase by src/lib/alerts.ts.
 * - Inbound: https://resend.com/docs/dashboard/receiving/introduction —
 *   inbound went GA in late 2025; an `email.received` webhook fires with
 *   metadata only (from/to/subject/email_id), body/attachments require a
 *   follow-up API call.
 * - Webhook signing: Resend webhooks are signed by Svix — three headers
 *   (`svix-id`, `svix-timestamp`, `svix-signature`), HMAC-SHA256 over
 *   `${svix-id}.${svix-timestamp}.${raw_body}` using the base64-decoded
 *   secret (the part of `whsec_...` after the prefix) as the HMAC key,
 *   base64-encoded result, compared against each space-delimited
 *   `v1,<base64sig>` entry in `svix-signature`. Source:
 *   https://docs.svix.com/receiving/verifying-payloads/how-manual (this
 *   exact algorithm, confirmed via search since the docs.svix.com domain
 *   itself is blocked by this environment's egress proxy — verify the
 *   canonical page directly before relying on this in production).
 *
 * - Retrieve Received Email:
 *   https://resend.com/docs/api-reference/emails/retrieve-received-email —
 *   `GET https://api.resend.com/emails/receiving/{email_id}`, same
 *   `Authorization: Bearer <RESEND_API_KEY>` header as sending. Confirmed
 *   directly (resend.com itself is blocked by this environment's egress
 *   proxy, but this exact path/method was returned verbatim from Resend's
 *   own docs page title and content via search) — this is what
 *   `fetchResendInboundBody` below calls. The response shape (`text`,
 *   `html`, header fields, attachment list) was not independently
 *   fetched from a live sample in this session; field names below are a
 *   best-effort mapping and should be checked against one real inbound
 *   email before this goes live, matching the IntaSend adapter's own
 *   "confirm before activating" precedent.
 */

const RESEND_API_BASE = "https://api.resend.com";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export const resendEmailAdapter: EmailProviderAdapter = {
  key: "resend",

  async sendEmail(msg: OutboundEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY is not configured." };
    }

    try {
      const res = await fetch(`${RESEND_API_BASE}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: msg.from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          ...(msg.html ? { html: msg.html } : {}),
          ...(msg.inReplyTo || msg.references?.length
            ? {
                headers: {
                  ...(msg.inReplyTo ? { "In-Reply-To": msg.inReplyTo } : {}),
                  ...(msg.references?.length ? { References: msg.references.join(" ") } : {}),
                },
              }
            : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: typeof data?.message === "string" ? data.message : `Resend returned HTTP ${res.status}.` };
      }
      return { ok: true, providerMessageId: data?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Resend." };
    }
  },

  verifyInboundWebhook(body: InboundWebhookBody, headers: Headers): boolean {
    // Resend's webhooks are always JSON — a "form" body here would mean
    // this route is misconfigured to point a different vendor's inbound
    // route at Resend's adapter, not a real Resend delivery.
    if (body.kind !== "text") return false;
    const rawBody = body.raw;

    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret || !secret.includes("_")) return false; // not configured — fail closed, don't guess

    const svixId = headers.get("svix-id");
    const svixTimestamp = headers.get("svix-timestamp");
    const svixSignature = headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) return false;

    // Reject anything outside a 5-minute window — the Standard Webhooks
    // spec's own recommended replay-protection tolerance.
    const timestampSeconds = Number(svixTimestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      return false;
    }

    const secretBytes = Buffer.from(secret.split("_").slice(1).join("_"), "base64");
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

    return svixSignature
      .split(" ")
      .map((entry) => entry.split(",")[1])
      .filter((sig): sig is string => !!sig)
      .some((sig) => timingSafeStringEqual(sig, expected));
  },

  parseInboundEvent(body: InboundWebhookBody): ParsedInboundEmail | null {
    if (body.kind !== "text") return null;

    let event: {
      type?: string;
      data?: { email_id?: string; from?: string; to?: string[]; subject?: string };
    };
    try {
      event = JSON.parse(body.raw);
    } catch {
      return null;
    }

    if (event.type !== "email.received" || !event.data?.email_id) return null;

    // The webhook payload itself is metadata-only (Resend's own design —
    // see this file's header comment) — text/html/attachments/threading
    // headers require the follow-up fetchInboundBody call below. messageId
    // is set to Resend's email_id here (the key fetchInboundBody needs),
    // NOT the RFC 5322 Message-ID header — fetchInboundBody's own result
    // carries that once available.
    return {
      fromEmail: event.data.from ?? "",
      fromName: null,
      toEmail: event.data.to?.[0] ?? "",
      subject: event.data.subject ?? "",
      text: "",
      html: null,
      messageId: event.data.email_id,
      inReplyTo: null,
      references: [],
      attachments: [],
    };
  },

  fetchInboundBody: fetchResendInboundBody,

  // GET /domains — a read-only, side-effect-free authenticated call
  // (https://resend.com/docs/api-reference/domains/list-domains),
  // confirming RESEND_API_KEY is valid without sending a real email.
  // Same "grounded in docs, not independently tested against a live
  // account" caveat as this file's other endpoints.
  async testConnection() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY is not configured." };
    }
    try {
      const res = await fetch(`${RESEND_API_BASE}/domains`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: typeof data?.message === "string" ? data.message : `Resend returned HTTP ${res.status}.` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Resend." };
    }
  },
};

/**
 * Fetches the full body/headers/attachments for an inbound email given
 * the `email_id` from the webhook payload — implements
 * EmailProviderAdapter.fetchInboundBody for this vendor; the inbound
 * webhook route calls it only through that interface, never by name.
 * Endpoint confirmed — see this file's header comment; exact response
 * field names are a best-effort mapping pending a live sample.
 */
async function fetchResendInboundBody(emailId: string): Promise<{
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  attachments: InboundAttachment[];
} | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${RESEND_API_BASE}/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();

    return {
      text: data?.text ?? "",
      html: data?.html ?? null,
      messageId: data?.headers?.["message-id"] ?? data?.message_id ?? null,
      inReplyTo: data?.headers?.["in-reply-to"] ?? null,
      references: typeof data?.headers?.references === "string" ? data.headers.references.split(/\s+/).filter(Boolean) : [],
      attachments: await fetchResendInboundAttachments(emailId),
    };
  } catch {
    return null;
  }
}

/**
 * Lists attachments for a received email as a separate call — Resend
 * exposes attachment listing/retrieval as its own operation, distinct
 * from the email body (confirmed at the product level; this exact
 * `/attachments` sub-path is inferred from the receiving-email path's
 * own convention and NOT independently confirmed against raw REST docs
 * in this session — verify before relying on it). Each attachment
 * carries a time-limited download URL we fetch immediately and
 * re-upload to our own storage (never store a vendor-hosted URL
 * long-term — it expires and we'd lose the file).
 */
async function fetchResendInboundAttachments(emailId: string): Promise<InboundAttachment[]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`${RESEND_API_BASE}/emails/receiving/${emailId}/attachments`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: Array<{ filename?: string; content_type?: string; size?: number; url?: string }> = data?.data ?? [];

    return items
      .filter((item) => item.url)
      .map((item) => ({
        filename: item.filename ?? "attachment",
        contentType: item.content_type ?? "application/octet-stream",
        url: item.url,
        sizeBytes: item.size,
      }));
  } catch {
    return [];
  }
}
