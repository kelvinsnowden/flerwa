import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredentialPayload } from "@/lib/crypto/credential-encryption";
import { getProviderDefinition, type IntegrationCapability } from "./provider-schemas";

export type CredentialMap = Record<string, string | undefined>;

/**
 * `integration_credentials.environment` exists for future-proofing (the
 * illustrative schema an admin-configuration spec sketched includes it)
 * but this deployment only ever stores one live credential set per
 * provider — sandbox vs. production is decided by that provider's own
 * `*_ENV` field inside the encrypted payload (see e.g. INTASEND_ENV in
 * provider-schemas.ts), not by a second database row. Keeping the lookup
 * key fixed avoids a chicken-and-egg read (you'd need to already know the
 * environment to know which row to read to find out the environment).
 */
const CREDENTIAL_ROW_ENVIRONMENT = "production" as const;

// cache() memoizes per-request (per Server Component render / server
// action invocation) — the same provider is often resolved more than
// once (e.g. testConnection right after a save), and this avoids a
// redundant DB round-trip + decrypt within that single request without
// risking a stale read across requests (a Node module-level cache would).
const fetchStoredCredential = cache(
  async (capability: IntegrationCapability, providerKey: string): Promise<Record<string, string> | null> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("integration_credentials")
      .select("ciphertext")
      .eq("capability", capability)
      .eq("provider_key", providerKey)
      .eq("environment", CREDENTIAL_ROW_ENVIRONMENT)
      .eq("enabled", true)
      .maybeSingle();
    if (error || !data) return null;
    try {
      return decryptCredentialPayload(data.ciphertext);
    } catch {
      // Corrupt/tampered ciphertext or a rotated master key — fail closed
      // to the env-var fallback below rather than throwing into whatever
      // caller triggered this (a webhook route, a checkout action, an
      // outbound send), which would turn a config problem into an outage.
      return null;
    }
  }
);

/**
 * Resolves every field a provider's configurationSchema declares:
 * the admin-saved, encrypted, enabled value if one exists in the
 * database, otherwise `process.env[fieldKey]` — field by field, not
 * all-or-nothing, so a deployment can have some fields admin-managed and
 * others still coming from Vercel env vars mid-migration. Every adapter
 * that used to read `process.env.X` directly now calls this instead and
 * destructures the same key names, so nothing about the "not configured"
 * contract downstream changes.
 */
export async function resolveCredentials(capability: IntegrationCapability, providerKey: string): Promise<CredentialMap> {
  const definition = getProviderDefinition(capability, providerKey);
  const fieldKeys = definition?.configurationSchema.map((f) => f.key) ?? [];

  const stored = await fetchStoredCredential(capability, providerKey);

  const result: CredentialMap = {};
  for (const key of fieldKeys) {
    result[key] = stored?.[key] ?? process.env[key];
  }
  return result;
}
