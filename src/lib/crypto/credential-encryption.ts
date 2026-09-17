import "server-only";
import crypto from "crypto";

/**
 * AES-256-GCM at rest for admin-configured integration credentials
 * (src/app/admin/integrations). The master key lives ONLY in this
 * deployment's environment (INTEGRATION_CREDENTIALS_ENCRYPTION_KEY,
 * Vercel "sensitive" env var, never re-readable via API once set) — it is
 * never stored in the database, never derived from anything the database
 * holds, and this file never logs it or any plaintext it decrypts.
 *
 * `import "server-only"` makes an accidental client-side import a build
 * error, same load-bearing pattern as src/lib/supabase/admin.ts.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM-recommended size

function loadMasterKey(): Buffer {
  const raw = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is not set. Admin-configured integration " +
        "credentials cannot be encrypted or decrypted without it."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return key;
}

/**
 * Encrypts a JSON-serializable credential payload (e.g.
 * `{ INTASEND_SECRET_KEY: "...", INTASEND_ENV: "sandbox" }`) into a single
 * opaque string safe to store in `integration_credentials.ciphertext`:
 * `<iv>:<authTag>:<ciphertext>`, each base64.
 */
export function encryptCredentialPayload(payload: Record<string, string>): string {
  const key = loadMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypts a string produced by encryptCredentialPayload. Throws (never
 * returns a partial/guessed result) on a tampered or corrupt ciphertext —
 * GCM's auth tag makes this an integrity check, not just confidentiality.
 */
export function decryptCredentialPayload(stored: string): Record<string, string> {
  const key = loadMasterKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted credential payload.");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

/**
 * A display-safe stand-in for a secret value — never the value itself.
 * `••••••••6789` for anything with 4+ characters, otherwise fully masked.
 * Used to build `integration_credentials.metadata` at save time so the
 * admin UI never needs to decrypt anything just to render a status card.
 */
export function maskSecretValue(value: string): string {
  if (value.length <= 4) return "••••••••";
  return `••••••••${value.slice(-4)}`;
}
