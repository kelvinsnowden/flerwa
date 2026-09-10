-- 1. Real provider photos. avatar_url and the "avatars" storage bucket
-- (with correct owner-scoped RLS) already existed from the original MVP
-- build but were never wired to any UI — nothing to add here.

-- 2. A real pre-existing hole found while touching this table: "providers
-- self update" has no column restriction, so a provider can directly
-- UPDATE providers SET verification_status = 'verified' via PostgREST,
-- completely bypassing rpc_set_verification_status (the admin-gated
-- SECURITY DEFINER function a migration comment says is "the" path —
-- 20260908134652_rls_policies.sql: "verification_status is separately
-- guarded — see rpc functions"). It was never actually guarded at the
-- table level. is_published is deliberately left self-editable (a
-- provider pausing their own listing is harmless and doesn't touch trust
-- state); is_accepting_work/base_location_id/display_name/headline/bio/
-- avatar_url stay self-editable too.
create or replace function trg_guard_provider_trust_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.user_id is distinct from old.user_id
     or new.id is distinct from old.id then
    raise exception 'Verification status can only be changed by an admin via rpc_set_verification_status.';
  end if;
  return new;
end $$;

create trigger guard_provider_trust_fields before update on providers
  for each row execute function trg_guard_provider_trust_fields();
