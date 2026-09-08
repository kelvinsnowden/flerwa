-- =====================================================================
-- QA finding (CRITICAL): direct-verified via role simulation that an
-- admin session could UPDATE service_transactions.state = 'settled'
-- directly, with ZERO ledger_entries created and no payout ever
-- happening — the UI would show "payment released" for a transaction
-- where no money moved, and provider reliability would never recompute
-- (recompute_reliability() is only called from inside _release_transaction).
-- See QA_REPORT.md "Critical Issues" #1.
--
-- This closes it the same way transaction_events/ledger_entries are
-- already protected: a BEFORE UPDATE trigger that blocks the write,
-- with a narrow, explicit escape hatch that ONLY the sanctioned
-- SECURITY DEFINER functions use (via set_config, session-local so it
-- can never leak into a subsequent unrelated statement).
-- =====================================================================

create or replace function trg_guard_transaction_financial_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_txn_guard', true), 'off') = 'on' then
    return new;
  end if;

  -- Block direct transitions into any money-moving state.
  if new.state is distinct from old.state
     and new.state in ('funded','released','settled','refunded') then
    raise exception
      'service_transactions.state cannot be set to % directly. Use rpc_confirm_manual_payment or rpc_approve_and_release.',
      new.state;
  end if;

  -- Block any change to financial amounts once the transaction has ever
  -- been funded — answers the audit's "can someone modify the price after
  -- booking / modify a completed transaction" checks for ALL callers,
  -- including admin, not just customers (RLS already blocked customers;
  -- this trigger is what blocks admin's otherwise-unrestricted UPDATE policy).
  if old.funded_at is not null and (
       new.service_amount_minor is distinct from old.service_amount_minor
    or new.materials_amount_minor is distinct from old.materials_amount_minor
    or new.platform_fee_minor is distinct from old.platform_fee_minor
  ) then
    raise exception 'Financial amounts cannot be changed on a transaction after it has been funded.';
  end if;

  return new;
end $$;

create trigger guard_transaction_financial_write
  before update on service_transactions
  for each row execute function trg_guard_transaction_financial_write();

-- Give the sanctioned RPCs the escape hatch, set for the current
-- transaction only (`true` = LOCAL) so it can never bleed into another
-- statement or another session.
create or replace function rpc_confirm_manual_payment(
  p_transaction_id uuid, p_external_reference text, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_payment_id uuid;
  v_group uuid := gen_random_uuid();
begin
  if not is_admin() then raise exception 'Only an admin can confirm a manual payment.'; end if;

  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state not in ('requested','quote_accepted') then
    raise exception 'Transaction is in state % and cannot be funded.', v_txn.state;
  end if;

  insert into payments (transaction_id, provider_key, state, amount_minor, currency,
                         external_reference, confirmed_by, confirmed_at, notes)
  values (p_transaction_id, 'manual', 'funded', v_txn.total_amount_minor, v_txn.currency,
          p_external_reference, auth.uid(), now(), p_notes)
  returning id into v_payment_id;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, p_transaction_id, 'customer_receivable', v_txn.customer_id, 'debit',  v_txn.total_amount_minor, v_txn.currency),
    (v_group, p_transaction_id, 'funds_held',          null,              'credit', v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'materials_held',      null,              'credit', v_txn.materials_amount_minor, v_txn.currency);

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = 'funded', funded_at = now(),
        escrow_expires_at = now() + interval '60 days',
        updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'payment_confirmed', v_txn.state, 'funded',
    jsonb_build_object('payment_id', v_payment_id, 'external_reference', p_external_reference));

  return v_payment_id;
end $$;

create or replace function _release_transaction(p_transaction_id uuid, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_group uuid := gen_random_uuid();
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state <> 'evidence_submitted' then
    raise exception 'Cannot approve from state %.', v_txn.state;
  end if;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, p_transaction_id, 'funds_held',       null, 'debit',  v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'provider_payable',
       (select user_id from providers where id = v_txn.provider_id), 'credit', v_txn.service_amount_minor, v_txn.currency),
    (v_group, p_transaction_id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor, v_txn.currency);

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = 'released', approved_at = now(), released_at = now(), updated_at = now()
    where id = p_transaction_id;

  update payments set state = 'released', released_at = now() where transaction_id = p_transaction_id;

  perform log_event(p_transaction_id, 'customer_approved', 'evidence_submitted', 'released',
    jsonb_build_object('auto', p_auto));

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions set state = 'settled', settled_at = now() where id = p_transaction_id;
  perform log_event(p_transaction_id, 'payment_released', 'released', 'settled', '{}'::jsonb);

  perform recompute_reliability(v_txn.provider_id);

  insert into notifications (user_id, type, title, body, transaction_id)
  values ((select user_id from providers where id = v_txn.provider_id), 'payment_released',
          'Payment released', 'Your payment has been released and marked settled.', p_transaction_id);
end $$;

-- =====================================================================
-- QA finding (HIGH): trg_enforce_quote_cap was not SECURITY DEFINER, so
-- its internal `count(*) from quotes` was itself subject to the "quotes
-- provider own read/write" RLS policy from the perspective of whichever
-- provider was inserting — each provider can only see THEIR OWN quotes
-- under that policy, so the count could never reach 5 no matter how many
-- OTHER providers had already quoted. Verified directly: 6 different
-- providers were able to quote on one request with the "cap of 5" never
-- triggering. See QA_REPORT.md "High Issues" #2.
-- =====================================================================

create or replace function trg_enforce_quote_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from quotes where request_id = new.request_id) >= 5 then
    raise exception 'Quote cap reached for this request (max 5).';
  end if;
  return new;
end $$;
revoke execute on function trg_enforce_quote_cap() from anon, authenticated;
