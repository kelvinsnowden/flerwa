-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PROV-E3: publishProvider() in
-- src/app/admin/verifications/actions.ts did a direct `providers` table
-- update (permitted by the "providers self update" RLS policy for
-- is_admin()) with no admin_actions entry — the only admin-privileged
-- provider action that bypassed the audit trail. admin_actions has no
-- INSERT policy for any client role, so logging this from the server
-- action directly isn't possible without a SECURITY DEFINER function; this
-- adds one, narrowly, without touching the existing self-update RLS policy
-- (a provider's own direct update of their own row, if ever wired into a
-- provider-facing UI, is unaffected).
create or replace function rpc_admin_set_provider_published(p_provider_id uuid, p_publish boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can publish or unpublish a provider.'; end if;
  if not exists (select 1 from providers where id = p_provider_id) then
    raise exception 'Provider not found.';
  end if;

  update providers set is_published = p_publish where id = p_provider_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_provider_published', 'providers', p_provider_id, jsonb_build_object('publish', p_publish));
end $$;

revoke execute on function rpc_admin_set_provider_published(uuid, boolean) from public, anon;
grant execute on function rpc_admin_set_provider_published(uuid, boolean) to authenticated;
