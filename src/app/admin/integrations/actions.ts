"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { paymentAdapters } from "@/lib/payments/registry";
import { verificationAdapters } from "@/lib/verification/registry";
import { emailAdapters, smsAdapters } from "@/lib/notifications/registry";
import { encryptCredentialPayload, decryptCredentialPayload, maskSecretValue } from "@/lib/crypto/credential-encryption";
import { getProviderDefinition, type IntegrationCapability } from "@/lib/integrations/provider-schemas";
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

/**
 * Saves (or rotates) a provider's credentials: validates against that
 * provider's configurationSchema, encrypts every field into one opaque
 * blob (src/lib/crypto/credential-encryption.ts — the plaintext values
 * never leave this server action), and stores only the ciphertext plus a
 * display-safe metadata object (masked previews for secret fields, plain
 * values for non-secret ones) via the admin-gated RPC. The RPC itself
 * re-checks is_admin() and resets any prior test result on the row this
 * writes to — a rotated secret hasn't been proven to work yet. Test
 * Connection continues to run through testPaymentProvider/
 * testVerificationProvider/testNotificationChannel above, which already
 * transparently test whatever resolveCredentials() resolves (this saved
 * value first, this deployment's env var otherwise).
 *
 * A field left blank means "unchanged", not "clear" — the form never
 * pre-fills a secret's real value (only a masked preview), so this merges
 * blank fields with whatever was already saved (decrypted here, server-
 * side only, and never returned to the caller) rather than requiring
 * every field to be re-entered on every edit. That's what lets Replace/
 * Rotate touch a single field without wiping the rest.
 */
export async function saveIntegrationCredential(
  capability: IntegrationCapability,
  providerKey: string,
  values: Record<string, string>
) {
  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorized." };
  }

  const definition = getProviderDefinition(capability, providerKey);
  if (!definition || definition.isManual || definition.configurationSchema.length === 0) {
    return { error: "This provider has no credentials to configure." };
  }

  let existing: Record<string, string> = {};
  const { data: existingRow } = await supabase
    .from("integration_credentials")
    .select("ciphertext")
    .eq("capability", capability)
    .eq("provider_key", providerKey)
    .eq("environment", "production")
    .maybeSingle();
  if (existingRow?.ciphertext) {
    try {
      existing = decryptCredentialPayload(existingRow.ciphertext);
    } catch {
      existing = {}; // corrupt/unreadable — treat as no prior value rather than fail the whole save
    }
  }
  // Second fallback: this deployment's own env vars, for any field not
  // already in the database. Without this, opening Configure on a
  // provider that's only ever worked via env vars and touching a single
  // field (e.g. flipping *_ENV to production) would wrongly demand every
  // secret be re-typed — leaving a field blank should promote today's
  // already-effective value into the encrypted store, matching what
  // resolveCredentials() already resolves at read time.
  for (const field of definition.configurationSchema) {
    if (!(field.key in existing) && process.env[field.key]) existing[field.key] = process.env[field.key]!;
  }

  const payload: Record<string, string> = {};
  const fieldsMeta: Record<string, { label: string; secret: boolean; masked?: string; value?: string }> = {};

  for (const field of definition.configurationSchema) {
    const raw = (values[field.key] ?? "").trim();
    const effective = raw || existing[field.key] || "";
    if (!effective) {
      if (field.required) return { error: `${field.label} is required.` };
      continue;
    }
    if (field.type === "select" && field.options && !field.options.some((o) => o.value === effective)) {
      return { error: `${field.label} has an invalid value.` };
    }
    payload[field.key] = effective;
    fieldsMeta[field.key] = field.secret
      ? { label: field.label, secret: true, masked: maskSecretValue(effective) }
      : { label: field.label, secret: false, value: effective };
  }

  const missingRequired = definition.configurationSchema.find((f) => f.required && !(f.key in payload));
  if (missingRequired) return { error: `${missingRequired.label} is required.` };
  if (Object.keys(payload).length === 0) return { error: "Enter at least one credential value." };

  let ciphertext: string;
  try {
    ciphertext = encryptCredentialPayload(payload);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not encrypt these credentials." };
  }

  const { error } = await supabase.rpc("rpc_save_integration_credential", {
    p_capability: capability,
    p_provider_key: providerKey,
    p_environment: "production",
    p_ciphertext: ciphertext,
    p_metadata: { fields: fieldsMeta },
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}

/**
 * Disables (or re-enables) a saved credential without deleting it —
 * resolveCredentials() only ever reads a row where enabled = true, so
 * disabling one immediately falls back to this deployment's env var (if
 * any) for every adapter call, with no redeploy required.
 */
export async function setIntegrationCredentialEnabled(id: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_integration_credential_enabled", { p_id: id, p_enabled: enabled });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}

/** Permanently removes a saved credential (distinct from disabling it). */
export async function deleteIntegrationCredential(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_delete_integration_credential", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/admin/integrations");
  return { success: true };
}
