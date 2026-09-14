-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md EMG-R1: categories.is_active +
-- its RLS enforcement ("categories readable": is_active OR is_admin();
-- non-admins simply can't see an inactive category at all) already
-- existed — the register's own TSF-014 finding named this as "the
-- fastest, smallest fix" for category-level emergency pause, but no admin
-- UI ever exposed it. "categories admin write" RLS already lets an admin
-- update this directly; this RPC exists only to get the admin_actions
-- audit entry a raw update wouldn't produce (same class of gap as every
-- other *_published/*_suspended RPC added this session).
create or replace function rpc_admin_set_category_active(p_category_id uuid, p_active boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can pause or resume a category.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to pause or resume a category.';
  end if;
  if not exists (select 1 from categories where id = p_category_id) then
    raise exception 'Category not found.';
  end if;

  update categories set is_active = p_active where id = p_category_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_category_active', 'categories', p_category_id,
          jsonb_build_object('active', p_active, 'reason', p_reason));
end $$;

revoke execute on function rpc_admin_set_category_active(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_category_active(uuid, boolean, text) to authenticated;
