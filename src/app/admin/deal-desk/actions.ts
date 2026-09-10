"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeKenyanPhone } from "@/lib/phone";

export async function lookupCustomer(contact: string) {
  const supabase = await createClient();
  const trimmed = contact.trim();
  if (!trimmed) return { error: "Enter a phone number or email." };

  const phone = normalizeKenyanPhone(trimmed);
  const query = supabase.from("profiles").select("id, full_name, email, phone").limit(1);
  const { data, error } = phone
    ? await query.eq("phone", phone).maybeSingle()
    : await query.eq("email", trimmed.toLowerCase()).maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "No account found with that phone or email. They need to sign up first." };
  return { customer: data };
}

export async function convertRequest(
  requestId: string,
  customerId: string,
  categoryId: string,
  fulfilmentMode: string,
  amountKes: number,
  platformFeeKes: number
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_convert_deal_desk_request", {
    p_request_id: requestId,
    p_customer_id: customerId,
    p_category_id: categoryId,
    p_fulfilment_mode: fulfilmentMode,
    p_amount_minor: Math.round(amountKes * 100),
    p_platform_fee_minor: Math.round(platformFeeKes * 100),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/deal-desk");
  revalidatePath("/admin");
  return { transactionId: data as string };
}

export async function declineRequest(requestId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_decline_deal_desk_request", {
    p_request_id: requestId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/deal-desk");
  return { success: true };
}
