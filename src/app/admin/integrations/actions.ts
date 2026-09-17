"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { paymentAdapters } from "@/lib/payments/registry";
import { verificationAdapters } from "@/lib/verification/registry";
import { emailAdapters, smsAdapters } from "@/lib/notifications/registry";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Test-connection actions below call out to a real vendor's API using this
 * server's own configured secret BEFORE the corresponding rpc_record_
 * function ever runs. Unlike the setActive-style actions (which only ever
 * call an RPC that self-checks admin status), that outbound call itself is
 * a side effect — and its error message is echoed back to the caller —
 * that must never happen for a non-admin, so this checks is_admin()
 * directly rather than relying on the RPC's own internal check to reject
 * the write after the fact.
 */
async function assertAdmin(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Only an admin can do this.");
}

export async function setActivePaymentProvider(key: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_active_payment_provider", { p_key: key });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}

export async function setActivePayoutProvider(key: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_active_payout_provider", { p_key: key });
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

export async function setActiveNotificationChannel(key: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_active_notification_channel", { p_key: key });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}

export async function testPaymentProvider(key: string) {
  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorized." };
  }

  const adapter = paymentAdapters[key];
  if (!adapter?.testConnection) {
    return { error: "This provider has no automated connectivity check — verify manually against the vendor's dashboard." };
  }

  const result = await adapter.testConnection();
  const { error } = await supabase.rpc("rpc_record_payment_provider_test", {
    p_key: key,
    p_ok: result.ok,
    p_error: result.error ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return result.ok ? { success: true } : { error: result.error };
}

export async function testVerificationProvider(key: string) {
  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorized." };
  }

  const adapter = verificationAdapters[key];
  if (!adapter?.testConnection) {
    return { error: "This provider has no automated connectivity check — verify manually against the vendor's dashboard." };
  }

  const result = await adapter.testConnection();
  const { error } = await supabase.rpc("rpc_record_verification_provider_test", {
    p_key: key,
    p_ok: result.ok,
    p_error: result.error ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return result.ok ? { success: true } : { error: result.error };
}

export async function testNotificationChannel(key: string, kind: "email" | "sms") {
  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorized." };
  }

  const adapter = kind === "email" ? emailAdapters[key] : smsAdapters[key];
  if (!adapter?.testConnection) {
    return { error: "This provider has no automated connectivity check — verify manually against the vendor's dashboard." };
  }

  const result = await adapter.testConnection();
  const { error } = await supabase.rpc("rpc_record_notification_channel_test", {
    p_key: key,
    p_ok: result.ok,
    p_error: result.error ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return result.ok ? { success: true } : { error: result.error };
}
