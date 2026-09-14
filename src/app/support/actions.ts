"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSupportAutoAck } from "@/lib/notifications/send-support-email";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function submitSupportRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Works without login by design (MARKETPLACE_SUPPORT_SYSTEM_PLAN.md §3)
  // — rate-limited by IP for an anonymous caller, by auth.uid() for a
  // signed-in one, same as every other pre-auth-capable action.
  const { allowed } = await checkRateLimit("submit_support_request", { max: 5, windowSeconds: 3600 });
  if (!allowed) return { error: "You've sent several requests recently — please wait a bit before sending another." };

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const relatedTransactionId = String(formData.get("related_transaction_id") ?? "") || null;
  const attachment = formData.get("attachment");

  if (!user && !email) return { error: "An email address is required." };
  if (!subject) return { error: "Tell us what this is about in a few words." };
  if (!body) return { error: "Add a bit more detail so we can help." };

  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) return { error: "Attachment is too large (15MB max)." };
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
      return { error: "Attachment must be a JPEG, PNG, WebP image or a PDF." };
    }
  }

  const { data, error } = await supabase
    .rpc("rpc_submit_support_request", {
      p_email: email || null,
      p_subject: subject,
      p_body: body,
      p_name: name || null,
      p_category_id: categoryId,
      p_related_transaction_id: relatedTransactionId,
    })
    .single();
  if (error) return { error: error.message };

  const result = data as { conversation_id: string; reference_number: string };

  // Attachment upload + auto-ack are best-effort: a failure here must
  // never make the ticket itself appear to have failed — the customer's
  // message is already safely recorded by the RPC above.
  const admin = createAdminClient();

  if (attachment instanceof File && attachment.size > 0) {
    const { data: firstMessage } = await admin
      .from("support_messages")
      .select("id")
      .eq("conversation_id", result.conversation_id)
      .eq("sender_type", "customer")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (firstMessage) {
      const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${result.conversation_id}/${firstMessage.id}/${safeName}`;
      const bytes = new Uint8Array(await attachment.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from("support-attachments")
        .upload(path, bytes, { contentType: attachment.type, upsert: true });
      if (!uploadError) {
        await admin.from("support_attachments").insert({
          message_id: firstMessage.id,
          file_path: path,
          file_name: attachment.name,
          content_type: attachment.type,
          size_bytes: attachment.size,
        });
      }
    }
  }

  const { data: profile } = user
    ? await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle()
    : { data: null };
  const confirmationEmail = profile?.email ?? email;
  if (confirmationEmail) {
    await sendSupportAutoAck(admin, {
      referenceNumber: result.reference_number,
      subject,
      customerEmail: confirmationEmail,
    });
  }

  return { success: true as const, referenceNumber: result.reference_number, conversationId: result.conversation_id };
}
