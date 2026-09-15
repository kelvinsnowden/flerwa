-- TXN-010 / OPS-002: "No admin general-purpose transaction repair tool" —
-- rpc_resolve_dispute and rpc_convert_deal_desk_request were the only two
-- sanctioned "fix a stuck/wrong transaction" paths; anything else had no
-- audited admin route at all. This adds the register's own named examples:
--   1. A wrong amount before funding      -> rpc_admin_correct_transaction_amount
--   2. A mis-assigned provider            -> rpc_admin_reassign_provider
--   3. A stuck mid-flight job, no dispute -> rpc_admin_force_resolve_stuck_transaction
--
-- Risk-tiered on purpose: (1) and (2) touch a transaction before any money
-- has moved (or, for reassignment, before the provider has done any
-- physical work) — single is_admin(), same tier as
-- rpc_admin_set_provider_published / rpc_set_category_clearance. (3) moves
-- real money with no dispute record to anchor it, so it goes through the
-- same dual-control propose/decide mechanism as a real dispute resolution
-- (GOV-P4) — a single admin cannot execute it alone.

-- ---------------------------------------------------------------------
-- 1. Correct a transaction's amount before funding. Fee recompute reuses
-- the exact same _resolve_fee_pcts call rpc_book_service/rpc_accept_quote
-- use, so a corrected amount gets a correctly-resolved fee, not a stale
-- one. Any milestone rows (created at booking time, before this fix) are
-- regenerated against the new amount — safe because funded_at is null is
-- a hard precondition, so nothing has released yet.
-- ---------------------------------------------------------------------
create or replace function rpc_admin_correct_transaction_amount(
  p_transaction_id uuid, p_new_service_amount_minor bigint, p_new_materials_amount_minor bigint, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_customer_fee_pct numeric;
  v_provider_fee_pct numeric;
  v_new_fee bigint;
  v_new_provider_fee bigint;
begin
  if not is_admin() then raise exception 'Only an admin may correct a transaction amount.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required.'; end if;
  if p_new_service_amount_minor < 0 or p_new_materials_amount_minor < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;

  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.funded_at is not null then
    raise exception 'Cannot correct the amount after funding. Use the milestone, cancellation, or dispute paths instead — the amount is locked once money has moved.';
  end if;

  select o_customer_fee_pct, o_provider_fee_pct into v_customer_fee_pct, v_provider_fee_pct
  from _resolve_fee_pcts(v_txn.category_id, v_txn.origin, v_txn.customer_id, v_txn.provider_id);
  v_new_fee := round(p_new_service_amount_minor * v_customer_fee_pct / 100);
  v_new_provider_fee := round(p_new_service_amount_minor * v_provider_fee_pct / 100);

  update service_transactions
    set service_amount_minor = p_new_service_amount_minor,
        materials_amount_minor = p_new_materials_amount_minor,
        platform_fee_minor = v_new_fee,
        provider_fee_minor = v_new_provider_fee,
        updated_at = now()
    where id = p_transaction_id;

  delete from transaction_milestones where transaction_id = p_transaction_id;
  perform _create_transaction_milestones_if_qualifying(p_transaction_id);

  perform log_event(p_transaction_id, 'admin_corrected_amount', v_txn.state, v_txn.state,
    jsonb_build_object(
      'old_service_amount_minor', v_txn.service_amount_minor, 'new_service_amount_minor', p_new_service_amount_minor,
      'old_materials_amount_minor', v_txn.materials_amount_minor, 'new_materials_amount_minor', p_new_materials_amount_minor,
      'reason', p_reason));

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'correct_transaction_amount', 'service_transactions', p_transaction_id,
          jsonb_build_object('old_service_amount_minor', v_txn.service_amount_minor,
                              'new_service_amount_minor', p_new_service_amount_minor, 'reason', p_reason));
end $$;

revoke all on function rpc_admin_correct_transaction_amount(uuid, bigint, bigint, text) from public, anon;
grant execute on function rpc_admin_correct_transaction_amount(uuid, bigint, bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Reassign a mis-assigned provider. Allowed only before the job is
-- physically underway (through en_route) — reassigning after check-in
-- would strand any already-released milestone money with the wrong
-- provider, a materially bigger problem than this tool is meant to solve.
-- New provider must be cleared for the category, same check
-- rpc_book_service itself enforces. Known simplification, stated rather
-- than silently ignored: fees are NOT recomputed on reassignment (a
-- repeat-pair fee tier is resolved per customer+provider pair, so it can
-- differ for the new provider) — use rpc_admin_correct_transaction_amount
-- afterward if that matters for a specific case.
-- ---------------------------------------------------------------------
create or replace function rpc_admin_reassign_provider(
  p_transaction_id uuid, p_new_provider_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_old_provider_user_id uuid;
  v_new_provider_user_id uuid;
begin
  if not is_admin() then raise exception 'Only an admin may reassign a provider.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required.'; end if;

  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state not in ('requested', 'quoted', 'quote_accepted', 'funded', 'scheduled', 'en_route') then
    raise exception 'Cannot reassign the provider from state % — the job is already underway or closed.', v_txn.state;
  end if;

  if v_txn.category_id is not null and not exists (
    select 1 from provider_categories pc
    where pc.provider_id = p_new_provider_id and pc.category_id = v_txn.category_id and pc.is_cleared
  ) then
    raise exception 'The new provider is not cleared for this category.';
  end if;

  select user_id into v_new_provider_user_id from providers where id = p_new_provider_id;
  if v_new_provider_user_id is null then raise exception 'New provider not found.'; end if;
  select user_id into v_old_provider_user_id from providers where id = v_txn.provider_id;

  update service_transactions set provider_id = p_new_provider_id, updated_at = now() where id = p_transaction_id;

  perform log_event(p_transaction_id, 'admin_reassigned_provider', v_txn.state, v_txn.state,
    jsonb_build_object('old_provider_id', v_txn.provider_id, 'new_provider_id', p_new_provider_id, 'reason', p_reason));

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'reassign_provider', 'service_transactions', p_transaction_id,
          jsonb_build_object('old_provider_id', v_txn.provider_id, 'new_provider_id', p_new_provider_id, 'reason', p_reason));

  if v_old_provider_user_id is not null then
    insert into notifications (user_id, type, title, body, transaction_id)
    values (v_old_provider_user_id, 'booking_reassigned', 'Booking reassigned',
            'This booking has been reassigned to another professional by our team.', p_transaction_id);
  end if;
  insert into notifications (user_id, type, title, body, transaction_id)
  values (v_new_provider_user_id, 'booking_reassigned', 'New booking assigned to you',
          'Our team has assigned you to a booking.', p_transaction_id);
end $$;

revoke all on function rpc_admin_reassign_provider(uuid, uuid, text) from public, anon;
grant execute on function rpc_admin_reassign_provider(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- BUG FIX, found while building (3): _execute_refund (dispute
-- resolution) has never reversed materials_held — it only ever debited
-- funds_held (service + platform fee). Any disputed transaction with
-- materials_amount_minor > 0 leaves that money permanently stuck in
-- materials_held with no reversing entry: neither refunded to the
-- customer nor paid to the provider. `rpc_resolve_dispute`'s signature
-- has no materials parameter, so there's no way for an admin to direct
-- it — the only safe default is the same one rpc_cancel_booking already
-- established: the customer never received the materials, so they are
-- always refunded in full, independent of the labour split. Also
-- accounts for the 'materials' milestone possibly having already
-- released (at check-in) before the dispute was opened, the same
-- already-released reasoning already applied to scope_agreement.
-- ---------------------------------------------------------------------
create or replace function _execute_refund(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dispute_id uuid := (p->>'dispute_id')::uuid;
  v_provider_minor bigint := (p->>'provider_minor')::bigint;
  v_customer_refund_minor bigint := (p->>'customer_refund_minor')::bigint;
  v_resolution text := p->>'resolution';
  v_dispute disputes%rowtype;
  v_txn service_transactions%rowtype;
  v_provider_user_id uuid;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
  v_already_released bigint := 0;
  v_release_amount bigint;
  v_already_released_materials bigint := 0;
  v_held_materials bigint;
begin
  select * into v_dispute from disputes where id = v_dispute_id for update;
  if not found then raise exception 'Dispute not found.'; end if;
  if v_dispute.state = 'resolved' then raise exception 'Dispute is already resolved.'; end if;

  select * into v_txn from service_transactions where id = v_dispute.transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state <> 'disputed' then
    raise exception 'Transaction is in state % — only a disputed transaction can be resolved this way.', v_txn.state;
  end if;

  if v_provider_minor < 0 or v_customer_refund_minor < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;

  select amount_minor into v_already_released from transaction_milestones
    where transaction_id = v_txn.id and kind = 'scope_agreement' and state = 'released';
  v_already_released := coalesce(v_already_released, 0);
  v_release_amount := v_txn.service_amount_minor - v_already_released;

  if v_provider_minor + v_customer_refund_minor <> v_release_amount then
    raise exception 'Provider amount + customer refund (%) must equal the amount still held (%).',
      v_provider_minor + v_customer_refund_minor, v_release_amount;
  end if;

  select amount_minor into v_already_released_materials from transaction_milestones
    where transaction_id = v_txn.id and kind = 'materials' and state = 'released';
  v_already_released_materials := coalesce(v_already_released_materials, 0);
  v_held_materials := v_txn.materials_amount_minor - v_already_released_materials;

  select user_id into v_provider_user_id from providers where id = v_txn.provider_id;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, v_txn.id, 'funds_held', null, 'debit', v_release_amount + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, v_txn.id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor, v_txn.currency);

  if v_provider_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'provider_payable', v_provider_user_id, 'credit', v_provider_minor, v_txn.currency);
  end if;
  if v_customer_refund_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'refunds', v_txn.customer_id, 'credit', v_customer_refund_minor, v_txn.currency);
  end if;
  if v_held_materials > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values
      (v_group, v_txn.id, 'materials_held', null, 'debit', v_held_materials, v_txn.currency),
      (v_group, v_txn.id, 'refunds', v_txn.customer_id, 'credit', v_held_materials, v_txn.currency);
  end if;

  update transaction_milestones set state = 'released', released_at = now()
    where transaction_id = v_txn.id and kind = 'balance' and state = 'pending';

  update disputes
    set state = 'resolved', resolution = v_resolution,
        financial_outcome = jsonb_build_object('provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor),
        resolved_by = auth.uid(), resolved_at = now()
    where id = v_dispute_id;

  v_new_state := case when v_customer_refund_minor = v_release_amount then 'refunded' else 'settled' end;

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = v_new_state,
        settled_at = case when v_new_state = 'settled' then now() else settled_at end,
        updated_at = now()
    where id = v_txn.id;

  perform log_event(v_txn.id, 'dispute_resolved', 'disputed', v_new_state,
    jsonb_build_object('dispute_id', v_dispute_id, 'provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor));

  perform recompute_reliability(v_txn.provider_id);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'resolve_dispute', 'disputes', v_dispute_id,
          jsonb_build_object('resolution', v_resolution, 'provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor));

  insert into notifications (user_id, type, title, body, transaction_id)
  values
    (v_txn.customer_id, 'dispute_resolved', 'Your dispute has been resolved', v_resolution, v_txn.id),
    (v_provider_user_id, 'dispute_resolved', 'A dispute has been resolved', v_resolution, v_txn.id);
end $$;

revoke all on function _execute_refund(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Force-resolve a transaction stuck mid-flight with no open dispute
-- (e.g. a provider checked in and went silent, never submitted evidence).
-- Structurally the same as _execute_refund — same split rule (provider +
-- refund must equal the service amount still held), same materials
-- handling, same platform-fee-always-collected convention — just keyed
-- on the transaction directly instead of requiring a disputes row, and
-- reachable from the wider set of "stuck" states a dispute wouldn't
-- otherwise be opened from. Money-moving with no dispute to anchor it,
-- so this is dual-control (GOV-P4), not a single is_admin() action.
-- ---------------------------------------------------------------------
create or replace function _execute_force_resolve_stuck_transaction(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_transaction_id uuid := (p->>'transaction_id')::uuid;
  v_provider_minor bigint := (p->>'provider_minor')::bigint;
  v_customer_refund_minor bigint := (p->>'customer_refund_minor')::bigint;
  v_resolution text := p->>'resolution';
  v_txn service_transactions%rowtype;
  v_provider_user_id uuid;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
  v_already_released_service bigint := 0;
  v_release_amount bigint;
  v_already_released_materials bigint := 0;
  v_held_materials bigint;
begin
  select * into v_txn from service_transactions where id = v_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state not in ('checked_in', 'in_progress', 'evidence_submitted', 'customer_review', 'revision_requested') then
    raise exception 'Transaction is in state % — force-resolution is only for a job stuck mid-flight; use the normal approve/dispute/cancel paths otherwise.', v_txn.state;
  end if;
  if v_provider_minor < 0 or v_customer_refund_minor < 0 then raise exception 'Amounts cannot be negative.'; end if;

  select amount_minor into v_already_released_service from transaction_milestones
    where transaction_id = v_transaction_id and kind = 'scope_agreement' and state = 'released';
  v_already_released_service := coalesce(v_already_released_service, 0);
  v_release_amount := v_txn.service_amount_minor - v_already_released_service;

  if v_provider_minor + v_customer_refund_minor <> v_release_amount then
    raise exception 'Provider amount + customer refund (%) must equal the service amount still held (%).',
      v_provider_minor + v_customer_refund_minor, v_release_amount;
  end if;

  select amount_minor into v_already_released_materials from transaction_milestones
    where transaction_id = v_transaction_id and kind = 'materials' and state = 'released';
  v_already_released_materials := coalesce(v_already_released_materials, 0);
  v_held_materials := v_txn.materials_amount_minor - v_already_released_materials;

  select user_id into v_provider_user_id from providers where id = v_txn.provider_id;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, v_txn.id, 'funds_held', null, 'debit', v_release_amount + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, v_txn.id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor, v_txn.currency);

  if v_provider_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'provider_payable', v_provider_user_id, 'credit', v_provider_minor, v_txn.currency);
  end if;
  if v_customer_refund_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'refunds', v_txn.customer_id, 'credit', v_customer_refund_minor, v_txn.currency);
  end if;
  if v_held_materials > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values
      (v_group, v_txn.id, 'materials_held', null, 'debit', v_held_materials, v_txn.currency),
      (v_group, v_txn.id, 'refunds', v_txn.customer_id, 'credit', v_held_materials, v_txn.currency);
  end if;

  update transaction_milestones set state = 'released', released_at = now()
    where transaction_id = v_transaction_id and kind = 'balance' and state = 'pending';

  v_new_state := case when v_customer_refund_minor = v_release_amount then 'refunded' else 'settled' end;

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = v_new_state,
        settled_at = case when v_new_state = 'settled' then now() else settled_at end,
        closed_at = now(),
        updated_at = now()
    where id = v_transaction_id;

  perform log_event(v_transaction_id, 'admin_force_resolved', v_txn.state, v_new_state,
    jsonb_build_object('provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor, 'resolution', v_resolution));

  perform recompute_reliability(v_txn.provider_id);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'force_resolve_stuck_transaction', 'service_transactions', v_transaction_id,
          jsonb_build_object('provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor, 'resolution', v_resolution));

  insert into notifications (user_id, type, title, body, transaction_id)
  values
    (v_txn.customer_id, 'transaction_force_resolved', 'This booking was resolved by our team', v_resolution, v_transaction_id),
    (v_provider_user_id, 'transaction_force_resolved', 'This booking was resolved by our team', v_resolution, v_transaction_id);
end $$;

revoke all on function _execute_force_resolve_stuck_transaction(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Wire the new action type into can_act_on_approval and the decide
-- dispatcher, and add the public proposing RPC.
-- ---------------------------------------------------------------------
create or replace function can_act_on_approval(p_action_type approval_action_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_action_type
    when 'refund' then is_trust_safety_admin() or is_finance_admin()
    when 'suspend_customer' then is_trust_safety_admin()
    when 'suspend_provider' then is_trust_safety_admin()
    when 'category_pause' then is_ops_admin() or is_trust_safety_admin()
    when 'confirm_manual_payment' then is_finance_admin()
    when 'force_resolve_stuck_transaction' then is_trust_safety_admin() or is_finance_admin()
  end;
$$;

create or replace function rpc_decide_admin_action(p_approval_id uuid, p_decision text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row pending_admin_approvals%rowtype;
begin
  if p_decision not in ('approve', 'reject') then raise exception 'Invalid decision %.', p_decision; end if;

  select * into v_row from pending_admin_approvals where id = p_approval_id for update;
  if not found then raise exception 'Approval request not found.'; end if;
  if v_row.status <> 'pending' then raise exception 'This request has already been decided.'; end if;
  if not can_act_on_approval(v_row.action_type) then
    raise exception 'You do not have permission to decide a % action.', v_row.action_type;
  end if;
  if v_row.proposed_by = auth.uid() then
    raise exception 'A different admin must approve or reject this — you cannot decide your own proposal.';
  end if;

  if p_decision = 'reject' then
    update pending_admin_approvals set status = 'rejected', decided_by = auth.uid(), decided_at = now()
      where id = p_approval_id;
  else
    update pending_admin_approvals set status = 'approved', decided_by = auth.uid(), decided_at = now()
      where id = p_approval_id;

    begin
      case v_row.action_type
        when 'refund' then perform _execute_refund(v_row.payload);
        when 'suspend_customer' then perform _execute_suspend_customer(v_row.payload);
        when 'suspend_provider' then perform _execute_suspend_provider(v_row.payload);
        when 'category_pause' then perform _execute_category_pause(v_row.payload);
        when 'confirm_manual_payment' then perform _execute_confirm_manual_payment(v_row.payload);
        when 'force_resolve_stuck_transaction' then perform _execute_force_resolve_stuck_transaction(v_row.payload);
      end case;
      update pending_admin_approvals set status = 'executed' where id = p_approval_id;
    exception when others then
      update pending_admin_approvals set status = 'execution_failed', error = sqlerrm where id = p_approval_id;
      raise;
    end;
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'decide_admin_action', 'pending_admin_approvals', p_approval_id,
          jsonb_build_object('decision', p_decision, 'action_type', v_row.action_type));
end $$;

create or replace function rpc_admin_force_resolve_stuck_transaction(
  p_transaction_id uuid, p_provider_minor bigint, p_customer_refund_minor bigint, p_resolution text
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not can_act_on_approval('force_resolve_stuck_transaction') then
    raise exception 'Only a trust & safety or finance admin may force-resolve a stuck transaction.';
  end if;
  if p_resolution is null or btrim(p_resolution) = '' then raise exception 'A resolution note is required.'; end if;

  return rpc_propose_admin_action('force_resolve_stuck_transaction',
    jsonb_build_object('transaction_id', p_transaction_id, 'provider_minor', p_provider_minor,
                        'customer_refund_minor', p_customer_refund_minor, 'resolution', p_resolution),
    p_resolution);
end $$;

revoke all on function rpc_admin_force_resolve_stuck_transaction(uuid, bigint, bigint, text) from public, anon;
grant execute on function rpc_admin_force_resolve_stuck_transaction(uuid, bigint, bigint, text) to authenticated;
