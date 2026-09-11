"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ThreadRef = { transactionId: string } | { conversationId: string };

function threadColumn(ref: ThreadRef) {
  return "transactionId" in ref
    ? { column: "transaction_id" as const, value: ref.transactionId, path: `/messages/${ref.transactionId}` }
    : { column: "conversation_id" as const, value: ref.conversationId, path: `/messages/c/${ref.conversationId}` };
}

export async function sendMessage(ref: ThreadRef, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > 2000) return { error: "Message is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { column, value, path } = threadColumn(ref);

  // RLS ("messages participant send" / "messages conversation participant
  // send") is what actually enforces that the sender is a real
  // participant on this thread — this insert is rejected by the
  // database, not just skipped by the UI, otherwise.
  const { error } = await supabase.from("messages").insert({
    [column]: value,
    sender_id: user.id,
    body: trimmed,
  });
  if (error) return { error: error.message };

  revalidatePath(path);
  revalidatePath("/messages");
  return { success: true as const };
}

export async function markThreadRead(ref: ThreadRef) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { column, value } = threadColumn(ref);

  // RLS ("messages mark read" / "messages conversation mark read") only
  // allows marking messages read that were NOT sent by the current user
  // — the .neq below is defence in depth, the database is what actually
  // enforces it.
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq(column, value)
    .neq("sender_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return { success: true as const };
}

export async function startConversation(
  providerId: string,
  message: string,
  serviceId?: string,
  requestedDate?: string,
  requestedTime?: string
) {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Message can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to message a professional." };

  const { data, error } = await supabase.rpc("rpc_start_conversation", {
    p_provider_id: providerId,
    p_message: trimmed,
    p_service_id: serviceId ?? null,
    p_requested_date: requestedDate ?? null,
    p_requested_time: requestedTime ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return { success: true as const, conversationId: data as string };
}
