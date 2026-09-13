-- Customers had no way to back out of a booking before work started —
-- ApproveOrReviseControls only appears once evidence is in, and
-- DisputeLink exists for when something's already wrong, not for "I
-- changed my mind." Allowed any time up to (not including) the Pro
-- checking in, per the product decision: once someone is physically
-- on site the job is underway and it becomes a dispute, not a cancel.
--
-- If the booking was already funded, the held amount is reversed via
-- ledger_entries so the books stay balanced; the actual M-Pesa refund
-- still happens out-of-band and is confirmed by an admin, mirroring
-- how rpc_confirm_manual_payment records a payment that already moved
-- off-platform — this function only ever marks payments.state =
-- 'refunded' to reflect that money is owed back, not that it has
-- already left the account.
create or replace function rpc_cancel_booking(p_transaction_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found or v_txn.customer_id <> auth.uid() then raise exception 'Not authorized.'; end if;

  if v_txn.state not in ('requested', 'quoted', 'quote_accepted', 'funded', 'scheduled', 'en_route') then
    raise exception 'Cannot cancel from state % — the Pro has already checked in.', v_txn.state;
  end if;

  v_new_state := case when v_txn.funded_at is not null then 'refunded' else 'cancelled_by_customer' end;

  if v_txn.funded_at is not null then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values
      (v_group, p_transaction_id, 'funds_held', null, 'debit', v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
      (v_group, p_transaction_id, 'materials_held', null, 'debit', v_txn.materials_amount_minor, v_txn.currency),
      (v_group, p_transaction_id, 'refunds', v_txn.customer_id, 'credit', v_txn.total_amount_minor, v_txn.currency);

    update payments set state = 'refunded', refunded_at = now() where transaction_id = p_transaction_id;
  end if;

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = v_new_state,
        cancelled_reason = p_reason,
        closed_at = now(),
        updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'booking_cancelled', v_txn.state, v_new_state,
    jsonb_build_object('reason', p_reason));

  if v_txn.provider_id is not null then
    insert into notifications (user_id, type, title, body, transaction_id)
    select user_id, 'booking_cancelled', 'Booking cancelled',
      'The customer cancelled this booking' || case when p_reason is not null and p_reason <> '' then ': ' || p_reason else '.' end,
      p_transaction_id
    from providers where id = v_txn.provider_id;
  end if;
end $$;

revoke execute on function rpc_cancel_booking(uuid, text) from public, anon;
grant execute on function rpc_cancel_booking(uuid, text) to authenticated;
