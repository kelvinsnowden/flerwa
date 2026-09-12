"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setActivePaymentProvider(key: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_active_payment_provider", { p_key: key });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}

export async function setActiveVerificationProvider(key: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_active_verification_provider", { p_key: key });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}
