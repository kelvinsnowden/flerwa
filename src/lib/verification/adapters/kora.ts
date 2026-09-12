import crypto from "crypto";
import type { VerificationProviderAdapter, ParsedIdentityCheckResult } from "../provider";

/**
 * Kora Identity adapter — webhook verification (for whichever of Kora's
 * products push one) plus the synchronous Kenya National ID check, which
 * per Kora's own docs is the realistic integration point (see below).
 *
 * Grounded in Kora's published docs as of this writing:
 * - Webhooks: https://developers.korapay.com/docs/webhooks — valid
 *   requests carry an `x-korapay-signature` header, an HMAC-SHA256 of the
 *   JSON-stringified `data` object in the payload, signed with your
 *   secret key, hex-encoded.
 * - Kenya National ID: https://developers.korapay.com/docs/kenya-national-id-number
 *   — `POST https://api.korapay.com/merchant/api/v1/identities/ke/national-id`,
 *   body `{ id, verification_consent: true }`, response includes `status`,
 *   `reference`, `id_type`, `first_name`, `last_name`, `full_name`, etc.
 *
 * NOT confirmed against a live account: the exact Authorization header
 * scheme for the identity endpoints specifically (implemented below as
 * `Bearer <secret key>`, the pattern Kora's peers — and Kora's own
 * payments API — use, but not verified against the identity product's
 * own docs). Confirm before activating.
 */

export const koraAdapter: VerificationProviderAdapter = {
  key: "kora",

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const secretKey = process.env.KORA_SECRET_KEY;
    if (!secretKey) return false; // not configured yet — fail closed, don't guess

    const signature = headers.get("x-korapay-signature");
    if (!signature) return false;

    let body: { data?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return false;
    }
    if (body.data === undefined) return false;

    const expected = crypto.createHmac("sha256", secretKey).update(JSON.stringify(body.data)).digest("hex");

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  },

  parseWebhookEvent(rawBody: string): ParsedIdentityCheckResult & { providerId: string } {
    const body = JSON.parse(rawBody) as {
      reference?: string;
      status?: string;
      verification_type?: string;
      metadata?: { provider_id?: string };
    };

    const status: ParsedIdentityCheckResult["status"] =
      body.status === "verified" || body.status === "success"
        ? "passed"
        : body.status === "failed" || body.status === "declined"
          ? "failed"
          : body.status === "pending"
            ? "pending"
            : "manual_review";

    return {
      checkType: body.verification_type ?? "id_document",
      externalReference: body.reference ?? "",
      status,
      raw: body,
      providerId: body.metadata?.provider_id ?? "",
    };
  },
};

export interface KenyaNationalIdResult {
  ok: boolean;
  status?: "passed" | "failed" | "manual_review";
  reference?: string;
  raw?: unknown;
  error?: string;
}

/**
 * Synchronous Kenya National ID check — the realistic integration point
 * per Kora's request/query-style docs (see file header), called directly
 * from the verification-submission server action rather than through a
 * webhook. Requires `KORA_SECRET_KEY`; without a real Kora account this
 * is unset, so it returns `{ ok: false, error: "..." }` rather than
 * fabricate a result.
 */
export async function verifyKenyaNationalId(idNumber: string): Promise<KenyaNationalIdResult> {
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "KORA_SECRET_KEY is not configured — no real Kora account is connected yet." };
  }

  try {
    const res = await fetch("https://api.korapay.com/merchant/api/v1/identities/ke/national-id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ id: idNumber, verification_consent: true }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: typeof data?.message === "string" ? data.message : `Kora returned HTTP ${res.status}.` };
    }

    const status: KenyaNationalIdResult["status"] = data?.status === true ? "passed" : "manual_review";
    return { ok: true, status, reference: data?.reference, raw: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach Kora." };
  }
}
