import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailAdapters } from "@/lib/notifications/registry";
import type { InboundWebhookBody } from "@/lib/notifications/email-provider";

/**
 * Reads the request body once, shaped for whichever vendor is actually
 * sending it: form-encoded vendors (Mailgun's inbound routes) get their
 * fields AND real attachment bytes via Request.formData() — parsing that
 * as text would corrupt binary attachment content — while everyone else
 * (Resend's JSON webhook) gets the exact raw text, required for HMAC
 * signature verification to match byte-for-byte.
 */
async function readInboundBody(req: NextRequest): Promise<InboundWebhookBody> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
    return { kind: "text", raw: await req.text() };
  }

  const form = await req.formData();
  const fields: Record<string, string> = {};
  const files: { field: string; filename: string; contentType: string; bytes: Uint8Array }[] = [];

  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      files.push({ field: key, filename: value.name, contentType: value.type || "application/octet-stream", bytes: new Uint8Array(await value.arrayBuffer()) });
    } else {
      fields[key] = value;
    }
  }

  return { kind: "form", fields, files };
}

/**
 * Generic inbound webhook for whichever email vendor is currently active
 * in `notification_channels` (kind='email') — same shape as
 * src/app/api/webhooks/payments/route.ts. Point the vendor's inbound
 * webhook at this one URL regardless of which vendor it is.
 *
 * Matching order (MARKETPLACE_SUPPORT_SYSTEM_PLAN.md §"email threading"):
 *   1. A `[REF]` tag in the subject — the primary signal. It doesn't
 *      depend on any vendor's exact Message-ID header format (which this
 *      session could not independently verify for Resend — see
 *      adapters/resend-email.ts), so it's the one match this route can
 *      fully trust today.
 *   2. In-Reply-To/References against a stored support_messages.email_message_id
 *      — layered on top as a secondary signal, since it typically also
 *      works but its exact format wasn't independently confirmed.
 * An inbound email matching neither becomes a brand-new conversation
 * (better to create an extra ticket than to silently drop a real message).
 */
export async function POST(req: NextRequest) {
  const body = await readInboundBody(req);
  const supabase = createAdminClient();

  const { data: active } = await supabase
    .from("notification_channels")
    .select("key")
    .eq("kind", "email")
    .eq("is_active", true)
    .maybeSingle();

  if (!active) {
    return NextResponse.json({ error: "No active email channel configured." }, { status: 503 });
  }

  const adapter = emailAdapters[active.key];
  if (!adapter) {
    return NextResponse.json(
      { error: `Channel '${active.key}' is active but has no adapter registered in src/lib/notifications/registry.ts.` },
      { status: 500 }
    );
  }

  if (!adapter.verifyInboundWebhook(body, req.headers)) {
    // Unverified inbound "mail" is worthless and potentially forged —
    // refuse outright rather than create a ticket from it.
    return NextResponse.json({ error: "Webhook signature did not verify." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = adapter.parseInboundEvent(body);
  } catch {
    return NextResponse.json({ error: "Could not parse webhook payload." }, { status: 400 });
  }
  if (!parsed) {
    // A verified event this adapter doesn't need to act on (e.g. a
    // delivery receipt rather than email.received) — not an error.
    return NextResponse.json({ received: true, ignored: true });
  }

  if (adapter.fetchInboundBody && parsed.messageId) {
    const enriched = await adapter.fetchInboundBody(parsed.messageId);
    if (enriched) {
      parsed = {
        ...parsed,
        text: enriched.text,
        html: enriched.html,
        messageId: enriched.messageId,
        inReplyTo: enriched.inReplyTo,
        references: enriched.references,
        attachments: enriched.attachments,
      };
    }
  }

  // Idempotency: webhook vendors document at-least-once delivery (retries
  // on timeout/5xx are expected, not exceptional), and a validly-signed
  // payload can also be legitimately redelivered within the signature's
  // freshness window. Neither case should create a duplicate message or
  // a duplicate conversation (confirmed missing entirely during the Phase
  // 2 production-readiness audit — this route had zero idempotency
  // handling until this fix). The vendor's own message id is the
  // idempotency key: if a message with this exact email_message_id was
  // already recorded, this exact inbound email was already processed.
  if (parsed.messageId) {
    const { data: existing } = await supabase
      .from("support_messages")
      .select("conversation_id")
      .eq("email_message_id", parsed.messageId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true, conversation_id: existing.conversation_id });
    }
  }

  const referenceMatch = parsed.subject.match(/\[(SUP-[A-Z0-9]{6})\]/);
  let conversationId: string | null = null;

  // Whoever holds a valid webhook secret can forge an inbound event with
  // any subject/headers they like — matching on the reference tag or
  // Message-ID alone would let them inject a message into a DIFFERENT
  // customer's conversation just by guessing or observing a live
  // reference number. Requiring the inbound sender's address to match
  // the conversation's own stored customer_email closes that (found
  // during the Phase 2 production-readiness audit; low severity on its
  // own since it needs the webhook secret, but cheap to close).
  const emailMatches = (conversationCustomerEmail: string) =>
    conversationCustomerEmail.toLowerCase() === parsed.fromEmail.toLowerCase();

  if (referenceMatch) {
    const { data: conv } = await supabase
      .from("support_conversations")
      .select("id, customer_email")
      .eq("reference_number", referenceMatch[1])
      .maybeSingle();
    if (conv && emailMatches(conv.customer_email)) conversationId = conv.id;
  }

  if (!conversationId && (parsed.inReplyTo || parsed.references.length)) {
    const candidates = [parsed.inReplyTo, ...parsed.references].filter((v): v is string => !!v);
    for (const candidate of candidates) {
      const { data: msg } = await supabase
        .from("support_messages")
        .select("conversation_id, support_conversations(customer_email)")
        .eq("email_message_id", candidate)
        .maybeSingle<{ conversation_id: string; support_conversations: { customer_email: string } | null }>();
      if (msg && msg.support_conversations && emailMatches(msg.support_conversations.customer_email)) {
        conversationId = msg.conversation_id;
        break;
      }
    }
  }

  let messageId: string | null = null;

  if (conversationId) {
    const { data: inserted, error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "customer",
        author_email: parsed.fromEmail,
        author_name: parsed.fromName,
        body: parsed.text || "(no plain-text body)",
        email_message_id: parsed.messageId,
        email_in_reply_to: parsed.inReplyTo,
      })
      .select("id")
      .single();
    if (error) {
      // 23505 = unique_violation on support_messages_email_message_id_unique
      // -- a concurrent delivery of the same email won the race between
      // this request's own pre-check above and its insert. Not an error:
      // the message is safely recorded by whichever request landed first.
      if (error.code === "23505") return NextResponse.json({ received: true, duplicate: true, conversation_id: conversationId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    messageId = inserted.id;

    await supabase
      .from("support_conversations")
      .update({ status: "open", last_customer_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  } else {
    // No match at all — a genuinely new inbound email. Create a fresh
    // conversation rather than dropping it (see this route's own header
    // comment for why).
    const { data: created, error: rpcError } = await supabase
      .rpc("rpc_submit_support_request", {
        p_email: parsed.fromEmail,
        p_subject: parsed.subject || "(no subject)",
        p_body: parsed.text || "(no plain-text body)",
        p_name: parsed.fromName,
      })
      .single();
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });
    conversationId = (created as { conversation_id: string } | null)?.conversation_id ?? null;

    if (conversationId) {
      const { data: firstMessage } = await supabase
        .from("support_messages")
        .update({ email_message_id: parsed.messageId, email_in_reply_to: parsed.inReplyTo })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "customer")
        .select("id")
        .single();
      messageId = firstMessage?.id ?? null;
    }
  }

  if (messageId && conversationId && parsed.attachments.length) {
    await storeInboundAttachments(supabase, conversationId, messageId, parsed.attachments);
  }

  return NextResponse.json({ received: true, conversation_id: conversationId });
}

/**
 * Downloads each attachment from the vendor's time-limited URL and
 * re-uploads it into our own support-attachments bucket — never stores
 * the vendor URL itself (it expires; see the bucket's own migration
 * comment). Best-effort: one failed attachment doesn't fail the whole
 * inbound message, since the message body itself is the important part.
 */
async function storeInboundAttachments(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string,
  messageId: string,
  attachments: Array<{ filename: string; contentType: string; url?: string; sizeBytes?: number }>
) {
  for (const attachment of attachments) {
    if (!attachment.url) continue;
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const safeName = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${conversationId}/${messageId}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(path, bytes, { contentType: attachment.contentType, upsert: true });
      if (uploadError) continue;

      await supabase.from("support_attachments").insert({
        message_id: messageId,
        file_path: path,
        file_name: attachment.filename,
        content_type: attachment.contentType,
        size_bytes: attachment.sizeBytes ?? bytes.byteLength,
      });
    } catch {
      // Best-effort — see this function's header comment.
    }
  }
}
