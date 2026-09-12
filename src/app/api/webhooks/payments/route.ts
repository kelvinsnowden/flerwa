import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentAdapters } from "@/lib/payments/registry";

/**
 * Generic inbound webhook endpoint for whichever payment provider is
 * currently active in `payment_providers`. Point the vendor's dashboard
 * at this one URL regardless of which vendor it is — the active-provider
 * lookup + adapter registry (src/lib/payments/registry.ts) means swapping
 * vendors is a DB flip (/admin/integrations) plus an env var, not a new
 * route.
 *
 * This route only verifies the request came from a real vendor and
 * normalizes its payload — it never funds anything itself.
 * rpc_ingest_payment_event (service-role only, called via the admin
 * client below) does that, with its own independent guards (active
 * provider matches, transaction is fundable, amount matches). See that
 * function for why: a route bug here can produce a wrong signal, but it
 * cannot move money on its own.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const supabase = createAdminClient();

  const { data: active } = await supabase
    .from("payment_providers")
    .select("key")
    .eq("is_active", true)
    .eq("kind", "aggregator")
    .maybeSingle();

  if (!active) {
    // No automated aggregator is active (e.g. still on 'manual') — nothing
    // should be calling this URL yet. Record nothing; there's no active
    // provider row to attribute the event to.
    return NextResponse.json({ error: "No active payment aggregator configured." }, { status: 503 });
  }

  const adapter = paymentAdapters[active.key];
  if (!adapter) {
    return NextResponse.json(
      { error: `Provider '${active.key}' is active but has no adapter registered in src/lib/payments/registry.ts.` },
      { status: 500 }
    );
  }

  const signatureVerified = adapter.verifyWebhookSignature(rawBody, req.headers);

  let parsed;
  try {
    parsed = adapter.parseWebhookEvent(rawBody);
  } catch {
    // Even an unparseable payload from a "verified" sender shouldn't 500 —
    // record what we can and let an admin look at the raw payload.
    parsed = {
      eventType: "other" as const,
      transactionId: null,
      externalReference: "",
      amountMinor: null,
      currency: null,
    };
  }

  // p_transaction_id is a `uuid` column — an unrecognisable or missing
  // reference must become null here, not a raw type-cast error from
  // Postgres, so a garbled/unset api_ref still lands as a normal
  // "transaction not found" processing_error instead of a 500.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const transactionId = parsed.transactionId && uuidPattern.test(parsed.transactionId) ? parsed.transactionId : null;

  const { error } = await supabase.rpc("rpc_ingest_payment_event", {
    p_provider_key: active.key,
    p_event_type: parsed.eventType,
    p_transaction_id: transactionId,
    p_external_reference: parsed.externalReference,
    p_amount_minor: parsed.amountMinor,
    p_currency: parsed.currency,
    p_signature_verified: signatureVerified,
    p_raw_payload: JSON.parse(rawBody || "{}"),
  });

  if (error) {
    // Surfacing 500 here is deliberate: it's the signal that tells the
    // vendor's own retry mechanism to try again, for a failure that might
    // be transient (e.g. a DB hiccup) rather than a permanent rejection.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
