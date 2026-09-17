import crypto from "crypto";
import type { EmailProviderAdapter, InboundAttachment, InboundWebhookBody, OutboundEmail, ParsedInboundEmail } from "../email-provider";
import { resolveCredentials } from "@/lib/integrations/resolve-credential";

/**
 * Mailgun adapter — the second EmailProviderAdapter implementation,
 * deliberately picked (like Pesapal for payments) because its inbound
 * shape is structurally different from Resend's, not just a re-skin:
 *
 * - Resend's inbound webhook is JSON, metadata-only, and requires a
 *   follow-up API call (fetchInboundBody) for the body/attachments.
 * - Mailgun's inbound "Routes" webhook POSTs the ENTIRE parsed email —
 *   body, headers, and attachment bytes — as one `multipart/form-data`
 *   request. There is no follow-up call; this adapter has no
 *   fetchInboundBody because there's nothing left to fetch.
 *
 * That's why `EmailProviderAdapter.verifyInboundWebhook`/
 * `.parseInboundEvent` now take an `InboundWebhookBody` (see
 * email-provider.ts) instead of a raw string: Mailgun's signature fields
 * (`timestamp`, `token`, `signature`) and email fields live in the form
 * body itself, and attachments arrive as real binary file parts that
 * would be corrupted by round-tripping through a JSON-oriented string.
 *
 * Grounded in Mailgun's published docs as of this writing:
 * - Sending: https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages/
 *   — `POST https://api.mailgun.net/v3/{domain}/messages` (or
 *   `api.eu.mailgun.net` for the EU region), HTTP Basic auth with
 *   username `api` and the private API key as the password,
 *   `application/x-www-form-urlencoded` body (`from`, `to`, `subject`,
 *   `text`, `html`, `h:In-Reply-To`, `h:References`).
 * - Inbound routing: https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/
 *   — a Route with a `forward()` action to an HTTPS URL POSTs the parsed
 *   MIME message as form fields: `sender`, `recipient`, `subject`,
 *   `body-plain`, `stripped-text`, `body-html`, `stripped-html`,
 *   `Message-Id`, `In-Reply-To`, `References`, `attachment-count`, and
 *   `attachment-1`..`attachment-N` as file parts.
 * - Webhook signing: https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/#securing-webhooks
 *   — every inbound POST (routes included) carries `timestamp`, `token`,
 *   and `signature` as regular form fields (not headers).
 *   `signature = hexdigest(HMAC-SHA256(key=<Mailgun signing key>,
 *   msg=timestamp + token))`. The signing key is the account's HTTP
 *   webhook signing key, shown in the Mailgun dashboard under Sending →
 *   Webhooks — a different value from the API key used to send.
 *
 * Confirm all of the above against Mailgun's current docs before
 * activating in production — none of it was tested against a live
 * Mailgun account.
 */

function mailgunBaseUrl(region: string | undefined): string {
  return region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
}

/** Admin-managed if saved via /admin/integrations, else falls back to
 * this deployment's own MAILGUN_API_KEY/MAILGUN_DOMAIN/MAILGUN_REGION.
 * Not used by verifyInboundWebhook below (MAILGUN_WEBHOOK_SIGNING_KEY), a
 * deliberately separate, deployment-managed-only, synchronously-checked
 * secret — same boundary as the Resend adapter. */
async function getMailgunCredentials() {
  return resolveCredentials("email", "mailgun");
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

export const mailgunAdapter: EmailProviderAdapter = {
  key: "mailgun",

  async sendEmail(msg: OutboundEmail) {
    const { MAILGUN_API_KEY: apiKey, MAILGUN_DOMAIN: domain, MAILGUN_REGION } = await getMailgunCredentials();
    if (!apiKey || !domain) {
      return { ok: false, error: "MAILGUN_API_KEY / MAILGUN_DOMAIN is not configured." };
    }

    const form = new URLSearchParams();
    form.set("from", msg.from);
    form.set("to", msg.to);
    form.set("subject", msg.subject);
    form.set("text", msg.text);
    if (msg.html) form.set("html", msg.html);
    if (msg.inReplyTo) form.set("h:In-Reply-To", msg.inReplyTo);
    if (msg.references?.length) form.set("h:References", msg.references.join(" "));

    try {
      const res = await fetch(`${mailgunBaseUrl(MAILGUN_REGION)}/v3/${domain}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: typeof data?.message === "string" ? data.message : `Mailgun returned HTTP ${res.status}.` };
      }
      return { ok: true, providerMessageId: typeof data?.id === "string" ? data.id : undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Mailgun." };
    }
  },

  verifyInboundWebhook(body: InboundWebhookBody): boolean {
    // Mailgun always posts routes as form data — a "text" body here means
    // this route is misconfigured to point a different vendor's inbound
    // delivery at Mailgun's adapter, not a real Mailgun webhook.
    if (body.kind !== "form") return false;

    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    if (!signingKey) return false; // not configured — fail closed, don't guess

    const { timestamp, token, signature } = body.fields;
    if (!timestamp || !token || !signature) return false;

    // Reject anything outside a 5-minute window — same replay-protection
    // tolerance as the Resend/Svix adapter.
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      return false;
    }

    const expected = crypto.createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");
    return timingSafeStringEqual(signature, expected);
  },

  parseInboundEvent(body: InboundWebhookBody): ParsedInboundEmail | null {
    if (body.kind !== "form") return null;
    const f = body.fields;

    if (!f.sender && !f.from) return null;

    const references = typeof f["References"] === "string" ? f["References"].split(/\s+/).filter(Boolean) : [];

    // Mailgun attaches each file part under its own `attachment-N` field
    // name — the route already read these as real bytes via
    // Request.formData(), so no follow-up fetch (unlike Resend) is needed.
    const attachments: InboundAttachment[] = body.files.map((file) => ({
      filename: file.filename,
      contentType: file.contentType,
      contentBase64: Buffer.from(file.bytes).toString("base64"),
      sizeBytes: file.bytes.byteLength,
    }));

    return {
      fromEmail: parseEmailAddress(f.sender ?? f.from ?? ""),
      fromName: parseDisplayName(f.from ?? f.sender ?? ""),
      toEmail: parseEmailAddress(f.recipient ?? ""),
      subject: f.subject ?? "",
      text: f["stripped-text"] || f["body-plain"] || "",
      html: f["stripped-html"] || f["body-html"] || null,
      messageId: f["Message-Id"] || null,
      inReplyTo: f["In-Reply-To"] || null,
      references,
      attachments,
    };
  },

  // No fetchInboundBody — see this file's header comment: Mailgun's route
  // webhook already delivers the full body and attachment bytes inline.

  // GET /v3/domains — a read-only, side-effect-free authenticated call
  // (https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Domains/),
  // confirming MAILGUN_API_KEY is valid without sending a real email. Same
  // "grounded in docs, not independently tested against a live account"
  // caveat as this file's other endpoints. Uses the account-level domains
  // list rather than a single-domain lookup so it still proves the key
  // works even if MAILGUN_DOMAIN itself is misconfigured.
  async testConnection() {
    const { MAILGUN_API_KEY: apiKey, MAILGUN_REGION } = await getMailgunCredentials();
    if (!apiKey) {
      return { ok: false, error: "MAILGUN_API_KEY is not configured." };
    }
    try {
      const res = await fetch(`${mailgunBaseUrl(MAILGUN_REGION)}/v3/domains`, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: typeof data?.message === "string" ? data.message : `Mailgun returned HTTP ${res.status}.` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Mailgun." };
    }
  },
};

function parseEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

function parseDisplayName(raw: string): string | null {
  const match = raw.match(/^"?([^"<]*)"?\s*<[^>]+>$/);
  const name = match?.[1]?.trim();
  return name ? name : null;
}
