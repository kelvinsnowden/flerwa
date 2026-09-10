-- The disputes table, its "disputes admin update" RLS policy, and
-- financial_outcome's documented shape ({"provider_minor": x,
-- "customer_refund_minor": y}) all already existed — nobody ever wrote
-- the function that actually resolves a dispute and moves money.
-- Mirrors _release_transaction's ledger/state-transition pattern: the
-- guard trigger still blocks a direct state write into a money-moving
-- state, so this uses the same app.bypass_txn_guard escape hatch every
-- other sanctioned money-moving RPC uses.
create or replace function rpc_resolve_dispute(
  p_dispute_id uuid,
  p_provider_minor bigint,
  p_customer_refund_minor bigint,
  p_resolution text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_dispute disputes%rowtype;
  v_txn service_transactions%rowtype;
  v_provider_user_id uuid;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
begin
  if not is_admin() then raise exception 'Only an admin may resolve a dispute.'; end if;

  select * into v_dispute from disputes where id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found.'; end if;
  if v_dispute.state = 'resolved' then raise exception 'Dispute is already resolved.'; end if;

  select * into v_txn from service_transactions where id = v_dispute.transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state <> 'disputed' then
    raise exception 'Transaction is in state % — only a disputed transaction can be resolved this way.', v_txn.state;
  end if;

  if p_provider_minor < 0 or p_customer_refund_minor < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;
  if p_provider_minor + p_customer_refund_minor <> v_txn.service_amount_minor then
    raise exception 'Provider amount + customer refund (%) must equal the service amount (%).',
      p_provider_minor + p_customer_refund_minor, v_txn.service_amount_minor;
  end if;

  select user_id into v_provider_user_id from providers where id = v_txn.provider_id;

  -- Platform fee is retained either way — the verification work happened
  -- regardless of the dispute's outcome. The service amount splits per
  -- the admin's decision.
  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, v_txn.id, 'funds_held', null, 'debit', v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, v_txn.id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor, v_txn.currency);

  if p_provider_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'provider_payable', v_provider_user_id, 'credit', p_provider_minor, v_txn.currency);
  end if;
  if p_customer_refund_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'refunds', v_txn.customer_id, 'credit', p_customer_refund_minor, v_txn.currency);
  end if;

  update disputes
    set state = 'resolved', resolution = p_resolution,
        financial_outcome = jsonb_build_object('provider_minor', p_provider_minor, 'customer_refund_minor', p_customer_refund_minor),
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_dispute_id;

  v_new_state := case when p_customer_refund_minor = v_txn.service_amount_minor then 'refunded' else 'settled' end;

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = v_new_state,
        settled_at = case when v_new_state = 'settled' then now() else settled_at end,
        updated_at = now()
    where id = v_txn.id;

  perform log_event(v_txn.id, 'dispute_resolved', 'disputed', v_new_state,
    jsonb_build_object('dispute_id', p_dispute_id, 'provider_minor', p_provider_minor, 'customer_refund_minor', p_customer_refund_minor));

  perform recompute_reliability(v_txn.provider_id);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'resolve_dispute', 'disputes', p_dispute_id,
          jsonb_build_object('resolution', p_resolution, 'provider_minor', p_provider_minor, 'customer_refund_minor', p_customer_refund_minor));

  insert into notifications (user_id, type, title, body, transaction_id)
  values
    (v_txn.customer_id, 'dispute_resolved', 'Your dispute has been resolved', p_resolution, v_txn.id),
    (v_provider_user_id, 'dispute_resolved', 'A dispute has been resolved', p_resolution, v_txn.id);
end $$;

revoke execute on function rpc_resolve_dispute(uuid, bigint, bigint, text) from public, anon;
grant execute on function rpc_resolve_dispute(uuid, bigint, bigint, text) to authenticated;

-- Same shape of gap: deal_desk_requests (provider-submitted, off-platform
-- customer email/phone only — no auth account) was fully capturable but
-- had no admin conversion path into a real, protected service_transaction.
-- Requires the customer to already be a registered user (looked up by the
-- admin, e.g. after contacting them to sign up) — this deliberately does
-- NOT create an auth account on the customer's behalf, which would be a
-- much bigger, separate feature (email invites, Admin API user creation)
-- outside this fix's scope.
create or replace function rpc_convert_deal_desk_request(
  p_request_id uuid,
  p_customer_id uuid,
  p_category_id uuid,
  p_fulfilment_mode fulfilment_mode,
  p_amount_minor bigint,
  p_platform_fee_minor bigint
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req deal_desk_requests%rowtype;
  v_txn_id uuid;
begin
  if not is_admin() then raise exception 'Only an admin may convert a Deal Desk request.'; end if;

  select * into v_req from deal_desk_requests where id = p_request_id for update;
  if not found then raise exception 'Deal Desk request not found.'; end if;
  if v_req.state <> 'pending' then
    raise exception 'This request is in state % — only a pending request can be converted.', v_req.state;
  end if;
  if not exists (select 1 from profiles where id = p_customer_id) then
    raise exception 'Customer not found — they must already have an account.';
  end if;
  if p_amount_minor <= 0 then raise exception 'Amount must be positive.'; end if;
  if p_platform_fee_minor < 0 then raise exception 'Platform fee cannot be negative.'; end if;

  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, fulfilment_mode, state,
    origin, service_amount_minor, platform_fee_minor, customer_instructions,
    contact_phone, requested_at
  ) values (
    p_customer_id, v_req.provider_id, null, p_category_id, p_fulfilment_mode, 'requested',
    'deal_desk', p_amount_minor, p_platform_fee_minor, v_req.description,
    v_req.customer_phone, now()
  ) returning id into v_txn_id;

  update deal_desk_requests set state = 'converted', transaction_id = v_txn_id where id = p_request_id;

  perform log_event(v_txn_id, 'deal_desk_converted', 'draft', 'requested',
    jsonb_build_object('deal_desk_request_id', p_request_id));

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'convert_deal_desk_request', 'deal_desk_requests', p_request_id,
          jsonb_build_object('transaction_id', v_txn_id));

  insert into notifications (user_id, type, title, body, transaction_id)
  values (p_customer_id, 'deal_desk_converted', 'Your booking is set up',
          'Your provider''s arrangement has been converted into a protected booking. We''ll be in touch to confirm payment.',
          v_txn_id);

  return v_txn_id;
end $$;

revoke execute on function rpc_convert_deal_desk_request(uuid, uuid, uuid, fulfilment_mode, bigint, bigint) from public, anon;
grant execute on function rpc_convert_deal_desk_request(uuid, uuid, uuid, fulfilment_mode, bigint, bigint) to authenticated;

-- Admin also needs to be able to decline a request outright without
-- converting it (e.g. it doesn't belong on the platform).
create or replace function rpc_decline_deal_desk_request(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may decline a Deal Desk request.'; end if;
  update deal_desk_requests set state = 'declined' where id = p_request_id and state = 'pending';
  if not found then raise exception 'Request not found or not pending.'; end if;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'decline_deal_desk_request', 'deal_desk_requests', p_request_id, jsonb_build_object('reason', p_reason));
end $$;

revoke execute on function rpc_decline_deal_desk_request(uuid, text) from public, anon;
grant execute on function rpc_decline_deal_desk_request(uuid, text) to authenticated;
