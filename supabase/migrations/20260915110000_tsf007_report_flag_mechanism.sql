-- TSF-007: report/flag mechanism for messages, reviews, and profiles.
create type report_target_type as enum ('message', 'review', 'provider_profile', 'customer_profile');
create type report_state as enum ('open', 'reviewing', 'actioned', 'dismissed');

create table reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references auth.users(id),
  target_type      report_target_type not null,
  target_id        uuid not null,
  reason           text not null check (btrim(reason) <> ''),
  description      text,
  state            report_state not null default 'open',
  resolved_by      uuid references auth.users(id),
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now()
);
create index reports_target_idx on reports (target_type, target_id);
create index reports_state_created_idx on reports (state, created_at desc);

alter table reports enable row level security;

-- Mirrors is_admin()/is_txn_participant()'s pattern: called from RLS policies,
-- so it must stay callable by authenticated (not the _-prefixed internal
-- helper pattern that gets revoked from public/anon/authenticated).
create or replace function can_report_target(p_target_type report_target_type, p_target_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_target_type
    when 'message' then exists (
      select 1 from messages m
      left join service_transactions t on t.id = m.transaction_id
      left join conversations c on c.id = m.conversation_id
      left join providers pt on pt.id = t.provider_id
      left join providers pc on pc.id = c.provider_id
      where m.id = p_target_id
        and (
          t.customer_id = auth.uid() or pt.user_id = auth.uid()
          or c.customer_id = auth.uid() or pc.user_id = auth.uid()
        )
    )
    when 'review' then exists (select 1 from reviews where id = p_target_id)
    when 'provider_profile' then exists (select 1 from providers where id = p_target_id)
    when 'customer_profile' then exists (
      select 1 from service_transactions t join providers p on p.id = t.provider_id
      where t.customer_id = p_target_id and p.user_id = auth.uid()
    ) or exists (
      select 1 from conversations c join providers p on p.id = c.provider_id
      where c.customer_id = p_target_id and p.user_id = auth.uid()
    )
    else false
  end;
$$;

revoke all on function can_report_target(report_target_type, uuid) from public;
grant execute on function can_report_target(report_target_type, uuid) to authenticated;

create policy "reporter and admin can read reports" on reports
  for select using (reporter_id = auth.uid() or is_admin());

create policy "authenticated can report visible content" on reports
  for insert
  with check (reporter_id = auth.uid() and can_report_target(target_type, target_id));

create or replace function rpc_admin_resolve_report(p_report_id uuid, p_state report_state, p_resolution_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may resolve a report.'; end if;
  if p_state not in ('reviewing', 'actioned', 'dismissed') then
    raise exception 'Invalid resolution state %.', p_state;
  end if;

  update reports
    set state = p_state,
        resolved_by = case when p_state in ('actioned', 'dismissed') then auth.uid() else resolved_by end,
        resolved_at = case when p_state in ('actioned', 'dismissed') then now() else resolved_at end,
        resolution_note = coalesce(p_resolution_note, resolution_note)
    where id = p_report_id;
  if not found then raise exception 'Report not found.'; end if;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'resolve_report', 'reports', p_report_id, jsonb_build_object('state', p_state, 'note', p_resolution_note));
end $$;

revoke all on function rpc_admin_resolve_report(uuid, report_state, text) from public, anon;
grant execute on function rpc_admin_resolve_report(uuid, report_state, text) to authenticated;
