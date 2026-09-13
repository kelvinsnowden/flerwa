-- Review tags + "would you book again" (mockup's Leave a Review screen)
-- and a provider-written completion summary (mockup's Inspection Report
-- "Provider notes"). No column-level RLS concern here: "reviews participant
-- insert" already restricts the row (reviewer_id/reviewee/participant/
-- settled-state), not specific columns, so these are safe to add plain.
alter table reviews add column tags text[] not null default '{}';
alter table reviews add column would_book_again boolean;

alter table service_transactions add column completion_summary text;

-- rpc_submit_completion needs a new optional parameter — Postgres treats a
-- different parameter list as a different function, so the old signature
-- is dropped explicitly rather than left to create an ambiguous overload.
drop function if exists rpc_submit_completion(uuid);

create or replace function rpc_submit_completion(p_transaction_id uuid, p_summary text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_missing int;
begin
  select t.* into v_txn from service_transactions t
    join providers p on p.id = t.provider_id
    where t.id = p_transaction_id and p.user_id = auth.uid()
    for update;
  if not found then raise exception 'Not authorized for this transaction.'; end if;
  if v_txn.state not in ('checked_in','in_progress','revision_requested') then
    raise exception 'Cannot submit completion from state %.', v_txn.state;
  end if;

  select count(*) into v_missing
  from service_checklist_items sci
  where sci.service_id = v_txn.service_id and sci.is_required
    and not exists (
      select 1 from transaction_checklist_results r
      where r.transaction_id = p_transaction_id and r.checklist_item_id = sci.id and r.is_complete
    );
  if v_missing > 0 then
    raise exception 'Cannot submit: % required checklist item(s) incomplete.', v_missing;
  end if;

  update service_transactions
    set state = 'evidence_submitted', evidence_at = now(),
        auto_approve_at = now() + interval '5 days',
        completion_summary = p_summary,
        updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'completion_submitted', v_txn.state, 'evidence_submitted', '{}'::jsonb);

  insert into notifications (user_id, type, title, body, transaction_id)
  values (v_txn.customer_id, 'evidence_ready', 'Your report is ready',
          'Your provider has submitted evidence. Review it and approve, or request a revision.',
          p_transaction_id);
end $$;

revoke execute on function rpc_submit_completion(uuid, text) from public, anon;
grant execute on function rpc_submit_completion(uuid, text) to authenticated;
