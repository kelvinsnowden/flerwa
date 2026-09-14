-- PAY-007 (MARKETPLACE_REMEDIATION_REGISTER.md) — founder decision
-- (RESOLVED 2026-09-14, item 6/decision 2): "Build the full
-- differentiated-by-vertical model now... ratify docs/10's model in
-- writing" — replaces the flat `round(v_price * 0.12)` customer-only fee
-- hardcoded in THREE live places (rpc_book_service, rpc_convert_deal_desk_
-- request, and rpc_accept_quote — the third found by grepping for the
-- literal `0.12` while implementing this, not just the two the register
-- named; two other historical copies of rpc_book_service in earlier
-- migration files are dead code, superseded by CREATE OR REPLACE and
-- confirmed via pg_get_functiondef against the live project) with the
-- full two-sided, vertical/repeat/Deal-Desk-aware table from
-- docs/10-business-model.md, adopted verbatim:
--
--   vertical            customer  provider
--   remote_principal    12%       8%
--   business_services   12%       0%
--   home_services        8%      10%
--   deal_desk (origin)   0%       5%
--   repeat, same pair, 2nd job   6%   6%
--   repeat, same pair, 3rd+ job  5%   5%
--   recurring series     5%       5%  (seeded now; unreachable until the
--                                      recurring-series schema/flow ships
--                                      — no transaction sets a recurring
--                                      flag yet, tracked separately)
--
-- The provider-side deduction is genuinely new: today's schema only ever
-- charged the CUSTOMER a fee (`platform_fee_minor`, added on top of
-- price) and paid the provider 100% of `service_amount_minor` — i.e. the
-- shipped behavior was already exactly docs/10's "Business & creator"
-- row (12%/0%) applied to every vertical, not the differentiated model.
-- `provider_fee_minor` is added as a new column, deducted from the
-- provider's payout at release time (never added to what the customer
-- pays or what's held in escrow — funds_held stays service_amount +
-- platform_fee, unchanged; the provider fee is a split of
-- service_amount_minor itself between provider and platform).
--
-- Deliberately NOT touched by this migration: _execute_refund (dispute
-- resolution). That path is an admin's discretionary split of
-- service_amount_minor between provider/customer-refund, already
-- independent of the normal fee model (platform_fee_minor is captured to
-- platform_revenue in full regardless of the split an admin chooses) —
-- automatically layering a provider-fee deduction into a human's
-- case-by-case dispute judgment would be a silent behavior change to a
-- path the founder didn't ask to touch here.

-- ---------------------------------------------------------------------
-- New column: the provider-side deduction, parallel to the existing
-- customer-side platform_fee_minor. Defaults to 0 so every historical
-- row (and any future insert this migration doesn't touch) is
-- unaffected until explicitly set by the booking/conversion RPCs below.
-- ---------------------------------------------------------------------
alter table service_transactions
  add column provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0);

-- Same "financial amounts are immutable once funded" protection as the
-- existing fields — see 20260908144600_guard_transaction_financial_writes.sql's
-- own header comment for why this trigger exists.
create or replace function trg_guard_transaction_financial_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_txn_guard', true), 'off') = 'on' then
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
    or new.provider_fee_minor is distinct from old.provider_fee_minor
  ) then
    raise exception 'Financial amounts cannot be changed on a transaction after it has been funded.';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------
-- fee_schedules: the ratified table itself. `effective_from` supports a
-- future rate change without losing history (the resolver below always
-- picks the most recent row that has taken effect) — not exposed to any
-- editing UI yet (out of scope for this pass); changing a rate today
-- still means a new migration inserting a new-effective-from row, same
-- discipline as every other schema change in this codebase.
-- ---------------------------------------------------------------------
create table fee_schedules (
  id                uuid primary key default gen_random_uuid(),
  scope             text not null check (scope in ('vertical','deal_desk','repeat_2nd','repeat_3rd_plus','recurring')),
  vertical          text, -- required iff scope = 'vertical'; must match categories.vertical
  customer_fee_pct  numeric(5,2) not null check (customer_fee_pct >= 0 and customer_fee_pct <= 100),
  provider_fee_pct  numeric(5,2) not null check (provider_fee_pct >= 0 and provider_fee_pct <= 100),
  effective_from    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  check ((scope = 'vertical') = (vertical is not null))
);

create index fee_schedules_lookup_idx on fee_schedules (scope, vertical, effective_from desc);

alter table fee_schedules enable row level security;
create policy "fee schedules admin read" on fee_schedules for select using (is_admin());

insert into fee_schedules (scope, vertical, customer_fee_pct, provider_fee_pct) values
  ('vertical', 'remote_principal',  12, 8),
  ('vertical', 'business_services', 12, 0),
  ('vertical', 'home_services',      8, 10),
  ('deal_desk',        null, 0, 5),
  ('repeat_2nd',       null, 6, 6),
  ('repeat_3rd_plus',  null, 5, 5),
  ('recurring',        null, 5, 5);

-- ---------------------------------------------------------------------
-- _resolve_fee_pcts: the single place that decides which row of the
-- table above applies to a given booking. Not granted to anon/
-- authenticated — reachable only from inside the SECURITY DEFINER
-- booking/conversion RPCs below, same pattern as _fund_transaction/
-- _release_transaction (see those functions' own grant statements).
--
-- Priority order, matching docs/10's own framing (these are overrides
-- of the vertical base rate, not alternatives to it):
--   1. origin = 'deal_desk'            -> the Deal Desk row
--   2. same customer+provider pair has already completed N jobs together
--      (state reached released/settled/reviewed/closed at least once/twice)
--                                       -> repeat_2nd / repeat_3rd_plus
--   3. otherwise                       -> the category's vertical row
--
-- Fails loudly (raises) rather than silently defaulting to some rate if
-- a category's vertical has no matching schedule row — a mismatch here
-- means a new vertical/category was added without ratifying its fee,
-- which should block the booking and be visibly fixed, not quietly
-- charge the wrong rate.
-- ---------------------------------------------------------------------
create or replace function _resolve_fee_pcts(
  p_category_id uuid, p_origin text, p_customer_id uuid, p_provider_id uuid,
  out o_customer_fee_pct numeric, out o_provider_fee_pct numeric
) language plpgsql stable security definer set search_path = public as $$
declare
  v_vertical text;
  v_repeat_count integer;
  v_scope text;
begin
  if p_origin = 'deal_desk' then
    v_scope := 'deal_desk';
  elsif p_customer_id is not null and p_provider_id is not null then
    select count(*) into v_repeat_count
    from service_transactions
    where customer_id = p_customer_id and provider_id = p_provider_id
      and state in ('released','settled','reviewed','closed');
    if v_repeat_count = 1 then
      v_scope := 'repeat_2nd';
    elsif v_repeat_count >= 2 then
      v_scope := 'repeat_3rd_plus';
    end if;
  end if;

  if v_scope is not null then
    select customer_fee_pct, provider_fee_pct into o_customer_fee_pct, o_provider_fee_pct
    from fee_schedules
    where scope = v_scope and effective_from <= now()
    order by effective_from desc limit 1;
    if found then return; end if;
  end if;

  select vertical into v_vertical from categories where id = p_category_id;

  select customer_fee_pct, provider_fee_pct into o_customer_fee_pct, o_provider_fee_pct
  from fee_schedules
  where scope = 'vertical' and vertical = v_vertical and effective_from <= now()
  order by effective_from desc limit 1;

  if not found then
    raise exception 'No fee schedule configured for vertical %. Add a fee_schedules row before enabling this category.', coalesce(v_vertical, '(none)');
  end if;
end $$;

revoke all on function _resolve_fee_pcts(uuid, text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- rpc_book_service — same signature/behavior as the currently-live
-- function (20260912101047_fix_rpc_book_service_overload_and_grants.sql),
-- only the fee computation changes. Grants are untouched by
-- CREATE OR REPLACE, so authenticated's existing execute grant carries
-- forward unchanged.
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
      return v_txn_id; -- already booked by an earlier call with this exact key — idempotent no-op
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

  -- resolve price server-side: provider override else service base price
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
    -- Lost a race against a concurrent call with the same key (both passed
    -- the earlier SELECT check before either had inserted) — the unique
    -- index still caught it. Return the winner's id rather than erroring.
    select id into v_txn_id from service_transactions
      where customer_id = auth.uid() and idempotency_key = p_idempotency_key;
    return v_txn_id;
  end if;

  -- copy the service's scope items onto the transaction (snapshot at time of booking)
  insert into transaction_scope_items (transaction_id, label, included, sort_order)
  select v_txn_id, label, included, sort_order from service_scope_items where service_id = p_service_id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('service_id', p_service_id, 'provider_id', p_provider_id));

  return v_txn_id;
end $$;

-- ---------------------------------------------------------------------
-- rpc_convert_deal_desk_request — the admin no longer types in a
-- freeform platform fee; it's now the ratified 0%/5% Deal Desk row,
-- resolved the same way every other booking path resolves its fee.
-- Signature changes (drops p_platform_fee_minor), so the old overload
-- must be explicitly dropped rather than replaced in place.
-- ---------------------------------------------------------------------
drop function if exists rpc_convert_deal_desk_request(uuid, uuid, uuid, fulfilment_mode, bigint, bigint);

create function rpc_convert_deal_desk_request(
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

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'convert_deal_desk_request', 'deal_desk_requests', p_request_id,
          jsonb_build_object('transaction_id', v_txn_id));

  insert into notifications (user_id, type, title, body, transaction_id)
  values (p_customer_id, 'deal_desk_converted', 'Your booking is set up',
          'Your provider''s arrangement has been converted into a protected booking. We''ll be in touch to confirm payment.',
          v_txn_id);

  return v_txn_id;
end $$;

revoke execute on function rpc_convert_deal_desk_request(uuid, uuid, uuid, fulfilment_mode, bigint) from public, anon;
grant execute on function rpc_convert_deal_desk_request(uuid, uuid, uuid, fulfilment_mode, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_accept_quote — the fourth (and last) place that hardcoded the flat
-- 12% fee (customer accepting a provider's quote on a posted task).
-- Same resolver, same origin/repeat-pair logic as rpc_book_service;
-- origin='task' is not 'deal_desk', so this only ever resolves to a
-- repeat-pair or vertical row, exactly like a direct storefront booking.
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

  insert into notifications (user_id, type, title, body, transaction_id)
  values (
    v_provider.user_id, 'quote_accepted', 'Your quote was accepted',
    'Your quote for "' || v_request.title || '" was accepted.', v_txn_id
  );

  return v_txn_id;
end $$;

-- ---------------------------------------------------------------------
-- _release_transaction: the provider's payout is now net of
-- provider_fee_minor (0 for every historical row and for any vertical
-- whose resolved provider_fee_pct is 0, so this is a strict
-- generalization of the previous "provider always gets 100%" behavior,
-- not a behavior change for rows where provider_fee_minor = 0). The
-- deducted amount goes to platform_revenue alongside the existing
-- customer-side platform_fee_minor — funds_held's debit is unchanged
-- (service_amount + platform_fee, the total ever held), so the ledger
-- stays balanced: debit = credit sum in every case.
-- ---------------------------------------------------------------------
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
       (select user_id from providers where id = v_txn.provider_id), 'credit', v_txn.service_amount_minor - v_txn.provider_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor + v_txn.provider_fee_minor, v_txn.currency);

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
