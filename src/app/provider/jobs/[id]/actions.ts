"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function checkIn(transactionId: string, lat: number | null, lng: number | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_provider_check_in", {
    p_transaction_id: transactionId,
    p_geo_lat: lat,
    p_geo_lng: lng,
  });
  if (error) return { error: error.message };
  revalidatePath(`/provider/jobs/${transactionId}`);
  return { success: true };
}

export async function recordEvidence(input: {
  transactionId: string;
  checklistItemId: string | null;
  type: string;
  storagePath: string;
  description: string;
  geoLat: number | null;
  geoLng: number | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // RLS ("evidence provider insert") independently re-checks that this user
  // is the assigned provider for this transaction — this insert is not
  // trusted on the strength of the server action alone.
  const { error: evidenceError } = await supabase.from("transaction_evidence").insert({
    transaction_id: input.transactionId,
    checklist_item_id: input.checklistItemId,
    type: input.type,
    storage_path: input.storagePath,
    description: input.description || null,
    captured_in_app: true,
    geo_lat: input.geoLat,
    geo_lng: input.geoLng,
    uploaded_by: user.id,
  });
  if (evidenceError) return { error: evidenceError.message };

  if (input.checklistItemId) {
    const { error: checklistError } = await supabase.from("transaction_checklist_results").upsert(
      {
        transaction_id: input.transactionId,
        checklist_item_id: input.checklistItemId,
        is_complete: true,
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "transaction_id,checklist_item_id" }
    );
    if (checklistError) return { error: checklistError.message };
  }

  revalidatePath(`/provider/jobs/${input.transactionId}`);
  return { success: true };
}

export async function submitCompletion(transactionId: string, summary: string | null) {
  const supabase = await createClient();
  // rpc_submit_completion itself re-checks every REQUIRED checklist item has
  // is_complete=true and raises if any are missing — this is not a client-side
  // gate, it is enforced in the database. See BUILD_PLAN.md Phase 8.
  const { error } = await supabase.rpc("rpc_submit_completion", {
    p_transaction_id: transactionId,
    p_summary: summary,
  });
  if (error) return { error: error.message };
  revalidatePath(`/provider/jobs/${transactionId}`);
  return { success: true };
}
