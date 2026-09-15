import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * MARKETPLACE-001 Phase 7 — demand/search event instrumentation.
 *
 * Backed by migration_proposals/PROPOSED_marketplace_001_demand_events.sql
 * (rpc_log_demand_event), which is NOT yet applied to production — see
 * MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md. Until it's authorized and
 * applied, every call in this file fails with "function
 * rpc_log_demand_event does not exist" and is silently swallowed by
 * design (see logDemandEvent's own doc comment) — this instrumentation
 * is inert, not broken, in the meantime. No event is ever fabricated;
 * this only records what actually happens.
 */

export type DemandEventType =
  | "search_performed"
  | "search_no_results"
  | "search_results_viewed"
  | "provider_impression"
  | "provider_profile_viewed"
  | "service_viewed"
  | "booking_started"
  | "booking_created"
  | "booking_completed"
  | "booking_cancelled"
  | "quote_requested"
  | "quote_received"
  | "quote_accepted"
  | "request_created"
  | "request_unfulfilled"
  | "provider_unavailable"
  | "search_abandoned";

export interface DemandEventInput {
  eventType: DemandEventType;
  sessionId: string;
  sourceSurface: string;
  categoryId?: string | null;
  serviceId?: string | null;
  providerId?: string | null;
  locationId?: string | null;
  searchTerm?: string | null;
  priceRangeBucket?: string | null;
  resultCount?: number | null;
  correlationId?: string | null;
  dedupKey?: string | null;
  metadata?: Record<string, unknown>;
}

const SESSION_COOKIE = "flerwa_demand_sid";

/**
 * Coarse, non-reversible price-range bucket for demand-by-price
 * reporting — never stores or exposes the raw amount as a demand
 * signal. Amounts are in minor units (cents-equivalent, KES so *100).
 */
export function bucketPriceRangeMinor(amountMinor: number | null | undefined): string | null {
  if (amountMinor == null || !Number.isFinite(amountMinor) || amountMinor < 0) return null;
  const kes = amountMinor / 100;
  if (kes < 1000) return "under_1000";
  if (kes < 5000) return "1000_5000";
  if (kes < 20000) return "5000_20000";
  if (kes < 50000) return "20000_50000";
  return "over_50000";
}

/**
 * Reads (or generates) the anonymous session id used to correlate
 * demand events for this browser. Never used for authentication or
 * authorization — purely a browsing-session correlation key, exactly
 * like the design documented in MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md.
 * Cookie writes only succeed when called from a Server Action or Route
 * Handler (a Next.js constraint, not a bug here) — a plain page render
 * still gets a usable id for that single request, it just won't persist
 * across requests until first set from an action.
 */
export async function getOrCreateDemandSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  try {
    store.set(SESSION_COOKIE, id, {
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax",
      httpOnly: true,
    });
  } catch {
    // Expected when called during a render rather than an action/handler.
  }
  return id;
}

/**
 * Fire-and-forget demand-event logger. NEVER throws — analytics is
 * best-effort by design and must never break the page or action that
 * calls it, including before the backing migration is applied.
 */
export async function logDemandEvent(input: DemandEventInput): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("rpc_log_demand_event", {
      p_event_type: input.eventType,
      p_session_id: input.sessionId,
      p_source_surface: input.sourceSurface,
      p_category_id: input.categoryId ?? null,
      p_service_id: input.serviceId ?? null,
      p_provider_id: input.providerId ?? null,
      p_location_id: input.locationId ?? null,
      p_search_term: input.searchTerm ?? null,
      p_price_range_bucket: input.priceRangeBucket ?? null,
      p_result_count: input.resultCount ?? null,
      p_correlation_id: input.correlationId ?? null,
      p_dedup_key: input.dedupKey ?? null,
      p_metadata: input.metadata ?? {},
    });
  } catch {
    // Intentionally swallowed — see doc comment above.
  }
}
