"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveLocationId } from "@/lib/resolve-location";

export async function bookService(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to book a service." };

  const serviceId = String(formData.get("service_id") ?? "");
  const providerId = formData.get("provider_id") ? String(formData.get("provider_id")) : null;
  const scheduledFor = formData.get("scheduled_for") ? String(formData.get("scheduled_for")) : null;
  const instructions = String(formData.get("instructions") ?? "");
  const contactPhone = String(formData.get("contact_phone") ?? "");

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
  });

  if (error) return { error: error.message };

  redirect(`/account/bookings/${data}?created=1`);
}
