-- =====================================================================
-- Completes the dispute path the schema already anticipated: the
-- `disputes` table and its RLS policies exist and already let a
-- transaction participant INSERT their own dispute row directly, and
-- rpc_request_revision's own error message says "Open a dispute
-- instead" once the revision limit is hit — but no function ever moved
-- service_transactions.state to 'disputed', so a customer had no real
-- way to flag a transaction as disputed. Customers have zero UPDATE
-- policy on service_transactions by design (money/state is never
-- client-authoritative), so this has to be a SECURITY DEFINER RPC,
-- the same shape as every other state transition in this schema.
-- =====================================================================

create or replace function rpc_open_dispute(
  p_transaction_id uuid, p_reason text, p_description text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_dispute_id uuid;
begin
  if auth.uid() is null or not is_txn_participant(p_transaction_id) then
    raise exception 'Not authorized for this transaction.';
  end if;

  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;

  if v_txn.state not in (
    'funded', 'scheduled', 'en_route', 'checked_in', 'in_progress',
    'evidence_submitted', 'customer_review', 'revision_requested'
  ) then
    raise exception 'Cannot open a dispute from state %.', v_txn.state;
  end if;

  insert into disputes (transaction_id, opened_by, reason, description)
  values (p_transaction_id, auth.uid(), p_reason, p_description)
  returning id into v_dispute_id;

  update service_transactions set state = 'disputed', updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'dispute_opened', v_txn.state, 'disputed',
    jsonb_build_object('dispute_id', v_dispute_id, 'reason', p_reason));

  return v_dispute_id;
end $$;

revoke execute on function rpc_open_dispute(uuid, text, text) from anon;
grant execute on function rpc_open_dispute(uuid, text, text) to authenticated;
