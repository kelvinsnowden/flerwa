-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md CUST-D3/D4: profiles.is_suspended
-- and its guard trigger (trg_profiles_guard_role, 20260910062301) have
-- existed since the trust-guard consolidation pass, but nothing in the
-- entire codebase ever calls them (confirmed via grep — zero references
-- in src/). A capability that exists in the schema but is unreachable from
-- any admin surface is, in practice, the same as it not existing. The
-- trigger already lets an admin update is_suspended via a direct RLS
-- update; this wraps that in an RPC purely to get the admin_actions audit
-- entry (the trigger/RLS alone give zero audit trail, same class of gap
-- already found and fixed for provider publish/unpublish this session).
create or replace function rpc_set_customer_suspended(p_profile_id uuid, p_suspended boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target profiles%rowtype;
begin
  if not is_admin() then raise exception 'Only an admin can change suspension status.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to suspend or reinstate an account.';
  end if;

  select * into v_target from profiles where id = p_profile_id;
  if not found then raise exception 'Account not found.'; end if;
  if v_target.role = 'admin' then
    raise exception 'Cannot suspend an admin account through this action.';
  end if;

  update profiles set is_suspended = p_suspended where id = p_profile_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_customer_suspended', 'profiles', p_profile_id,
          jsonb_build_object('suspended', p_suspended, 'reason', p_reason));
end $$;

revoke execute on function rpc_set_customer_suspended(uuid, boolean, text) from public, anon;
grant execute on function rpc_set_customer_suspended(uuid, boolean, text) to authenticated;
