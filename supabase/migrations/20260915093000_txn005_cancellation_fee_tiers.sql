-- TXN-005: docs/07-payments.md's cancellation-fee table has no
-- corresponding logic in rpc_cancel_booking — confirmed in this
-- register's own investigation: cancellation before check-in is always
-- a flat 100% refund regardless of timing, and cancellation from
-- checked_in onward is hard-blocked entirely (the "provider is
-- compensated after check-in" case was unreachable — refused outright,
-- never resolved with a payout).
--
-- docs/07's table:
--   >24h before scheduled   -> full refund
--   <24h before scheduled   -> 50% to provider (travel/lost-slot cost)
--   after provider checked in -> 100% to provider
--
-- This migration: (1) adds the 24h timing tier using scheduled_for (a
-- booking with no fixed scheduled_for — nothing to violate — is treated
-- as the >24h case); (2) opens cancellation up through 'checked_in' and
-- 'in_progress' (previously blocked) with 100% provider compensation,
-- closing the "unreachable" gap; cancellation is still refused from
-- 'evidence_submitted' onward — at that point the job is essentially
-- done and the existing approve/revise/dispute flow is the right path,
-- not "I changed my mind."
--
-- Milestone correctness: opening cancellation up to checked_in/in_progress
-- means BOTH the scope_agreement (released at funding) and materials
-- (released at check-in) milestone stages may already be paid out by the
-- time of cancel — both are now excluded from the funds_held/materials_held
-- reversal, the same "reverse only what's still actually held" principle
-- already applied to scope_agreement alone in the prior migration.
create or replace function rpc_cancel_booking(p_transaction_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
  v_already_released_service bigint := 0;
  v_already_released_materials bigint := 0;
  v_held_service_and_fee bigint;
  v_held_materials bigint;
  v_provider_pct int := 0;
  v_provider_minor bigint := 0;
  v_customer_refund_minor bigint := 0;
  v_provider_user_id uuid;
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found or v_txn.customer_id <> auth.uid() then raise exception 'Not authorized.'; end if;

  if v_txn.state not in (
    'requested', 'quoted', 'quote_accepted', 'funded', 'scheduled', 'en_route', 'checked_in', 'in_progress'
  ) then
    raise exception 'Cannot cancel from state % — the job has moved past active work.', v_txn.state;
  end if;

  if v_txn.funded_at is null then
    v_new_state := 'cancelled_by_customer';
  else
    if v_txn.state in ('checked_in', 'in_progress') then
      v_provider_pct := 100;
    elsif v_txn.scheduled_for is not null and v_txn.scheduled_for - now() < interval '24 hours' then
      v_provider_pct := 50;
    else
      v_provider_pct := 0;
    end if;

    select user_id into v_provider_user_id from providers where id = v_txn.provider_id;
    if v_provider_user_id is null then v_provider_pct := 0; end if;

    select amount_minor into v_already_released_service from transaction_milestones
      where transaction_id = p_transaction_id and kind = 'scope_agreement' and state = 'released';
    v_already_released_service := coalesce(v_already_released_service, 0);

    select amount_minor into v_already_released_materials from transaction_milestones
      where transaction_id = p_transaction_id and kind = 'materials' and state = 'released';
    v_already_released_materials := coalesce(v_already_released_materials, 0);

    v_held_service_and_fee := (v_txn.service_amount_minor + v_txn.platform_fee_minor) - v_already_released_service;
    v_held_materials := v_txn.materials_amount_minor - v_already_released_materials;

    v_provider_minor := round(v_held_service_and_fee * v_provider_pct / 100.0);
    v_customer_refund_minor := v_held_service_and_fee - v_provider_minor;

    v_new_state := case when v_provider_minor = 0 then 'refunded' else 'settled' end;

    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values
      (v_group, p_transaction_id, 'funds_held', null, 'debit', v_held_service_and_fee, v_txn.currency),
      (v_group, p_transaction_id, 'materials_held', null, 'debit', v_held_materials, v_txn.currency),
      (v_group, p_transaction_id, 'refunds', v_txn.customer_id, 'credit', v_customer_refund_minor + v_held_materials, v_txn.currency);

    if v_provider_minor > 0 then
      insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
      values (v_group, p_transaction_id, 'provider_payable', v_provider_user_id, 'credit', v_provider_minor, v_txn.currency);
    end if;

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
    jsonb_build_object('reason', p_reason, 'provider_compensation_pct', v_provider_pct, 'provider_minor', v_provider_minor));

  if v_txn.provider_id is not null then
    insert into notifications (user_id, type, title, body, transaction_id)
    select user_id, 'booking_cancelled',
      case when v_provider_minor > 0 then 'Booking cancelled — you were compensated' else 'Booking cancelled' end,
      'The customer cancelled this booking' ||
        case when v_provider_minor > 0 then ' (you keep ' || v_provider_pct || '% per the cancellation policy)' else '' end ||
        case when p_reason is not null and p_reason <> '' then ': ' || p_reason else '.' end,
      p_transaction_id
    from providers where id = v_txn.provider_id;
  end if;
end $$;
