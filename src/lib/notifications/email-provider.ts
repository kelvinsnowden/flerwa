/**
 * The seam any transactional-email vendor plugs into — identical shape to
 * src/lib/payments/provider.ts's PaymentProviderAdapter, deliberately.
 * Nothing in the support system (webhook route, RPCs, admin UI, outbound
 * send helper) is allowed to import a vendor SDK or call a vendor's API
 * directly; everything goes through whichever adapter `registry.ts`
 * resolves as active. Adding a new vendor means one new adapter file plus
 * one registry line, never touching the routes/RPCs/UI that use this.
 */

export interface OutboundEmail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  /** Set to thread a reply under an existing message (RFC 5322 In-Reply-To). */
  inReplyTo?: string;
  /** Full ancestor chain, oldest first, per RFC 5322 References. */
  references?: string[];
}

export interface InboundAttachment {
  filename: string;
  contentType: string;
  /** Base64-encoded content, if the vendor delivers it inline; otherwise
   * a fetchable URL the caller downloads and re-uploads to our own
   * storage (never trust a vendor-hosted URL to stay valid long-term). */
  contentBase64?: string;
  url?: string;
  sizeBytes?: number;
}

/**
 * The inbound webhook's body, pre-parsed once by the route based on
 * Content-Type before any adapter sees it — never re-parsed per adapter.
 * Two vendor shapes exist in this codebase and neither can be forced into
 * the other without losing information:
 *
 * - `"text"`: a JSON (or otherwise string) payload — Resend's shape.
 *   `raw` is the exact byte-for-byte body, required for HMAC signature
 *   verification to work at all.
 * - `"form"`: a `multipart/form-data` or `application/x-www-form-urlencoded`
 *   payload — Mailgun's inbound-route shape. `fields` is every non-file
 *   form field (including the vendor's own signature/token/timestamp
 *   fields, which live in the body itself for this shape, not a header).
 *   `files` carries each attachment's actual bytes, read once by the
 *   route via `Request.formData()` — re-deriving them from a stringified
 *   body would corrupt binary content, which is why this case exists
 *   instead of just always using `"text"`.
 */
export type InboundWebhookBody =
  | { kind: "text"; raw: string }
  | { kind: "form"; fields: Record<string, string>; files: { field: string; filename: string; contentType: string; bytes: Uint8Array }[] };

export interface ParsedInboundEmail {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  /** Full References header, oldest-to-newest, for fallback thread matching. */
  references: string[];
  attachments: InboundAttachment[];
}

export interface EmailProviderAdapter {
  key: string;

  /** Send one email. Must never throw — return { ok: false, error } instead,
   * so a delivery failure never crashes the caller (an agent reply, an
   * auto-acknowledgement). */
  sendEmail(msg: OutboundEmail): Promise<{ ok: boolean; providerMessageId?: string; error?: string }>;

  /** MUST verify the vendor's own signing/authenticity scheme before
   * anything in the payload is trusted — same non-negotiable rule as
   * PaymentProviderAdapter.verifyWebhookSignature. Return false on any
   * doubt. */
  verifyInboundWebhook(body: InboundWebhookBody, headers: Headers): boolean;

  /** Only called after verifyInboundWebhook returns true. Return null for
   * an event type this adapter doesn't need to act on (e.g. a delivery
   * receipt rather than a received message). Attachments delivered inline
   * in the body itself (Mailgun's "form" shape) are already fully
   * populated here with real bytes — fetchInboundBody below is only for a
   * vendor whose webhook is metadata-only. */
  parseInboundEvent(body: InboundWebhookBody): ParsedInboundEmail | null;

  /** Some vendors (Resend included) deliver only metadata in the webhook
   * itself and require a follow-up API call for the body/attachments —
   * parseInboundEvent returns what it can, and the webhook route calls
   * this (keyed off whatever id parseInboundEvent embedded, vendor's
   * choice how) to fill in the rest. Optional: a vendor that puts
   * everything in the webhook payload itself doesn't need to implement
   * it, and parseInboundEvent's own return value is then already complete. */
  fetchInboundBody?(eventId: string): Promise<{
    text: string;
    html: string | null;
    messageId: string | null;
    inReplyTo: string | null;
    references: string[];
    attachments: InboundAttachment[];
  } | null>;
}
