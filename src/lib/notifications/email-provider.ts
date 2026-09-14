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
  verifyInboundWebhook(rawBody: string, headers: Headers): boolean;

  /** Only called after verifyInboundWebhook returns true. Return null for
   * an event type this adapter doesn't need to act on (e.g. a delivery
   * receipt rather than a received message). */
  parseInboundEvent(rawBody: string): ParsedInboundEmail | null;

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
