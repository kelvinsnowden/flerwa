"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLocationId } from "@/lib/resolve-location";
import { verifyKenyaNationalId } from "@/lib/verification/adapters/kora";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// Step 1 — about you. Upserts the providers row (creating it on first
// save) rather than insert-only, so returning to the wizard to edit
// later works instead of hitting the unique(user_id) constraint.
export async function saveAboutYou(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const experienceSummary = String(formData.get("experience_summary") ?? "").trim();
  const storefrontTagline = String(formData.get("storefront_tagline") ?? "").trim();
  const rawLocation = String(formData.get("location_id") ?? "");
  const { id: locationId, error: locationError } = await resolveLocationId(supabase, rawLocation);
  if (locationError) return { error: locationError };

  if (!displayName) return { error: "Your display name is required." };

  const { data: existing } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("providers")
      .update({
        display_name: displayName,
        headline,
        bio,
        experience_summary: experienceSummary,
        storefront_tagline: storefrontTagline || null,
        base_location_id: locationId,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { success: true as const };
  }

  // is_published defaults to false and verification_status defaults to
  // 'pending' at the database level, guarded from here on by
  // trg_providers_guard_trust_fields — this insert cannot make a seller
  // live. Only an admin (via rpc_set_verification_status) can.
  const { error } = await supabase.from("providers").insert({
    user_id: user.id,
    slug: slugify(displayName),
    display_name: displayName,
    headline,
    bio,
    experience_summary: experienceSummary,
    storefront_tagline: storefrontTagline || null,
    base_location_id: locationId,
  });
  if (error) return { error: error.message };
  return { success: true as const };
}

// Step 2 — what do you offer. One rpc_set_provider_category call per
// selected category; see that function's own comment for why this can't
// just be a plain insert (provider_categories is otherwise admin-write-only).
export async function saveCategories(
  selections: { category_id: string; years_experience?: string; specialties?: string }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };
  if (selections.length === 0) return { error: "Choose at least one category." };

  for (const s of selections) {
    const attributes: Record<string, string> = {};
    if (s.years_experience?.trim()) attributes.years_experience = s.years_experience.trim();
    if (s.specialties?.trim()) attributes.specialties = s.specialties.trim();
    const { error } = await supabase.rpc("rpc_set_provider_category", {
      p_category_id: s.category_id,
      p_attributes: attributes,
    });
    if (error) return { error: error.message };
  }
  return { success: true as const };
}

// Step 3 — services & pricing. provider_services RLS already allows
// self-write (scoped to the caller's own provider_id), so this is a
// plain upsert — no RPC needed, per "extend what exists" guidance.
export async function saveServices(selections: { service_id: string; price_minor: number | null }[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "Finish step 1 first." };

  if (selections.length === 0) return { error: "Choose at least one service to offer." };

  const rows = selections.map((s) => ({
    provider_id: provider.id,
    service_id: s.service_id,
    price_minor: s.price_minor,
    is_active: true,
  }));
  const { error } = await supabase.from("provider_services").upsert(rows, { onConflict: "provider_id,service_id" });
  if (error) return { error: error.message };
  return { success: true as const };
}

// Step 4 — service area & availability. Areas are replaced wholesale
// (simplest correct semantics for "these are the areas I serve", same
// as re-saving a multi-select) — RLS already scopes both the delete and
// the insert to the caller's own provider_id.
export async function saveServiceArea(locationIds: string[], isAcceptingWork: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "Finish step 1 first." };

  const { error: delError } = await supabase.from("provider_service_areas").delete().eq("provider_id", provider.id);
  if (delError) return { error: delError.message };

  if (locationIds.length > 0) {
    const { error: insError } = await supabase
      .from("provider_service_areas")
      .insert(locationIds.map((location_id) => ({ provider_id: provider.id, location_id })));
    if (insError) return { error: insError.message };
  }

  const { error: acceptError } = await supabase
    .from("providers")
    .update({ is_accepting_work: isAcceptingWork })
    .eq("id", provider.id);
  if (acceptError) return { error: acceptError.message };

  return { success: true as const };
}

// Step 5 — submit. The seller does not appear verified merely for
// submitting — rpc_submit_for_verification only ever moves
// pending -> submitted, never further. National ID number + consent are
// saved here too (self-editable, not trust-guarded — see the migration
// comment). If an automated verification vendor is active and both are
// present, this also runs the real check synchronously and records the
// result for the admin queue — it never publishes or verifies the
// provider by itself; see docs/16-payment-verification-integrations.md.
export async function submitForVerification(nationalIdNumber: string, identityConsent: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "Finish step 1 first." };

  const { error: saveError } = await supabase
    .from("providers")
    .update({
      national_id_number: nationalIdNumber.trim() || null,
      identity_verification_consent: identityConsent,
    })
    .eq("id", provider.id);
  if (saveError) return { error: saveError.message };

  const { error } = await supabase.rpc("rpc_submit_for_verification");
  if (error) return { error: error.message };

  if (nationalIdNumber.trim() && identityConsent) {
    const admin = createAdminClient();
    const { data: activeVerifier } = await admin
      .from("verification_providers")
      .select("key")
      .eq("is_active", true)
      .neq("key", "manual")
      .maybeSingle();

    if (activeVerifier?.key === "kora") {
      const result = await verifyKenyaNationalId(nationalIdNumber.trim());
      // Recorded either way — a failure to reach Kora is itself useful
      // information for the admin queue, not silently dropped.
      await admin.rpc("rpc_record_identity_check", {
        p_provider_key: "kora",
        p_provider_id: provider.id,
        p_check_type: "id_document",
        p_external_reference: result.reference ?? "",
        p_status: result.ok ? (result.status ?? "manual_review") : "manual_review",
        p_raw_result: result.ok ? (result.raw ?? {}) : { error: result.error },
      });
    }
  }

  revalidatePath("/provider");
  revalidatePath("/provider/apply");
  redirect("/provider");
}
