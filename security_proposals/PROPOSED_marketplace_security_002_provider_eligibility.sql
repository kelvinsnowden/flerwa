-- =====================================================================
-- MARKETPLACE-SECURITY-002 — PROPOSED, NOT APPLIED.
-- This file has NOT been run against the live database. It is a review
-- artifact only. Do not apply without explicit authorization. Once
-- authorized, apply via the Supabase migration tool and move this file
-- into supabase/migrations/ with a normal timestamped name.
--
-- Fixes three confirmed, live-verified gaps (verified via role-simulated,
-- rolled-back SQL — nothing was created or persisted):
--
-- 1. CRITICAL: service_transactions had a direct-insert RLS policy
--    ("txn customer create", with check (customer_id = auth.uid())) with
--    NO check on provider_id, state, or financial amounts, and the
--    existing financial-write guard trigger only fired BEFORE UPDATE, not
--    BEFORE INSERT. Any authenticated customer could INSERT a row
--    directly via PostgREST with state='settled' (or 'funded'/'released'/
--    'refunded'), an arbitrary provider_id (including an unverified,
--    unpublished, or suspended provider), and self-chosen financial
--    amounts — completely bypassing rpc_book_service, its fee
--    calculation, and its (already-too-narrow) eligibility check.
--    Live-verified exploitable 2026-09-15.
--
-- 2. rpc_book_service checked only provider_categories.is_cleared for the
--    supplied p_provider_id — not is_published, verification_status,
--    is_accepting_work, or is_suspended. Live-verified: a provider with
--    verification_status='submitted' (never verified) was successfully
--    booked.
--
-- 3. rpc_submit_quote checked only that a provider_categories row EXISTS
--    for the category — not is_cleared, is_published, verification_status,
--    is_accepting_work, or is_suspended. Weaker than rpc_book_service's
--    already-insufficient check. Live-verified: the same unverified
--    provider successfully submitted a quote.
--
-- Fix approach: reuse the existing, proven session-local bypass-flag
-- mechanism (app.bypass_txn_guard) that already gates rpc_confirm_manual_
-- payment and _release_transaction's UPDATEs — extend it to also cover
-- INSERT, and require every legitimate service_transactions-creating
-- function to set it explicitly before its own insert. Add real
-- eligibility checks (published + verified + accepting + not suspended +
-- cleared) to rpc_book_service and rpc_submit_quote, with a row lock on
-- the provider to close the TOCTOU window Phase 3 named explicitly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend the financial-write guard to INSERT.
-- ---------------------------------------------------------------------
create or replace function trg_guard_transaction_financial_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_txn_guard', true), 'off') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A direct (non-bypassed) insert may only create an inert draft row —
    -- no state, no money, no provider commitment. Every real booking path
    -- goes through a SECURITY DEFINER function that sets the bypass flag.
    if new.state <> 'draft' then
      raise exception 'A new booking must be created through the app — direct inserts cannot set an initial state.';
    end if;
    if new.service_amount_minor <> 0 or new.materials_amount_minor <> 0 or new.platform_fee_minor <> 0 then
      raise exception 'A new booking must be created through the app — amounts cannot be set directly.';
    end if;
    return new;
  end if;

  -- Existing UPDATE logic, unchanged.
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
-- 2. rpc_book_service: real eligibility check + row lock (TOCTOU) +
--    bypass flag for its own insert.
-- ---------------------------------------------------------------------
create or replace function rpc_book_service(
  p_service_id uuid,
  p_provider_id uuid,
  p_location_id uuid,
  p_scheduled_for timestamptz,
  p_instructions text,
  p_contact_phone text,
  p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = public as $$
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
    -- Row lock closes the TOCTOU window: a concurrent suspend/unpublish
    -- UPDATE on this provider must wait for this transaction to finish.
    select * into v_provider from providers where id = p_provider_id for update;
    if not found then raise exception 'This professional is not available for booking.'; end if;

    -- Deliberately generic error — do not leak WHICH condition failed
    -- (verification vs. publication vs. suspension vs. clearance) to an
    -- unauthenticated-in-spirit client probing provider IDs.
    if not (
      v_provider.is_published
      and v_provider.verification_status = 'verified'
      and v_provider.is_accepting_work
      and not v_provider.is_suspended
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
end $function$;

-- ---------------------------------------------------------------------
-- 3. rpc_submit_quote: real eligibility check + row lock.
-- ---------------------------------------------------------------------
create or replace function rpc_submit_quote(p_request_id uuid, p_amount_minor bigint, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_provider providers%rowtype;
  v_request service_requests%rowtype;
  v_quote_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  -- Row lock: same TOCTOU rationale as rpc_book_service.
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
end $function$;

-- ---------------------------------------------------------------------
-- 4. rpc_accept_quote: re-check the quoting provider's eligibility at
--    acceptance time too, not just at quote-submission time — a quote
--    can go stale (provider suspended/unpublished between quoting and
--    the customer accepting). Row lock via `for update`, already present
--    on the quote/request rows; adding it on the provider row too.
-- ---------------------------------------------------------------------
create or replace function rpc_accept_quote(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
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
end $function$;

-- ---------------------------------------------------------------------
-- 5. Give the two remaining legitimate insert paths the bypass flag —
--    otherwise the new INSERT guard (step 1) breaks them. Logic
--    unchanged; only the set_config line is new. See residual-risk notes
--    in SECURITY_READINESS_REGISTER.md for why these two do NOT get a
--    fresh eligibility re-check in this pass (recurring occurrences and
--    admin-driven Deal Desk conversions are architecturally different
--    from a customer-initiated booking/quote and need their own design
--    discussion, not a copy-pasted check).
-- ---------------------------------------------------------------------
create or replace function _create_recurring_occurrence(p_series_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
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
end $function$;

create or replace function rpc_convert_deal_desk_request(p_request_id uuid, p_customer_id uuid, p_category_id uuid, p_fulfilment_mode fulfilment_mode, p_amount_minor bigint)
returns uuid language plpgsql security definer set search_path = public as $$
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
end $function$;

-- ---------------------------------------------------------------------
-- 6. Defense-in-depth: quotes.state has no CHECK constraint today (only
--    a comment documenting the intended 4 values). Close it the same way
--    txn_state is a real enum, not free text. Not itself independently
--    exploitable via any known path today (rpc_accept_quote/decline
--    already only ever set documented values, and RLS on quotes requires
--    provider_id ownership so at least impersonation isn't possible) —
--    still a real, cheap, defense-in-depth fix worth taking now while
--    touching this code.
-- ---------------------------------------------------------------------
alter table quotes add constraint quotes_state_check
  check (state in ('pending','accepted','declined','expired'));

-- ---------------------------------------------------------------------
-- Grants: no grant changes needed. rpc_book_service, rpc_submit_quote,
-- rpc_accept_quote keep their existing authenticated-only grants
-- (already confirmed anon cannot call any of the three). Re-affirmed
-- explicitly here for clarity, matching this codebase's established
-- discipline of never assuming a grant survived a CREATE OR REPLACE
-- (it does survive REPLACE in Postgres, but the explicit statement
-- costs nothing and removes any doubt for the next person reading this).
-- ---------------------------------------------------------------------
revoke all on function rpc_book_service(uuid,uuid,uuid,timestamptz,text,text,text) from public, anon;
grant execute on function rpc_book_service(uuid,uuid,uuid,timestamptz,text,text,text) to authenticated;
revoke all on function rpc_submit_quote(uuid,bigint,text) from public, anon;
grant execute on function rpc_submit_quote(uuid,bigint,text) to authenticated;
revoke all on function rpc_accept_quote(uuid) from public, anon;
grant execute on function rpc_accept_quote(uuid) to authenticated;
