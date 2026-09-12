-- Phase 4/5.1 (MARKETPLACE_SCALE_READINESS_AUDIT.md /
-- MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md): real payment-provider
-- webhooks retry on a slow/timeout response (this is normal vendor
-- behavior, not an edge case) — IntaSend and similar aggregators resend
-- the identical delivery (same invoice_id / external_reference, same
-- event_type/state) until they get a fast 200 back. Before this,
-- rpc_ingest_payment_event recorded a brand new payment_provider_events
-- row for every retry, with no way to tell "this happened twice" from
-- "this happened again, differently."
--
-- Double-FUNDING was never actually possible here — _fund_transaction's
-- own `select ... for update` plus the state guard already made a retry
-- arriving after the transaction was funded a safe no-op (it just records
-- an event with a processing_error). This migration makes the *event
-- log itself* idempotent too, on top of that existing guard, not instead
-- of it.
--
-- Deliberately keyed on (provider_key, external_reference, event_type),
-- NOT just (provider_key, external_reference): the same invoice_id/
-- external_reference legitimately carries multiple DIFFERENT event_types
-- over one payment's lifecycle (e.g. a pending/other state followed
-- later by collection.completed) — confirmed by reading
-- src/lib/payments/adapters/intasend.ts, where invoice_id identifies one
-- collection attempt, not one webhook delivery. Deduping on the 2-column
-- key would have silently swallowed a real state-transition event, which
-- rule 11 (don't silently change business rules) rules out. The partial
-- index excludes empty/null external_reference so unparseable payloads
-- (which fall back to "") are still recorded individually, unchanged.

create unique index payment_provider_events_dedupe_idx
  on payment_provider_events (provider_key, external_reference, event_type)
  where external_reference is not null and external_reference <> '';

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
  on conflict (provider_key, external_reference, event_type)
    where external_reference is not null and external_reference <> ''
    do nothing
  returning id into v_event_id;

  if v_event_id is null then
    -- Exact (provider_key, external_reference, event_type) already recorded
    -- — a vendor retry of a delivery we've already processed. Idempotent
    -- no-op: return the original event's id, never re-attempt funding.
    select id into v_event_id from payment_provider_events
      where provider_key = p_provider_key
        and external_reference = p_external_reference
        and event_type = p_event_type
      order by created_at desc
      limit 1;
    return v_event_id;
  end if;

  if v_error is null and p_event_type = 'collection.completed' then
    perform _fund_transaction(p_transaction_id, p_provider_key, p_external_reference, null,
      format('Auto-confirmed via %s webhook.', p_provider_key));
  end if;

  return v_event_id;
end $$;
