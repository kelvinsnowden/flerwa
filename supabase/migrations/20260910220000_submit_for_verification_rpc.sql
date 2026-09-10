-- trg_providers_guard_trust_fields (previous migration) now blocks ANY
-- non-admin change to verification_status — including the legitimate
-- self-transition "I've finished my profile, please review me." Give it
-- the same narrow, session-local escape hatch every other guarded state
-- transition in this schema uses (app.bypass_txn_guard's own pattern),
-- and the only function allowed to use it enforces the sole legal
-- transition (pending -> submitted) itself, not the trigger.
create or replace function trg_providers_guard_trust_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_provider_trust_guard', true), 'off') = 'on' then
    return new;
  end if;
  if (new.verification_status is distinct from old.verification_status
      or new.is_published is distinct from old.is_published
      or new.verified_at is distinct from old.verified_at)
     and not is_admin() then
    raise exception 'Only an admin may change verification status or publish state.';
  end if;
  return new;
end $$;

create or replace function rpc_submit_for_verification()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_provider providers%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  select * into v_provider from providers where user_id = auth.uid() for update;
  if not found then raise exception 'You need a seller profile first.'; end if;
  if v_provider.verification_status <> 'pending' then
    raise exception 'Your application has already been submitted.';
  end if;

  perform set_config('app.bypass_provider_trust_guard', 'on', true);
  update providers set verification_status = 'submitted', updated_at = now() where id = v_provider.id;
end $$;

revoke execute on function rpc_submit_for_verification() from public, anon;
grant execute on function rpc_submit_for_verification() to authenticated;
