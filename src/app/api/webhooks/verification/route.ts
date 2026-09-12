import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificationAdapters } from "@/lib/verification/registry";

/**
 * Generic inbound webhook for whichever identity/KYC vendor is currently
 * active in `verification_providers` — same shape as
 * src/app/api/webhooks/payments/route.ts. See src/lib/verification/adapters/kora.ts:
 * not every vendor necessarily pushes a webhook (Kora's own docs describe
 * a query-by-reference model); this route exists for vendors that do, or
 * for Kora if their identity product turns out to support one. A vendor
 * without webhook push instead needs a direct server-side call from the
 * verification-submission action, calling rpc_record_identity_check
 * straight from there instead of through this route.
 *
 * Same non-negotiable rule as the payments route: this never changes
 * providers.verification_status. It only ever calls
 * rpc_record_identity_check, which stores the vendor's result for a human
 * admin to see in the existing /admin/verifications queue — the actual
 * "verified" claim is still made only by rpc_set_verification_status.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const supabase = createAdminClient();

  const { data: active } = await supabase
    .from("verification_providers")
    .select("key")
    .eq("is_active", true)
    .neq("key", "manual")
    .maybeSingle();

  if (!active) {
    return NextResponse.json({ error: "No active automated verification provider configured." }, { status: 503 });
  }

  const adapter = verificationAdapters[active.key];
  if (!adapter) {
    return NextResponse.json(
      { error: `Provider '${active.key}' is active but has no adapter registered in src/lib/verification/registry.ts.` },
      { status: 500 }
    );
  }

  const signatureVerified = adapter.verifyWebhookSignature(rawBody, req.headers);
  if (!signatureVerified) {
    // Unlike a payment event, there's no reconciliation value in keeping
    // an unverified identity-check payload — refuse it outright rather
    // than store an attacker-supplied "passed" result anywhere at all.
    return NextResponse.json({ error: "Webhook signature did not verify." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = adapter.parseWebhookEvent(rawBody);
  } catch {
    return NextResponse.json({ error: "Could not parse webhook payload." }, { status: 400 });
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(parsed.providerId)) {
    return NextResponse.json({ error: "Payload did not carry a recognisable provider id." }, { status: 400 });
  }

  const { error } = await supabase.rpc("rpc_record_identity_check", {
    p_provider_key: active.key,
    p_provider_id: parsed.providerId,
    p_check_type: parsed.checkType,
    p_external_reference: parsed.externalReference,
    p_status: parsed.status,
    p_raw_result: JSON.parse(rawBody || "{}"),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
