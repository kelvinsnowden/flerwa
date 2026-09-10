"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveBooking(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_approve_and_release", {
    p_transaction_id: transactionId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/account/bookings/${transactionId}`);
  return { success: true };
}

export async function openDispute(transactionId: string, reason: string, description: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_open_dispute", {
    p_transaction_id: transactionId,
    p_reason: reason,
    p_description: description || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/account/bookings/${transactionId}`);
  return { success: true };
}

export async function requestRevision(transactionId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_request_revision", {
    p_transaction_id: transactionId,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/account/bookings/${transactionId}`);
  return { success: true };
}

export async function submitReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const transactionId = String(formData.get("transaction_id"));
  const revieweeId = String(formData.get("reviewee_id"));
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "");
  const tags = formData.getAll("tags").map(String);
  const wouldBookAgainRaw = formData.get("would_book_again");
  const wouldBookAgain = wouldBookAgainRaw === "true" ? true : wouldBookAgainRaw === "false" ? false : null;

  // RLS itself enforces "only from settled/reviewed/closed transactions" —
  // see the "reviews participant insert" policy — this insert will be
  // rejected by the database, not just the UI, if that condition fails.
  const { error } = await supabase.from("reviews").insert({
    transaction_id: transactionId,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating,
    comment,
    tags,
    would_book_again: wouldBookAgain,
    is_customer_review: true,
  });
  if (error) return { error: error.message };
  revalidatePath(`/account/bookings/${transactionId}`);
  return { success: true };
}
