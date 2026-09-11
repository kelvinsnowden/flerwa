import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Location form fields (see Combobox's `freeText` mode) submit either a
 * real `locations.id` (the user picked an existing suggestion) or raw
 * typed text (anything else — this is a Kenya-wide product, not limited
 * to the pre-seeded Nairobi wards). This resolves either shape into a
 * real location id, creating a new `locations` row via
 * `rpc_get_or_create_location` only when the submitted value isn't
 * already a real id.
 */
export async function resolveLocationId(
  supabase: SupabaseClient,
  raw: string | null
): Promise<{ id: string | null; error?: string }> {
  if (!raw || !raw.trim()) return { id: null };
  if (UUID_RE.test(raw)) return { id: raw };

  const { data, error } = await supabase.rpc("rpc_get_or_create_location", { p_text: raw });
  if (error) return { id: null, error: "We couldn't recognise that location — try a nearby town or area name." };
  return { id: data as string };
}
