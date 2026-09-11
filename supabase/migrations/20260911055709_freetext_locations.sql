-- Kenya-wide location entry. Until now `locations` only had 8 seeded
-- Nairobi wards, and every location picker (booking, post-a-task, seller
-- base location) was a closed dropdown over that list — a real user
-- anywhere outside those 8 Nairobi neighbourhoods had no way to enter
-- where they actually are. Reported live: "let the users type their
-- location not just the few locations... this will be a Kenya wide
-- product."
--
-- Fix: a narrow SECURITY DEFINER RPC that resolves free-typed text into a
-- real `locations` row — reusing an existing one by slug if it already
-- matches, creating a new one otherwise. This keeps `locations` a proper
-- table (every booking/task/provider still has a structured location_id,
-- service-area filtering keeps working) while letting the client accept
-- literally any Kenyan place name, not just a pre-seeded list. It is
-- additive: existing rows and their slugs are untouched, and callers that
-- still pass a known location_id continue to work unchanged (this RPC is
-- opt-in, used only by the free-text combobox call sites).
create or replace function rpc_get_or_create_location(p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := trim(p_text);
  v_ward text;
  v_town text;
  v_county text;
  v_slug text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized.';
  end if;
  if v_raw = '' or length(v_raw) > 120 then
    raise exception 'Please enter a location.';
  end if;

  -- "Nyali, Mombasa" -> ward=Nyali, town=Mombasa. Plain "Kisumu" -> town
  -- only. County isn't asked for separately (this is a single free-text
  -- field, matching the reference mockups) so it defaults to the town
  -- name, which is correct for the common case of a Kenyan town that is
  -- also its own county seat (Mombasa, Kisumu, Nakuru, Eldoret, ...).
  -- Imprecise for a sub-location of a county typed without its county
  -- name (e.g. "Karen" alone), same as the pre-existing Nairobi seed data
  -- already handles by hardcoding county='Nairobi' for its ward rows —
  -- this RPC never touches those existing rows, only new ones.
  if position(',' in v_raw) > 0 then
    v_ward := trim(split_part(v_raw, ',', 1));
    v_town := trim(substring(v_raw from position(',' in v_raw) + 1));
  else
    v_ward := null;
    v_town := v_raw;
  end if;
  if v_town = '' then
    raise exception 'Please enter a location.';
  end if;
  v_county := v_town;

  v_slug := lower(v_county || '-' || v_town || coalesce('-' || v_ward, ''));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  select id into v_id from locations where slug = v_slug;
  if found then
    return v_id;
  end if;

  insert into locations (country, county, town, ward, slug)
  values ('KE', v_county, v_town, v_ward, v_slug)
  returning id into v_id;

  return v_id;
end;
$$;

-- `revoke all ... from public` alone does NOT strip the direct per-role
-- grant this project's default privileges apply to `anon` at CREATE
-- FUNCTION time (the same gap SECURITY.md §8 documents and fixes for
-- every other rpc_* function) — `anon` must be revoked explicitly.
revoke all on function rpc_get_or_create_location(text) from public;
revoke execute on function rpc_get_or_create_location(text) from anon;
grant execute on function rpc_get_or_create_location(text) to authenticated;
