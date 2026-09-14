import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailAdapters } from "./registry";
import type { EmailProviderAdapter } from "./email-provider";

/**
 * Every outbound support email (auto-acknowledgement + agent replies)
 * goes through here. Never imports a vendor adapter directly — resolves
 * whichever channel is active in `notification_channels` at call time,
 * so switching providers via /admin/integrations takes effect
 * immediately with no code change (see MARKETPLACE_SUPPORT_SYSTEM_PLAN.md §4).
 */
async function getActiveEmailAdapter(
  supabase: SupabaseClient
): Promise<{ adapter: EmailProviderAdapter; fromAddress: string } | null> {
  const { data: channel } = await supabase
    .from("notification_channels")
    .select("key")
    .eq("kind", "email")
    .eq("is_active", true)
    .maybeSingle();

  if (!channel) return null;

  const adapter = emailAdapters[channel.key];
  if (!adapter) return null;

  const fromAddress = process.env.SUPPORT_EMAIL_FROM;
  if (!fromAddress) return null;

  return { adapter, fromAddress };
}

/**
 * Threading key we control ourselves: every outbound support email's
 * subject carries "[REF] " so a customer's reply threads correctly by
 * subject even if a mail client drops In-Reply-To/References (some do).
 * This is the PRIMARY match signal in the inbound webhook route — robust
 * because it doesn't depend on any vendor's exact Message-ID header
 * format, which this session could not independently verify (see
 * resend-email.ts's own header comment). Message-ID/In-Reply-To matching
 * is layered on top as a secondary signal when the provider's returned
 * id does end up embedded in the real header, which is typical for most
 * transactional-email vendors but not guaranteed.
 */
function threadedSubject(referenceNumber: string, subject: string, isReply: boolean): string {
  const tag = `[${referenceNumber}]`;
  const base = subject.includes(tag) ? subject : `${tag} ${subject}`;
  return isReply && !base.toLowerCase().startsWith("re:") ? `Re: ${base}` : base;
}

/**
 * Sends only — deliberately does not create a support_messages row. The
 * customer's own first message is already the thread's anchor; a "we got
 * it" auto-ack is a side-channel confirmation (every researched platform
 * treats it the same way), not part of the visible conversation history.
 * Its threading anchor is the subject tag only (threadedSubject) — no
 * Message-ID to stamp since there's no message row to stamp it on.
 */
export async function sendSupportAutoAck(
  supabase: SupabaseClient,
  conversation: { referenceNumber: string; subject: string; customerEmail: string }
): Promise<{ sent: boolean; reason?: string }> {
  const active = await getActiveEmailAdapter(supabase);
  if (!active) return { sent: false, reason: "No active email channel configured." };

  const result = await active.adapter.sendEmail({
    to: conversation.customerEmail,
    from: active.fromAddress,
    subject: threadedSubject(conversation.referenceNumber, conversation.subject, false),
    text:
      `Thanks for reaching out — we've received your message.\n\n` +
      `Your reference number is ${conversation.referenceNumber}. Keep it handy if you follow up.\n\n` +
      `We'll reply to this email address as soon as an agent responds. ` +
      `You can reply directly to this email to add more detail.\n`,
  });

  return result.ok ? { sent: true } : { sent: false, reason: result.error };
}

/**
 * Sends an agent's reply as a real email and stamps the just-inserted
 * support_messages row with whatever id the provider returned, so a
 * later inbound reply can be matched against it (secondary signal — see
 * threadedSubject's own comment for why subject-tagging is primary).
 */
export async function sendSupportAgentReplyEmail(
  supabase: SupabaseClient,
  params: {
    messageId: string;
    conversationId: string;
    referenceNumber: string;
    subject: string;
    customerEmail: string;
    body: string;
    inReplyToEmailMessageId: string | null;
  }
): Promise<{ sent: boolean; reason?: string }> {
  const active = await getActiveEmailAdapter(supabase);
  if (!active) return { sent: false, reason: "No active email channel configured." };

  const result = await active.adapter.sendEmail({
    to: params.customerEmail,
    from: active.fromAddress,
    subject: threadedSubject(params.referenceNumber, params.subject, true),
    text: params.body,
    inReplyTo: params.inReplyToEmailMessageId ?? undefined,
    references: params.inReplyToEmailMessageId ? [params.inReplyToEmailMessageId] : undefined,
  });

  if (!result.ok) return { sent: false, reason: result.error };

  if (result.providerMessageId) {
    await supabase.from("support_messages").update({ email_message_id: result.providerMessageId }).eq("id", params.messageId);
  }

  return { sent: true };
}
