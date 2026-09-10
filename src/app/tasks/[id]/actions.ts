"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptQuote(quoteId: string, requestId: string) {
  const supabase = await createClient();
  const { data: txnId, error } = await supabase.rpc("rpc_accept_quote", { p_quote_id: quoteId });
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${requestId}`);
  redirect(`/account/bookings/${txnId}`);
}

export async function declineQuote(quoteId: string, requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_decline_quote", { p_quote_id: quoteId });
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${requestId}`);
  return { success: true as const };
}
