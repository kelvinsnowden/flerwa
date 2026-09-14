"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addBookingNote(transactionId: string, note: string) {
  if (!note.trim()) return { error: "Note cannot be empty." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("booking_notes").insert({
    transaction_id: transactionId,
    admin_id: user.id,
    note: note.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${transactionId}`);
  return { success: true };
}
