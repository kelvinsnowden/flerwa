"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendSupportAgentReplyEmail } from "@/lib/notifications/send-support-email";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function replyToConversation(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Reply can't be empty." };

  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not signed in." };

  // RLS/the RPC's own is_admin() check is what actually enforces this is
  // an admin action — this call is rejected by the database otherwise.
  const { data: messageId, error } = await supabase.rpc("rpc_agent_reply_support_conversation", {
    p_conversation_id: conversationId,
    p_body: trimmed,
  });
  if (error) return { error: error.message };

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("reference_number, subject, customer_email")
    .eq("id", conversationId)
    .maybeSingle();

  // The last customer-authored message anchors the reply's threading
  // headers — best-effort, a missing anchor just means the reply sends
  // without In-Reply-To rather than failing outright.
  const { data: lastCustomerMessage } = await supabase
    .from("support_messages")
    .select("email_message_id")
    .eq("conversation_id", conversationId)
    .eq("sender_type", "customer")
    .not("email_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversation && messageId) {
    const sendResult = await sendSupportAgentReplyEmail(supabase, {
      messageId: messageId as string,
      conversationId,
      referenceNumber: conversation.reference_number,
      subject: conversation.subject,
      customerEmail: conversation.customer_email,
      body: trimmed,
      inReplyToEmailMessageId: lastCustomerMessage?.email_message_id ?? null,
    });
    revalidatePath(`/admin/support/${conversationId}`);
    revalidatePath("/admin/support");
    if (!sendResult.sent) {
      return { success: true as const, emailWarning: sendResult.reason ?? "Email was not sent." };
    }
  }

  revalidatePath(`/admin/support/${conversationId}`);
  revalidatePath("/admin/support");
  return { success: true as const };
}

export async function addInternalNote(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Note can't be empty." };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_add_support_internal_note", {
    p_conversation_id: conversationId,
    p_body: trimmed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${conversationId}`);
  return { success: true as const };
}

export async function assignConversation(conversationId: string, assignee: string | null) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_assign_support_conversation", {
    p_conversation_id: conversationId,
    p_assignee: assignee,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${conversationId}`);
  revalidatePath("/admin/support");
  return { success: true as const };
}

export async function setConversationStatus(conversationId: string, status: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_set_support_conversation_status", {
    p_conversation_id: conversationId,
    p_status: status,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${conversationId}`);
  revalidatePath("/admin/support");
  return { success: true as const };
}

export async function setConversationPriority(conversationId: string, priority: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_set_support_conversation_priority", {
    p_conversation_id: conversationId,
    p_priority: priority,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${conversationId}`);
  revalidatePath("/admin/support");
  return { success: true as const };
}

export async function setConversationCategory(conversationId: string, categoryId: string | null) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_set_support_conversation_category", {
    p_conversation_id: conversationId,
    p_category_id: categoryId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${conversationId}`);
  return { success: true as const };
}

export async function setConversationTags(conversationId: string, tagIds: string[]) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_set_support_conversation_tags", {
    p_conversation_id: conversationId,
    p_tag_ids: tagIds,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/support/${conversationId}`);
  return { success: true as const };
}

export async function createTag(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Tag name required." };

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("rpc_upsert_support_tag", { p_name: trimmed });
  if (error) return { error: error.message };

  return { success: true as const, tagId: data as string };
}

export async function upsertCannedReply(params: { id?: string; title: string; body: string; categoryId?: string | null }) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_upsert_support_canned_reply", {
    p_title: params.title,
    p_body: params.body,
    p_id: params.id ?? null,
    p_category_id: params.categoryId ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/support");
  return { success: true as const };
}

export async function deleteCannedReply(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("rpc_delete_support_canned_reply", { p_id: id });
  if (error) return { error: error.message };

  revalidatePath("/admin/support");
  return { success: true as const };
}
