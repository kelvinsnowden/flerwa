-- TXN-012 (MARKETPLACE_REMEDIATION_REGISTER.md) — founder decision
-- (RESOLVED 2026-09-14, item 11: "Build both now... partial-release
-- payments tied to defined milestones instead of one lump sum") —
-- implements docs/07-payments.md's >KSh 25,000 structure: "30% on scope
-- agreement, materials as a discrete stage, balance on completion."
--
-- Architectural decision, stated explicitly because it's the one thing
-- that makes this tractable without rearchitecting the whole payment
-- core in one pass: FUNDING stays a single lump-sum event, exactly as
-- today (`_fund_transaction` still escrows `total_amount_minor` in one
-- call — "fund before dispatch, always" from docs/07 rule 1 is if
-- anything MORE important for a large job, not less). What becomes
-- multi-stage is RELEASE. Re-reading docs/07's whole payment-structure
-- table with this lens, every tier is actually about release staging
-- over one upfront-funded escrow — "callout released at check-in;
-- balance on approval" for the 5k-25k tier is the same shape, just two
-- stages instead of three. The milestone table below generalizes that
-- pattern for jobs where `service_amount_minor` exceeds KSh 25,000
-- (2,500,000 minor units):
--
--   scope_agreement (30%)  — released the moment the transaction is
--                            funded (this codebase has no separate
--                            "scope negotiation" step before a fixed-
--                            price booking — the price is fixed at
--                            booking time, so funding IS the moment
--                            scope is agreed).
--   materials               — the existing `materials_amount_minor`
--                            field, released at check-in (the provider
--                            needs materials money before starting
--                            work). This is a plain advance, not the
--                            full MATERIALS_ADVANCED/MATERIALS_RECEIPTED/
--                            auto-return-unused-balance cycle docs/07
--                            rule 2 separately describes — that receipt-
--                            reconciliation mechanic does not exist for
--                            ANY transaction size today (confirmed:
--                            `_release_transaction` never touches
--                            `materials_held` at all) and stays a
--                            separate, larger, un-built gap; documented
--                            here rather than silently assumed solved.
--   balance (remaining 70%) — released at the existing customer-approval
--                            step (`_release_transaction`), same trigger
--                            as today's single-release flow. Platform
--                            and provider fees are collected in full
--                            here, not pro-rated across stages — the
--                            simplest correct place to net them out, and
--                            avoids fractional-cent splitting across
--                            three separate ledger events.
--
-- Jobs at or below KSh 25,000 get NO milestone rows at all — the
-- existing single-funding/single-release flow is completely untouched
-- for the vast majority of real job values seen in this project's own
-- seed data (KSh 700–8,000). This is deliberate: it keeps the
-- well-tested existing path byte-for-byte unchanged for the common
-- case, and confines all new risk to the genuinely-large-job minority.
--
-- Genuine correctness fix required by this design, not a new feature:
-- `rpc_cancel_booking` and `_execute_refund` (dispute resolution) both
-- unconditionally debit `service_amount_minor + platform_fee_minor`
-- from `funds_held` as if nothing had ever been released — true for
-- every transaction before this migration (release was always a single
-- terminal event), but no longer true once a milestone transaction's
-- scope_agreement portion has already been paid out to the provider at
-- funding time. Left unfixed, cancelling or disputing a milestone
-- transaction after scope_agreement release would double-count that
-- portion and break the ledger's debit=credit invariant
-- (`rpc_admin_check_ledger_balance` would catch it, but only after the
-- fact). Both are updated below to reverse only what's actually still
-- held.

-- ---------------------------------------------------------------------
-- transaction_milestones: one row per stage for a qualifying (>KSh
-- 25,000) transaction; no rows at all for a normal-sized one.
-- ---------------------------------------------------------------------
create table transaction_milestones (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  kind           text not null check (kind in ('scope_agreement','materials','balance')),
  amount_minor   bigint not null check (amount_minor >= 0),
  state          text not null default 'pending' check (state in ('pending','released')),
  released_at    timestamptz,
  sort_order     int not null,
  created_at     timestamptz not null default now(),
  unique (transaction_id, kind)
);

create index transaction_milestones_transaction_id_idx on transaction_milestones (transaction_id);

alter table transaction_milestones enable row level security;

-- Same participant/admin visibility rule as service_transactions itself
-- — a milestone row is never more sensitive than the transaction it
-- belongs to.
create policy "transaction milestones participant read" on transaction_milestones
  for select using (
    is_admin() or exists (
      select 1 from service_transactions t
      left join providers p on p.id = t.provider_id
      where t.id = transaction_milestones.transaction_id
        and (t.customer_id = auth.uid() or p.user_id = auth.uid())
    )
  );
-- No insert/update/delete policy at all: every write goes through the
-- SECURITY DEFINER functions below, never a direct client write.

-- ---------------------------------------------------------------------
-- _create_transaction_milestones_if_qualifying: called once, right
-- after a transaction is inserted, from every booking/conversion path.
-- A plain no-op for any transaction at or below the KSh 25,000 threshold.
-- ---------------------------------------------------------------------
create or replace function _create_transaction_milestones_if_qualifying(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_scope_amount bigint;
begin
  select * into v_txn from service_transactions where id = p_transaction_id;
  if not found or v_txn.service_amount_minor <= 2500000 then return; end if;

  v_scope_amount := round(v_txn.service_amount_minor * 0.30);

  insert into transaction_milestones (transaction_id, kind, amount_minor, sort_order) values
    (p_transaction_id, 'scope_agreement', v_scope_amount, 1),
    (p_transaction_id, 'materials', v_txn.materials_amount_minor, 2),
    (p_transaction_id, 'balance', v_txn.service_amount_minor - v_scope_amount, 3);
end $$;

revoke all on function _create_transaction_milestones_if_qualifying(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- _release_milestone: releases one pending milestone's amount from
-- escrow to the provider, 100% pass-through (no fee deduction — fees
-- are netted out only at the terminal 'balance' release, inside
-- _release_transaction below). A safe no-op if no such pending milestone
-- exists (non-qualifying transaction, or this stage already released) —
-- every call site below calls this unconditionally, relying on that.
-- ---------------------------------------------------------------------
create or replace function _release_milestone(p_transaction_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_milestone transaction_milestones%rowtype;
  v_group uuid := gen_random_uuid();
  v_provider_user_id uuid;
begin
  select * into v_milestone from transaction_milestones
    where transaction_id = p_transaction_id and kind = p_kind and state = 'pending'
    for update;
  if not found then return; end if;

  select * into v_txn from service_transactions where id = p_transaction_id;
  select user_id into v_provider_user_id from providers where id = v_txn.provider_id;

  if v_milestone.amount_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values
      (v_group, p_transaction_id,
       (case when p_kind = 'materials' then 'materials_held' else 'funds_held' end)::ledger_account_type,
       null, 'debit', v_milestone.amount_minor, v_txn.currency),
      (v_group, p_transaction_id, 'provider_payable', v_provider_user_id, 'credit', v_milestone.amount_minor, v_txn.currency);
  end if;

  update transaction_milestones set state = 'released', released_at = now() where id = v_milestone.id;
end $$;

revoke all on function _release_milestone(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Wire the three release triggers into their existing state-transition
-- points. Each addition is one `perform` line; nothing else in these
-- functions changes.
-- ---------------------------------------------------------------------

-- 1. scope_agreement releases the moment funding succeeds.
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

  perform _release_milestone(p_transaction_id, 'scope_agreement');

  return v_payment_id;
end $$;

-- 2. materials releases at check-in.
create or replace function rpc_provider_check_in(p_transaction_id uuid, p_geo_lat numeric, p_geo_lng numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
begin
  select t.* into v_txn from service_transactions t
    join providers p on p.id = t.provider_id
    where t.id = p_transaction_id and p.user_id = auth.uid()
    for update;
  if not found then raise exception 'Not authorized for this transaction.'; end if;
  if v_txn.state not in ('funded','scheduled') then
    raise exception 'Cannot check in from state %.', v_txn.state;
  end if;

  update service_transactions set state = 'checked_in', checked_in_at = now(), updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'provider_checked_in', v_txn.state, 'checked_in',
    jsonb_build_object('geo_lat', p_geo_lat, 'geo_lng', p_geo_lng));

  perform _release_milestone(p_transaction_id, 'materials');
end $$;

-- 3. balance releases at the existing customer-approval step — this is
-- also where fees are finally collected in full, on whatever remains.
create or replace function _release_transaction(p_transaction_id uuid, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_group uuid := gen_random_uuid();
  v_balance_milestone transaction_milestones%rowtype;
  v_release_amount bigint;
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state <> 'evidence_submitted' then
    raise exception 'Cannot approve from state %.', v_txn.state;
  end if;

  -- No milestone rows at all for a normal-sized transaction — v_release_amount
  -- then falls back to service_amount_minor, i.e. today's unstaged behavior,
  -- byte-for-byte.
  select * into v_balance_milestone from transaction_milestones
    where transaction_id = p_transaction_id and kind = 'balance';
  v_release_amount := coalesce(v_balance_milestone.amount_minor, v_txn.service_amount_minor);

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, p_transaction_id, 'funds_held',       null, 'debit',  v_release_amount + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'provider_payable',
       (select user_id from providers where id = v_txn.provider_id), 'credit', v_release_amount - v_txn.provider_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor + v_txn.provider_fee_minor, v_txn.currency);

  if v_balance_milestone.id is not null then
    update transaction_milestones set state = 'released', released_at = now() where id = v_balance_milestone.id;
  end if;

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

-- ---------------------------------------------------------------------
-- Correctness fix: rpc_cancel_booking and _execute_refund both reverse
-- funds_held as if it still held service_amount_minor + platform_fee_minor
-- in full — true before this migration (release was always terminal),
-- no longer true once a milestone transaction's scope_agreement stage
-- has already paid out. Both now reverse only what funds_held actually
-- still holds: the already-released scope_agreement amount (if any) is
-- excluded from both the funds_held debit and the customer's refund,
-- since that money already left escrow to the provider and a ledger
-- reversal cannot claw it back.
-- ---------------------------------------------------------------------
create or replace function rpc_cancel_booking(p_transaction_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
  v_already_released bigint := 0;
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found or v_txn.customer_id <> auth.uid() then raise exception 'Not authorized.'; end if;

  if v_txn.state not in ('requested', 'quoted', 'quote_accepted', 'funded', 'scheduled', 'en_route') then
    raise exception 'Cannot cancel from state % — the Pro has already checked in.', v_txn.state;
  end if;

  v_new_state := case when v_txn.funded_at is not null then 'refunded' else 'cancelled_by_customer' end;

  if v_txn.funded_at is not null then
    select amount_minor into v_already_released from transaction_milestones
      where transaction_id = p_transaction_id and kind = 'scope_agreement' and state = 'released';
    v_already_released := coalesce(v_already_released, 0);

    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values
      (v_group, p_transaction_id, 'funds_held', null, 'debit', (v_txn.service_amount_minor + v_txn.platform_fee_minor) - v_already_released, v_txn.currency),
      (v_group, p_transaction_id, 'materials_held', null, 'debit', v_txn.materials_amount_minor, v_txn.currency),
      (v_group, p_transaction_id, 'refunds', v_txn.customer_id, 'credit', v_txn.total_amount_minor - v_already_released, v_txn.currency);

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

  -- A milestone transaction may already have paid its scope_agreement
  -- stage to the provider before the dispute was opened — that portion
  -- is no longer in escrow, so the admin's split only covers what's
  -- actually still held (same reasoning as rpc_cancel_booking above).
  select amount_minor into v_already_released from transaction_milestones
    where transaction_id = v_txn.id and kind = 'scope_agreement' and state = 'released';
  v_already_released := coalesce(v_already_released, 0);
  v_release_amount := v_txn.service_amount_minor - v_already_released;

  if v_provider_minor + v_customer_refund_minor <> v_release_amount then
    raise exception 'Provider amount + customer refund (%) must equal the amount still held (%).',
      v_provider_minor + v_customer_refund_minor, v_release_amount;
  end if;

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

-- ---------------------------------------------------------------------
-- Hook milestone creation into the three places a service_transactions
-- row is created with pricing already resolved — same signatures as
-- the differentiated-fee-schedule migration, only one new line each.
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
    if v_service.category_id is not null and not exists (
      select 1 from provider_categories pc
      where pc.provider_id = p_provider_id and pc.category_id = v_category_id and pc.is_cleared
    ) then
      raise exception 'Provider is not cleared for this category.';
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
end $$;

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

  select * into v_provider from providers where id = v_quote.provider_id;

  select o_customer_fee_pct, o_provider_fee_pct into v_customer_fee_pct, v_provider_fee_pct
  from _resolve_fee_pcts(v_request.category_id, 'task', auth.uid(), v_quote.provider_id);
  v_fee := round(v_quote.amount_minor * v_customer_fee_pct / 100);
  v_provider_fee := round(v_quote.amount_minor * v_provider_fee_pct / 100);

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
end $$;

create or replace function rpc_convert_deal_desk_request(
  p_request_id uuid,
  p_customer_id uuid,
  p_category_id uuid,
  p_fulfilment_mode fulfilment_mode,
  p_amount_minor bigint
) returns uuid language plpgsql security definer set search_path = public as $$
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
end $$;
