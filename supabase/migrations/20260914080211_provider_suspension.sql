-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PROV-E6: providers had no
-- suspension mechanism distinct from verification_status at all (unlike
-- profiles, which already had is_suspended — see CUST-D3's finding this
-- session). Mirrors that exact shape: new column, extend the existing
-- consolidated trust-guard trigger (trg_guard_provider_trust_fields,
-- migration 20260910143623) to also protect it, new admin RPC for the
-- audit entry.
alter table providers add column is_suspended boolean not null default false;

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
     or new.is_published is distinct from old.is_published
     or new.is_suspended is distinct from old.is_suspended then
    raise exception 'Verification status, publish state, and suspension can only be changed by an admin via the relevant rpc_*.';
  end if;
  return new;
end $$;

create or replace function rpc_admin_set_provider_suspended(p_provider_id uuid, p_suspended boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change provider suspension status.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to suspend or reinstate a provider.';
  end if;
  if not exists (select 1 from providers where id = p_provider_id) then
    raise exception 'Provider not found.';
  end if;

  update providers set is_suspended = p_suspended where id = p_provider_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_provider_suspended', 'providers', p_provider_id,
          jsonb_build_object('suspended', p_suspended, 'reason', p_reason));
end $$;

revoke execute on function rpc_admin_set_provider_suspended(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_provider_suspended(uuid, boolean, text) to authenticated;
