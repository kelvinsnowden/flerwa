-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md DIS-I4: disputes had no assignee
-- field at all — every open dispute is implicitly "anyone's," which
-- doesn't scale past a single admin. "disputes admin update" RLS already
-- lets any admin write any dispute row directly; this RPC exists purely
-- for the audit entry a raw update wouldn't produce, same as every other
-- admin-write-with-existing-RLS gap closed this session.
alter table disputes add column assigned_to uuid references auth.users(id);

create or replace function rpc_admin_assign_dispute(p_dispute_id uuid, p_assignee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can assign a dispute.'; end if;
  if not exists (select 1 from disputes where id = p_dispute_id) then
    raise exception 'Dispute not found.';
  end if;
  if p_assignee_id is not null and not exists (select 1 from profiles where id = p_assignee_id and role = 'admin') then
    raise exception 'Assignee must be an admin.';
  end if;

  update disputes set assigned_to = p_assignee_id where id = p_dispute_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'assign_dispute', 'disputes', p_dispute_id, jsonb_build_object('assigned_to', p_assignee_id));
end $$;

revoke execute on function rpc_admin_assign_dispute(uuid, uuid) from public, anon;
grant execute on function rpc_admin_assign_dispute(uuid, uuid) to authenticated;
