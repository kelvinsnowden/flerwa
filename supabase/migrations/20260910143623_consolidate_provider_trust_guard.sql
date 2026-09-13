-- Correction to the previous migration (20260910190000): a live DB check
-- during QA found a pre-existing trigger, trg_guard_provider_trust_fields
-- (from 20260910120000_provider_avatar_and_trust_guard.sql, an earlier
-- session), already guarding verification_status/verified_at against
-- self-update. The earlier grep in this pass searched for
-- "trg_providers_guard" and missed it — different word order
-- ("guard_provider" vs "providers_guard"). So the SECURITY.md claim that
-- verification_status itself was wide open was wrong; it wasn't.
--
-- The real, narrower gap: that pre-existing trigger did NOT cover
-- is_published. services/[slug]/page.tsx's provider query filters on
-- is_published (+ category clearance) without also re-checking
-- verification_status, so a provider self-setting is_published = true
-- could appear as a bookable choice on a service page as soon as an
-- admin had cleared them for at least one category — skipping the
-- admin's separate "go live" decision, even though they'd still show as
-- unverified everywhere verification_status is surfaced. Real, but
-- smaller than originally written up.
--
-- Consolidated into the ONE existing trigger/function rather than left
-- as two overlapping triggers with confusingly similar names — the
-- redundant one from 20260910190000 is dropped here.
create or replace function trg_guard_provider_trust_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if coalesce(current_setting('app.bypass_provider_trust_guard', true), 'off') = 'on' then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.user_id is distinct from old.user_id
     or new.id is distinct from old.id
     or new.is_published is distinct from old.is_published then
    raise exception 'Verification status and publish state can only be changed by an admin via rpc_set_verification_status.';
  end if;
  return new;
end $$;

drop trigger if exists providers_guard_trust_fields on providers;
drop function if exists trg_providers_guard_trust_fields();
