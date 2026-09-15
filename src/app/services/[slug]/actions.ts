"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveLocationId } from "@/lib/resolve-location";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateDemandSessionId, logDemandEvent } from "@/lib/demand-events";

export async function bookService(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to book a service." };

  const { allowed } = await checkRateLimit("book_service", { max: 10, windowSeconds: 600 });
  if (!allowed) return { error: "You're booking too quickly — please wait a few minutes and try again." };

  const serviceId = String(formData.get("service_id") ?? "");
  const providerId = formData.get("provider_id") ? String(formData.get("provider_id")) : null;
  const scheduledFor = formData.get("scheduled_for") ? String(formData.get("scheduled_for")) : null;
  const instructions = String(formData.get("instructions") ?? "");
  const contactPhone = String(formData.get("contact_phone") ?? "");
  // One fresh key per rendered form (see booking-form.tsx) — a double
  // submit of the SAME form reuses it, so rpc_book_service can recognize
  // and no-op the duplicate instead of creating a second transaction.
  const idempotencyKey = formData.get("idempotency_key") ? String(formData.get("idempotency_key")) : null;

  if (!contactPhone) return { error: "A contact phone number is required." };

  const rawLocation = formData.get("location_id") ? String(formData.get("location_id")) : null;
  const { id: locationId, error: locationError } = await resolveLocationId(supabase, rawLocation);
  if (locationError) return { error: locationError };

  // Price is resolved SERVER-SIDE inside rpc_book_service — this call never
  // sends an amount. See BUILD_PLAN.md Phase 6 acceptance criteria.
  const { data, error } = await supabase.rpc("rpc_book_service", {
    p_service_id: serviceId,
    p_provider_id: providerId,
    p_location_id: locationId,
    p_scheduled_for: scheduledFor,
    p_instructions: instructions,
    p_contact_phone: contactPhone,
    p_idempotency_key: idempotencyKey,
  });

  if (error) return { error: error.message };

  // MARKETPLACE-001 Phase 7 — demand-event instrumentation (inert/no-op
  // until the backing migration is applied). dedupKey ties this to the
  // same idempotency key rpc_book_service itself uses, so a retried
  // submit never double-counts as two "booking_created" events either.
  const demandSessionId = await getOrCreateDemandSessionId();
  await logDemandEvent({
    eventType: "booking_created",
    sessionId: demandSessionId,
    sourceSurface: "service_detail",
    serviceId,
    providerId,
    dedupKey: idempotencyKey ? `booking_created:${idempotencyKey}` : null,
  });

  redirect(`/account/bookings/${data}?created=1`);
}

// Starts a standing recurring arrangement (docs/07-payments.md §3) —
// creates recurring_series plus its first occurrence as an ordinary,
// individually-funded service_transactions row. Requires an explicit
// provider (no auto-match): a recurring arrangement is inherently with
// one specific professional, unlike a one-off booking.
export async function startRecurringSeries(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to book a service." };

  const { allowed } = await checkRateLimit("book_service", { max: 10, windowSeconds: 600 });
  if (!allowed) return { error: "You're booking too quickly — please wait a few minutes and try again." };

  const serviceId = String(formData.get("service_id") ?? "");
  const providerId = formData.get("provider_id") ? String(formData.get("provider_id")) : null;
  const frequency = String(formData.get("frequency") ?? "");
  const firstOccurrenceDate = String(formData.get("first_occurrence_date") ?? "");
  const instructions = String(formData.get("instructions") ?? "");
  const contactPhone = String(formData.get("contact_phone") ?? "");

  if (!providerId) return { error: "Choose a professional for this recurring arrangement." };
  if (!contactPhone) return { error: "A contact phone number is required." };
  if (!firstOccurrenceDate) return { error: "Choose a date for the first occurrence." };

  const rawLocation = formData.get("location_id") ? String(formData.get("location_id")) : null;
  const { id: locationId, error: locationError } = await resolveLocationId(supabase, rawLocation);
  if (locationError) return { error: locationError };

  const { error } = await supabase.rpc("rpc_start_recurring_series", {
    p_service_id: serviceId,
    p_provider_id: providerId,
    p_location_id: locationId,
    p_frequency: frequency,
    p_first_occurrence_date: firstOccurrenceDate,
    p_instructions: instructions,
    p_contact_phone: contactPhone,
  });

  if (error) return { error: error.message };

  redirect(`/account/bookings?recurring_started=1`);
}

// Read-only: mirrors the exact rules/blocked/booked checks rpc_book_service
// itself enforces at write time, so what the customer sees here is
// consistent with what booking will actually accept. rpc_book_service still
// independently re-validates server-side — this is a display aid, not the
// source of truth for whether a slot is really available.
export async function getAvailableSlots(providerId: string, serviceId: string, date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_get_available_slots", {
    p_provider_id: providerId,
    p_service_id: serviceId,
    p_date: date,
  });
  if (error) return { error: error.message };
  return { slots: (data ?? []).map((r: { slot_start: string }) => r.slot_start) };
}
