import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutAdapters } from "@/lib/payouts/registry";

/**
 * Inbound webhook endpoint for whichever payout vendor is currently
 * active in `payout_providers` — the outbound counterpart to
 * /api/webhooks/payments. Point that vendor's payout/disbursement
 * webhook dashboard at this one URL.
 *
 * Unlike the payments route, a payout's external_reference is not a
 * caller-supplied merchant reference — it's whatever tracking id the
 * vendor's own API handed back when the payout was initiated (see
 * src/lib/payouts/adapters/intasend-payout.ts's header comment), so this
 * route resolves the payout by looking that reference up in `payouts`
 * itself before handing off to rpc_ingest_payout_event, rather than
 * trusting a payout id out of the unauthenticated payload.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const supabase = createAdminClient();

  const { data: active } = await supabase.from("payout_providers").select("key").eq("is_active", true).maybeSingle();

  if (!active) {
    return NextResponse.json({ error: "No active payout provider configured." }, { status: 503 });
  }

  const adapter = payoutAdapters[active.key];
  if (!adapter) {
    return NextResponse.json(
      { error: `Provider '${active.key}' is active but has no adapter registered in src/lib/payouts/registry.ts.` },
      { status: 500 }
    );
  }

  const signatureVerified = await adapter.verifyWebhookSignature(rawBody, req.headers);

  let parsed;
  try {
    parsed = await adapter.parseWebhookEvent(rawBody, req.headers);
  } catch {
    parsed = { eventType: "other" as const, payoutId: null, externalReference: "", amountMinor: null, currency: null };
  }

  let payoutId: string | null = parsed.payoutId;
  if (!payoutId && parsed.externalReference) {
    const { data: payout } = await supabase
      .from("payouts")
      .select("id")
      .eq("external_reference", parsed.externalReference)
      .maybeSingle();
    payoutId = payout?.id ?? null;
  }

  const { error } = await supabase.rpc("rpc_ingest_payout_event", {
    p_provider_key: active.key,
    p_event_type: parsed.eventType,
    p_payout_id: payoutId,
    p_external_reference: parsed.externalReference,
    p_amount_minor: parsed.amountMinor,
    p_currency: parsed.currency,
    p_signature_verified: signatureVerified,
    p_raw_payload: JSON.parse(rawBody || "{}"),
  });

  if (error) {
    // Deliberate 500 — signals the vendor's retry mechanism to try again
    // for a failure that might be transient.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
