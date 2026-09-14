import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailAdapters } from "@/lib/notifications/registry";

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
  const rawBody = await req.text();
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

  if (!adapter.verifyInboundWebhook(rawBody, req.headers)) {
    // Unverified inbound "mail" is worthless and potentially forged —
    // refuse outright rather than create a ticket from it.
    return NextResponse.json({ error: "Webhook signature did not verify." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = adapter.parseInboundEvent(rawBody);
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

  const referenceMatch = parsed.subject.match(/\[(SUP-[A-Z0-9]{6})\]/);
  let conversationId: string | null = null;

  if (referenceMatch) {
    const { data: conv } = await supabase
      .from("support_conversations")
      .select("id")
      .eq("reference_number", referenceMatch[1])
      .maybeSingle();
    conversationId = conv?.id ?? null;
  }

  if (!conversationId && (parsed.inReplyTo || parsed.references.length)) {
    const candidates = [parsed.inReplyTo, ...parsed.references].filter((v): v is string => !!v);
    for (const candidate of candidates) {
      const { data: msg } = await supabase
        .from("support_messages")
        .select("conversation_id")
        .eq("email_message_id", candidate)
        .maybeSingle();
      if (msg) {
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
