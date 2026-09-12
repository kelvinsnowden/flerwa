-- Extracts the funding logic rpc_confirm_manual_payment already had into a
-- shared internal helper, then adds the provider-agnostic ingestion path
-- alongside it. Both the human admin path (rpc_confirm_manual_payment) and
-- the automated webhook path (rpc_ingest_payment_event) now go through the
-- exact same invariants — same ledger entries, same guarded state
-- transition, same escrow-expiry clock. Nothing about the existing manual
-- flow changes behaviourally; this is a refactor plus an addition.

create or replace function _fund_transaction(
  p_transaction_id uuid,
  p_provider_key text,
  p_external_reference text,
  p_confirmed_by uuid,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn service_transactions%rowtype;
  v_payment_id uuid;
  v_group uuid := gen_random_uuid();
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state not in ('requested','quote_accepted') then
    raise exception 'Transaction is in state % and cannot be funded.', v_txn.state;
  end if;

  insert into payments (transaction_id, provider_key, state, amount_minor, currency,
                         external_reference, confirmed_by, confirmed_at, notes)
  values (p_transaction_id, p_provider_key, 'funded', v_txn.total_amount_minor, v_txn.currency,
          p_external_reference, p_confirmed_by, now(), p_notes)
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
    jsonb_build_object('payment_id', v_payment_id, 'provider_key', p_provider_key, 'external_reference', p_external_reference));

  return v_payment_id;
end $$;

-- Thin wrapper preserving the exact original signature and admin check.
create or replace function rpc_confirm_manual_payment(
  p_transaction_id uuid,
  p_external_reference text,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an admin can confirm a manual payment.'; end if;
  return _fund_transaction(p_transaction_id, 'manual', p_external_reference, auth.uid(), p_notes);
end $$;

-- Service-role-only ingestion path for an automated payment provider's
-- webhook. Always records the event first (matched or not) so nothing is
-- silently dropped, then funds the transaction only if every guard passes:
-- the provider is currently the active one, the transaction still exists
-- and is fundable, and the amount matches what's actually owed. Anything
-- that fails a guard is recorded with processing_error for an admin to
-- reconcile by hand — see /admin/payments.
create or replace function rpc_ingest_payment_event(
  p_provider_key text,
  p_event_type text,
  p_transaction_id uuid,
  p_external_reference text,
  p_amount_minor bigint,
  p_currency char(3),
  p_signature_verified boolean,
  p_raw_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_txn service_transactions%rowtype;
  v_error text := null;
  v_provider_active boolean;
begin
  select is_active into v_provider_active from payment_providers where key = p_provider_key;

  if not p_signature_verified then
    v_error := 'Webhook signature did not verify.';
  elsif v_provider_active is not true then
    v_error := format('Provider %s is not the currently active payment provider.', p_provider_key);
  elsif p_event_type <> 'collection.completed' then
    v_error := null; -- non-funding events (failures, refund notices, etc.) are recorded but not acted on here
  else
    select * into v_txn from service_transactions where id = p_transaction_id for update;
    if not found then
      v_error := 'Transaction not found.';
    elsif v_txn.state not in ('requested','quote_accepted') then
      v_error := format('Transaction is in state %s and cannot be funded.', v_txn.state);
    elsif p_amount_minor is distinct from v_txn.total_amount_minor then
      v_error := format('Amount mismatch: webhook reported %s, transaction total is %s.', p_amount_minor, v_txn.total_amount_minor);
    elsif p_currency is distinct from v_txn.currency then
      v_error := format('Currency mismatch: webhook reported %s, transaction currency is %s.', p_currency, v_txn.currency);
    end if;
  end if;

  insert into payment_provider_events (provider_key, transaction_id, event_type, external_reference,
                                        amount_minor, currency, signature_verified, raw_payload,
                                        processed, processing_error)
  values (p_provider_key, p_transaction_id, p_event_type, p_external_reference,
          p_amount_minor, p_currency, p_signature_verified, p_raw_payload,
          v_error is null, v_error)
  returning id into v_event_id;

  if v_error is null and p_event_type = 'collection.completed' then
    perform _fund_transaction(p_transaction_id, p_provider_key, p_external_reference, null,
      format('Auto-confirmed via %s webhook.', p_provider_key));
  end if;

  return v_event_id;
end $$;

-- Records a KYC/identity check result. Deliberately does NOT change
-- verification_status itself, even on a clean pass — see
-- docs/06-trust-architecture.md: "verified" is a claim to a customer, and
-- this project's existing rule is that only an admin, through
-- rpc_set_verification_status, makes that claim. This just gets the
-- vendor's result in front of the admin reviewing the queue, replacing
-- "trust the internal check" with "surface it, let a human confirm."
create or replace function rpc_record_identity_check(
  p_provider_key text,
  p_provider_id uuid,
  p_check_type text,
  p_external_reference text,
  p_status text,
  p_raw_result jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check_id uuid;
begin
  insert into identity_verification_checks (provider_key, provider_id, check_type, external_reference, status, raw_result)
  values (p_provider_key, p_provider_id, p_check_type, p_external_reference, p_status, p_raw_result)
  returning id into v_check_id;
  return v_check_id;
end $$;

-- Admin-gated: flips which payment/verification provider is authoritative.
-- A dashboard action, not a deploy — the whole point of the registry.
create or replace function rpc_set_active_payment_provider(p_key text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an admin can change the active payment provider.'; end if;
  if not exists (select 1 from payment_providers where key = p_key) then
    raise exception 'Unknown payment provider %.', p_key;
  end if;
  update payment_providers set is_active = false where is_active;
  update payment_providers set is_active = true, connected_by = auth.uid(), connected_at = now() where key = p_key;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_active_payment_provider', 'payment_providers', null, jsonb_build_object('key', p_key));
end $$;

create or replace function rpc_set_active_verification_provider(p_key text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an admin can change the active verification provider.'; end if;
  if not exists (select 1 from verification_providers where key = p_key) then
    raise exception 'Unknown verification provider %.', p_key;
  end if;
  update verification_providers set is_active = false where is_active;
  update verification_providers set is_active = true, connected_by = auth.uid(), connected_at = now() where key = p_key;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_active_verification_provider', 'verification_providers', null, jsonb_build_object('key', p_key));
end $$;

-- Grant surface: match intent exactly, same discipline as SECURITY.md §8.
-- rpc_confirm_manual_payment, rpc_set_active_*: signed-in only, self-checks is_admin() internally.
revoke all on function _fund_transaction(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function rpc_confirm_manual_payment(uuid, text, text) from public, anon;
grant execute on function rpc_confirm_manual_payment(uuid, text, text) to authenticated;
revoke all on function rpc_set_active_payment_provider(text) from public, anon;
grant execute on function rpc_set_active_payment_provider(text) to authenticated;
revoke all on function rpc_set_active_verification_provider(text) from public, anon;
grant execute on function rpc_set_active_verification_provider(text) to authenticated;

-- rpc_ingest_payment_event and rpc_record_identity_check are called ONLY
-- from trusted server code (webhook route handlers) using the service-role
-- client, never from a browser session — anon and authenticated get no
-- grant at all, matching the "purely internal" class in SECURITY.md §8.
revoke all on function rpc_ingest_payment_event(text, text, uuid, text, bigint, char, boolean, jsonb) from public, anon, authenticated;
revoke all on function rpc_record_identity_check(text, uuid, text, text, text, jsonb) from public, anon, authenticated;
