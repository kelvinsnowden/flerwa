"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(transactionId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > 2000) return { error: "Message is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS ("messages participant send") is what actually enforces that the
  // sender is a real participant on this transaction — this insert is
  // rejected by the database, not just skipped by the UI, otherwise.
  const { error } = await supabase.from("messages").insert({
    transaction_id: transactionId,
    sender_id: user.id,
    body: trimmed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/messages/${transactionId}`);
  revalidatePath("/messages");
  return { success: true as const };
}

export async function markThreadRead(transactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS ("messages mark read") only allows marking messages read that
  // were NOT sent by the current user — the .neq below is defence in
  // depth, the database is what actually enforces it.
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("transaction_id", transactionId)
    .neq("sender_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return { success: true as const };
}
