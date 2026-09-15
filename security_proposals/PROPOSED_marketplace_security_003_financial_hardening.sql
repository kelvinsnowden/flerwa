-- =====================================================================
-- MARKETPLACE-SECURITY-003 — PROPOSED, NOT APPLIED.
-- This file has NOT been run against the live database. It supersedes
-- security_proposals/PROPOSED_marketplace_security_002_provider_eligibility.sql
-- (that file's contents are fully included/extended here — apply THIS
-- file, not that one, once authorized). Do not apply without explicit
-- authorization. Once authorized, apply via the Supabase migration tool
-- and move this file into supabase/migrations/ with a normal
-- timestamped name.
--
-- Every fact this file's comments assert was live-verified via
-- role-simulated, rolled-back SQL during this pass — see
-- SECURITY_READINESS_REGISTER.md for the full findings and evidence.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FIX 1 (SEC-P0-001, primary defense): revoke the grant that made the
-- direct-insert bypass possible at all. Confirmed live: no code
-- anywhere in this repository ever calls
-- `.from("service_transactions").insert(...)` or
-- `.from("quotes").insert(...)` — every legitimate transaction/quote is
-- created by a SECURITY DEFINER RPC (rpc_book_service, rpc_submit_quote,
-- rpc_accept_quote, _create_recurring_occurrence,
-- rpc_convert_deal_desk_request), which run as the function owner and
-- are therefore completely unaffected by revoking the CALLING role's
-- own table-level grant. This closes the entire class of bug at its
-- root — a client can no longer even attempt a direct insert, not just
-- have it rejected by an RLS check or a trigger that could itself have
-- a bug.
--
-- UPDATE and DELETE grants are deliberately NOT revoked here — also
-- confirmed live that no app code performs a direct
-- `.from("service_transactions").update(...)` or
-- `.from("quotes").update(...)`/`.delete(...)` either, but the existing
-- "txn admin update" RLS policy (is_admin()-gated) may be an
-- intentional escape hatch for direct administrative correction outside
-- the app UI (e.g. via an admin's own authenticated session against
-- Supabase Studio) that this pass could not fully rule out without a
-- business-process conversation. Revoking INSERT alone closes the
-- confirmed Critical exploit; revoking UPDATE/DELETE too is a larger,
-- separate decision flagged for a follow-up, not bundled in here.
-- ---------------------------------------------------------------------
revoke insert on service_transactions from anon, authenticated;
revoke insert on quotes from anon, authenticated;

-- ---------------------------------------------------------------------
-- FIX 2 (SEC-P0-001, defense-in-depth): extend the financial-write guard
-- to also cover INSERT. Kept even with FIX 1 in place — if the grant is
-- ever mistakenly re-added (a future migration, a manual dashboard
-- change, a Supabase upgrade resetting defaults), this trigger is a
-- second, independent layer that still rejects the exploit.
-- ---------------------------------------------------------------------
create or replace function trg_guard_transaction_financial_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_txn_guard', true), 'off') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.state <> 'draft' then
      raise exception 'A new booking must be created through the app — direct inserts cannot set an initial state.';
    end if;
    if new.service_amount_minor <> 0 or new.materials_amount_minor <> 0 or new.platform_fee_minor <> 0 then
      raise exception 'A new booking must be created through the app — amounts cannot be set directly.';
    end if;
    return new;
  end if;

  if new.state is distinct from old.state
     and new.state in ('funded','released','settled','refunded') then
    raise exception
      'service_transactions.state cannot be set to % directly. Use rpc_confirm_manual_payment or rpc_approve_and_release.',
      new.state;
  end if;

  if old.funded_at is not null and (
       new.service_amount_minor is distinct from old.service_amount_minor
    or new.materials_amount_minor is distinct from old.materials_amount_minor
    or new.platform_fee_minor is distinct from old.platform_fee_minor
  ) then
    raise exception 'Financial amounts cannot be changed on a transaction after it has been funded.';
  end if;

  return new;
end $$;

drop trigger if exists guard_transaction_financial_write on service_transactions;
create trigger guard_transaction_financial_write
  before insert or update on service_transactions
  for each row execute function trg_guard_transaction_financial_write();

-- ---------------------------------------------------------------------
-- FIX 3 (new this pass, Medium severity): service_requests.state and
-- .transaction_id have no protection at all — RLS's "requests customer
-- read/write own" is a blanket `for all` policy for the owning
-- customer, and there is no CHECK constraint on `state` (free text).
-- Live-verified: a customer can `UPDATE service_requests SET
-- state='awarded'` directly on their own request, with no transaction
-- ever created, bypassing rpc_accept_quote entirely. No money moves
-- (this table has no financial columns), but it corrupts the
-- request/quote state machine — the request silently vanishes from
-- "open" listings, blocking legitimate quotes, and could be used to
-- grief providers or confuse admin tooling with no auditable action
-- behind the state change.
-- ---------------------------------------------------------------------
alter table service_requests add constraint service_requests_state_check
  check (state in ('open','quoted','awarded','expired','cancelled'));

create or replace function trg_guard_service_request_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_txn_guard', true), 'off') = 'on' then
    return new;
  end if;
  if new.state is distinct from old.state and new.state = 'awarded' then
    raise exception 'A request can only be marked awarded through accepting a quote.';
  end if;
  if new.transaction_id is distinct from old.transaction_id then
    raise exception 'transaction_id cannot be set directly.';
  end if;
  return new;
end $$;

drop trigger if exists guard_service_request_write on service_requests;
create trigger guard_service_request_write
  before update on service_requests
  for each row execute function trg_guard_service_request_write();

-- ---------------------------------------------------------------------
-- FIX 4 (SEC-P0-002/003, SEC-P1-001): real provider-eligibility checks
-- in rpc_book_service, rpc_submit_quote, rpc_accept_quote — published,
-- verified, accepting work, not suspended, not a test fixture, cleared
-- for the category — each re-checked against the authoritative
-- `providers` row with a `for update` lock to close the TOCTOU window.
-- Generic, non-sensitive rejection message throughout (does not leak
-- which specific condition failed).
-- ---------------------------------------------------------------------
create or replace function rpc_book_service(
  p_service_id uuid,
  p_provider_id uuid,
  p_location_id uuid,
  p_scheduled_for timestamptz,
  p_instructions text,
  p_contact_phone text,
  p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_txn_id uuid;
  v_service services%rowtype;
  v_provider providers%rowtype;
  v_price bigint;
  v_fee bigint;
  v_provider_fee bigint;
  v_customer_fee_pct numeric;
  v_provider_fee_pct numeric;
  v_category_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  if p_idempotency_key is not null then
    select id into v_txn_id from service_transactions
      where customer_id = auth.uid() and idempotency_key = p_idempotency_key;
    if found then
      return v_txn_id;
    end if;
  end if;

  select * into v_service from services where id = p_service_id and is_active;
  if not found then raise exception 'Service not found or inactive.'; end if;
  v_category_id := v_service.category_id;

  if p_provider_id is not null then
    select * into v_provider from providers where id = p_provider_id for update;
    if not found then raise exception 'This professional is not available for booking.'; end if;

    if not (
      v_provider.is_published
      and v_provider.verification_status = 'verified'
      and v_provider.is_accepting_work
      and not v_provider.is_suspended
      and not coalesce(v_provider.is_test_fixture, false)
      and (v_category_id is null or exists (
        select 1 from provider_categories pc
        where pc.provider_id = p_provider_id and pc.category_id = v_category_id and pc.is_cleared
      ))
    ) then
      raise exception 'This professional is not available for booking.';
    end if;
  end if;

  select coalesce(ps.price_minor, v_service.base_price_minor) into v_price
  from provider_services ps
  where ps.provider_id = p_provider_id and ps.service_id = p_service_id and ps.is_active;
  if v_price is null then v_price := v_service.base_price_minor; end if;

  select o_customer_fee_pct, o_provider_fee_pct into v_customer_fee_pct, v_provider_fee_pct
  from _resolve_fee_pcts(v_category_id, 'storefront', auth.uid(), p_provider_id);
  v_fee := round(v_price * v_customer_fee_pct / 100);
  v_provider_fee := round(v_price * v_provider_fee_pct / 100);

  perform set_config('app.bypass_txn_guard', 'on', true);
  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, location_id,
    pricing_model, fulfilment_mode, state, origin,
    currency, service_amount_minor, platform_fee_minor, provider_fee_minor,
    customer_instructions, scheduled_for, contact_phone, idempotency_key
  ) values (
    auth.uid(), p_provider_id, p_service_id, v_category_id, p_location_id,
    v_service.pricing_model, v_service.fulfilment_mode, 'requested', 'storefront',
    v_service.currency, v_price, v_fee, v_provider_fee,
    p_instructions, p_scheduled_for, p_contact_phone, p_idempotency_key
  )
  on conflict (customer_id, idempotency_key) where idempotency_key is not null
    do nothing
  returning id into v_txn_id;

  if v_txn_id is null then
    select id into v_txn_id from service_transactions
      where customer_id = auth.uid() and idempotency_key = p_idempotency_key;
    return v_txn_id;
  end if;

  insert into transaction_scope_items (transaction_id, label, included, sort_order)
  select v_txn_id, label, included, sort_order from service_scope_items where service_id = p_service_id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('service_id', p_service_id, 'provider_id', p_provider_id));

  perform _create_transaction_milestones_if_qualifying(v_txn_id);

  return v_txn_id;
end;
$function$;

create or replace function rpc_submit_quote(p_request_id uuid, p_amount_minor bigint, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_provider providers%rowtype;
  v_request service_requests%rowtype;
  v_quote_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select * into v_provider from providers where user_id = auth.uid() for update;
  if not found then raise exception 'You need a seller profile first.'; end if;

  select * into v_request from service_requests where id = p_request_id for update;
  if not found then raise exception 'Task not found.'; end if;
  if v_request.state <> 'open' then raise exception 'This task is no longer accepting quotes.'; end if;
  if v_request.expires_at <= now() then raise exception 'This task has expired.'; end if;

  if not (
    v_provider.is_published
    and v_provider.verification_status = 'verified'
    and v_provider.is_accepting_work
    and not v_provider.is_suspended
    and not coalesce(v_provider.is_test_fixture, false)
    and exists (
      select 1 from provider_categories pc
      where pc.provider_id = v_provider.id and pc.category_id = v_request.category_id and pc.is_cleared
    )
  ) then
    raise exception 'Your profile is not yet eligible to quote on this category.';
  end if;

  if p_amount_minor <= 0 then raise exception 'Quote amount must be positive.'; end if;

  insert into quotes (request_id, provider_id, amount_minor, message)
  values (p_request_id, v_provider.id, p_amount_minor, p_message)
  returning id into v_quote_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_request.customer_id, 'quote_received', 'New quote on your task',
    v_provider.display_name || ' sent a quote for "' || v_request.title || '"'
  );

  return v_quote_id;
end;
$function$;

create or replace function rpc_accept_quote(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_quote quotes%rowtype;
  v_request service_requests%rowtype;
  v_provider providers%rowtype;
  v_txn_id uuid;
  v_fee bigint;
  v_provider_fee bigint;
  v_customer_fee_pct numeric;
  v_provider_fee_pct numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;

  select * into v_request from service_requests where id = v_quote.request_id for update;
  if not found then raise exception 'Task not found.'; end if;
  if v_request.customer_id <> auth.uid() then raise exception 'Not authorized for this task.'; end if;
  if v_request.state <> 'open' then raise exception 'This task has already been resolved.'; end if;
  if v_quote.state <> 'pending' then raise exception 'This quote is no longer pending.'; end if;

  select * into v_provider from providers where id = v_quote.provider_id for update;
  if not found or not (
    v_provider.is_published
    and v_provider.verification_status = 'verified'
    and v_provider.is_accepting_work
    and not v_provider.is_suspended
    and not coalesce(v_provider.is_test_fixture, false)
    and exists (
      select 1 from provider_categories pc
      where pc.provider_id = v_provider.id and pc.category_id = v_request.category_id and pc.is_cleared
    )
  ) then
    raise exception 'This quote is no longer available — the professional is not currently eligible. Please choose a different quote.';
  end if;

  select o_customer_fee_pct, o_provider_fee_pct into v_customer_fee_pct, v_provider_fee_pct
  from _resolve_fee_pcts(v_request.category_id, 'task', auth.uid(), v_quote.provider_id);
  v_fee := round(v_quote.amount_minor * v_customer_fee_pct / 100);
  v_provider_fee := round(v_quote.amount_minor * v_provider_fee_pct / 100);

  perform set_config('app.bypass_txn_guard', 'on', true);
  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, location_id,
    pricing_model, fulfilment_mode, state, origin,
    currency, service_amount_minor, platform_fee_minor, provider_fee_minor,
    customer_instructions, contact_phone
  ) values (
    auth.uid(), v_quote.provider_id, null, v_request.category_id, v_request.location_id,
    'fixed', v_request.fulfilment_mode, 'requested', 'task',
    'KES', v_quote.amount_minor, v_fee, v_provider_fee,
    v_request.title || ' — ' || v_request.description, v_request.contact_phone
  ) returning id into v_txn_id;

  update quotes set state = 'accepted' where id = p_quote_id;
  update quotes set state = 'declined' where request_id = v_request.id and id <> p_quote_id and state = 'pending';

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_requests set state = 'awarded', transaction_id = v_txn_id where id = v_request.id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('from_task_request', v_request.id, 'quote_id', p_quote_id));

  perform _create_transaction_milestones_if_qualifying(v_txn_id);

  insert into notifications (user_id, type, title, body, transaction_id)
  values (
    v_provider.user_id, 'quote_accepted', 'Your quote was accepted',
    'Your quote for "' || v_request.title || '" was accepted.', v_txn_id
  );

  return v_txn_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- FIX 5: give the two remaining legitimate service_transactions-insert
-- paths the bypass flag — otherwise FIX 2's INSERT guard breaks them
-- outright. Logic otherwise unchanged. No fresh provider-eligibility
-- re-check added here on purpose — see SECURITY_READINESS_REGISTER.md
-- for why recurring occurrences and admin Deal Desk conversions are a
-- distinct product/design question, not copy-pasted.
-- ---------------------------------------------------------------------
create or replace function _create_recurring_occurrence(p_series_id uuid)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_series recurring_series%rowtype;
  v_service services%rowtype;
  v_price bigint;
  v_fee bigint;
  v_provider_fee bigint;
  v_customer_fee_pct numeric;
  v_provider_fee_pct numeric;
  v_txn_id uuid;
begin
  select * into v_series from recurring_series where id = p_series_id;
  if not found then raise exception 'Recurring series not found.'; end if;

  select * into v_service from services where id = v_series.service_id;
  if not found then raise exception 'Service not found.'; end if;

  select coalesce(ps.price_minor, v_service.base_price_minor) into v_price
  from provider_services ps
  where ps.provider_id = v_series.provider_id and ps.service_id = v_series.service_id and ps.is_active;
  if v_price is null then v_price := v_service.base_price_minor; end if;

  select o_customer_fee_pct, o_provider_fee_pct into v_customer_fee_pct, v_provider_fee_pct
  from _resolve_fee_pcts(v_series.category_id, 'recurring', v_series.customer_id, v_series.provider_id);
  v_fee := round(v_price * v_customer_fee_pct / 100);
  v_provider_fee := round(v_price * v_provider_fee_pct / 100);

  perform set_config('app.bypass_txn_guard', 'on', true);
  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, location_id,
    pricing_model, fulfilment_mode, state, origin,
    currency, service_amount_minor, platform_fee_minor, provider_fee_minor,
    customer_instructions, scheduled_for, contact_phone, recurring_series_id
  ) values (
    v_series.customer_id, v_series.provider_id, v_series.service_id, v_series.category_id, v_series.location_id,
    v_service.pricing_model, v_service.fulfilment_mode, 'requested', 'recurring',
    v_service.currency, v_price, v_fee, v_provider_fee,
    v_series.customer_instructions, v_series.next_occurrence_date::timestamptz, v_series.contact_phone, p_series_id
  ) returning id into v_txn_id;

  insert into transaction_scope_items (transaction_id, label, included, sort_order)
  select v_txn_id, label, included, sort_order from service_scope_items where service_id = v_series.service_id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('recurring_series_id', p_series_id));

  perform _create_transaction_milestones_if_qualifying(v_txn_id);

  insert into notifications (user_id, type, title, body, transaction_id)
  values (v_series.customer_id, 'service_created', 'Your next recurring service is ready',
          'Pay to confirm your next occurrence of ' || v_service.name || '.', v_txn_id);

  return v_txn_id;
end;
$function$;

create or replace function rpc_convert_deal_desk_request(p_request_id uuid, p_customer_id uuid, p_category_id uuid, p_fulfilment_mode fulfilment_mode, p_amount_minor bigint)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_req deal_desk_requests%rowtype;
  v_txn_id uuid;
  v_customer_fee_pct numeric;
  v_provider_fee_pct numeric;
  v_fee bigint;
  v_provider_fee bigint;
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

  select o_customer_fee_pct, o_provider_fee_pct into v_customer_fee_pct, v_provider_fee_pct
  from _resolve_fee_pcts(p_category_id, 'deal_desk', p_customer_id, v_req.provider_id);
  v_fee := round(p_amount_minor * v_customer_fee_pct / 100);
  v_provider_fee := round(p_amount_minor * v_provider_fee_pct / 100);

  perform set_config('app.bypass_txn_guard', 'on', true);
  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, fulfilment_mode, state,
    origin, service_amount_minor, platform_fee_minor, provider_fee_minor, customer_instructions,
    contact_phone, requested_at
  ) values (
    p_customer_id, v_req.provider_id, null, p_category_id, p_fulfilment_mode, 'requested',
    'deal_desk', p_amount_minor, v_fee, v_provider_fee, v_req.description,
    v_req.customer_phone, now()
  ) returning id into v_txn_id;

  update deal_desk_requests set state = 'converted', transaction_id = v_txn_id where id = p_request_id;

  perform log_event(v_txn_id, 'deal_desk_converted', 'draft', 'requested',
    jsonb_build_object('deal_desk_request_id', p_request_id));

  perform _create_transaction_milestones_if_qualifying(v_txn_id);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'convert_deal_desk_request', 'deal_desk_requests', p_request_id,
          jsonb_build_object('transaction_id', v_txn_id));

  insert into notifications (user_id, type, title, body, transaction_id)
  values (p_customer_id, 'deal_desk_converted', 'Your booking is set up',
          'Your provider''s arrangement has been converted into a protected booking. We''ll be in touch to confirm payment.',
          v_txn_id);

  return v_txn_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- FIX 6: quotes.state had no CHECK constraint (only a comment
-- documenting the intended 4 values).
-- ---------------------------------------------------------------------
alter table quotes add constraint quotes_state_check
  check (state in ('pending','accepted','declined','expired'));

-- ---------------------------------------------------------------------
-- FIX 7 (Phase 5): durable test-fixture safeguard. A provider marked
-- is_test_fixture=true can NEVER also be is_published=true — enforced
-- as a hard database CHECK constraint, not just an application check,
-- so even a future bug in an admin RPC cannot accidentally publish a
-- test fixture. Combined with FIX 4's eligibility predicate
-- (`not coalesce(is_test_fixture, false)`), a test fixture is excluded
-- from booking/quoting even in the (already-prevented) case where it
-- somehow became verified.
-- ---------------------------------------------------------------------
alter table providers add column is_test_fixture boolean not null default false;
alter table providers add constraint providers_test_fixture_not_published
  check (not (is_test_fixture and is_published));

comment on column providers.is_test_fixture is
  'True for QA/test provider accounts that must never be bookable, quotable, published, or surfaced to real customers, regardless of their other flags. Enforced by providers_test_fixture_not_published (DB-level) and by the eligibility predicate in rpc_book_service/rpc_submit_quote/rpc_accept_quote (RPC-level). Not automatically backfilled by this migration — see the separate, explicitly-flagged data-update statement below for marking existing QA fixtures, which requires its own authorization since it mutates existing rows.';

-- Extend the existing provider trust-field guard to also cover
-- is_test_fixture — same rule as verification_status/is_published/
-- is_suspended: only an admin (or the internal bypass flag) may change
-- it. Live-verified this trigger's existing shape already permits a
-- DIRECT admin UPDATE (no dedicated RPC required, `if is_admin() then
-- return new`) — adding is_test_fixture to the guarded list is enough;
-- no new RPC is introduced by this proposal.
create or replace function trg_guard_provider_trust_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if coalesce(current_setting('app.bypass_provider_trust_guard', true), 'off') = 'on' then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.user_id is distinct from old.user_id
     or new.id is distinct from old.id
     or new.is_published is distinct from old.is_published
     or new.is_suspended is distinct from old.is_suspended
     or new.is_test_fixture is distinct from old.is_test_fixture then
    raise exception 'Verification status, publish state, suspension, and test-fixture flag can only be changed by an admin.';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- OPTIONAL DATA UPDATE — NOT part of the schema migration above, and
-- requires SEPARATE authorization even after the schema change is
-- approved, since it mutates an existing row rather than changing
-- schema/behavior. Left commented out deliberately. The audit
-- recommends marking the known standing QA fixture this way once the
-- column exists:
--
-- update providers set is_test_fixture = true
--   where id = 'aa332618-bf31-4af2-b699-f8bba7b47bdb'; -- "QA Plumbing Pro"
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Grants: re-affirm authenticated-only execution on the three
-- customer/provider-facing RPCs (unchanged from before — anon already
-- confirmed unable to call any of them).
-- ---------------------------------------------------------------------
revoke all on function rpc_book_service(uuid,uuid,uuid,timestamptz,text,text,text) from public, anon;
grant execute on function rpc_book_service(uuid,uuid,uuid,timestamptz,text,text,text) to authenticated;
revoke all on function rpc_submit_quote(uuid,bigint,text) from public, anon;
grant execute on function rpc_submit_quote(uuid,bigint,text) to authenticated;
revoke all on function rpc_accept_quote(uuid) from public, anon;
grant execute on function rpc_accept_quote(uuid) to authenticated;
