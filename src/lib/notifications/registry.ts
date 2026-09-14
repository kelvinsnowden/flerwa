import "server-only";
import type { EmailProviderAdapter } from "./email-provider";
import type { SmsProviderAdapter } from "./sms-provider";
import { resendEmailAdapter } from "./adapters/resend-email";
import { mailgunAdapter } from "./adapters/mailgun";

/**
 * Every email/SMS vendor this codebase knows how to speak to, keyed
 * exactly like `notification_channels.key` in the database — same shape
 * as src/lib/payments/registry.ts. The active-channel lookup (DB row
 * where kind='email'/'sms' and is_active=true) resolves a key here; add
 * a new vendor by writing one adapter file and adding one line below,
 * never by touching a route, RPC, or UI that uses this.
 *
 * smsAdapters is empty by design: no SMS/WhatsApp vendor is connected in
 * this environment (see sms-provider.ts's header comment). Any code path
 * that would send an SMS must handle `smsAdapters[key]` being undefined
 * exactly like the email/payment paths handle an unconfigured adapter —
 * return { ok: false, error: "..." }, never pretend to have sent one.
 */
export const emailAdapters: Record<string, EmailProviderAdapter> = {
  resend: resendEmailAdapter,
  mailgun: mailgunAdapter,
};

export const smsAdapters: Record<string, SmsProviderAdapter> = {};
