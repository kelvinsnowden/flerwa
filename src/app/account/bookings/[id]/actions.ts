"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createIntasendCollection } from "@/lib/payments/adapters/intasend";

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

export async function cancelBooking(transactionId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_cancel_booking", {
    p_transaction_id: transactionId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/account/bookings/${transactionId}`);
  revalidatePath("/account/bookings");
  return { success: true };
}

// Initiates an M-Pesa STK push via whichever aggregator is active — the
// outbound half of the integration described in
// docs/16-payment-verification-integrations.md. Only ever called for a
// transaction the caller owns, and only reads the amount/currency the
// server already computed (rpc_book_service), never a client-supplied
// figure. Funding itself still only happens through
// rpc_ingest_payment_event when the resulting webhook arrives — this
// action only asks the aggregator to prompt the customer's phone.
export async function initiatePayment(transactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: txn, error: txnError } = await supabase
    .from("service_transactions")
    .select("total_amount_minor, currency, contact_phone, customer_id, state")
    .eq("id", transactionId)
    .single();
  if (txnError || !txn) return { error: "Booking not found." };
  if (txn.customer_id !== user.id) return { error: "Not your booking." };
  if (!["requested", "quote_accepted"].includes(txn.state)) return { error: "This booking cannot be paid right now." };
  if (!txn.contact_phone) return { error: "No phone number on file for this booking." };

  const admin = createAdminClient();
  const { data: activeProvider } = await admin
    .from("payment_providers")
    .select("key")
    .eq("is_active", true)
    .eq("kind", "aggregator")
    .maybeSingle();
  if (!activeProvider) return { error: "No automated payment method is available — pay via the M-Pesa details we send you." };
  if (activeProvider.key !== "intasend") {
    return { error: `Provider '${activeProvider.key}' is active but has no outbound integration wired up yet.` };
  }

  const result = await createIntasendCollection(transactionId, txn.total_amount_minor, txn.currency, txn.contact_phone);
  if (!result.ok) {
    // The adapter's error is a precise internal reason (missing env var,
    // vendor HTTP error) — useful in logs, not something to show a
    // customer mid-checkout.
    console.error("initiatePayment: createIntasendCollection failed", result.error);
    return { error: "We couldn't start the payment prompt. Please try again shortly, or wait for our team to reach out." };
  }

  return { success: true as const };
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
