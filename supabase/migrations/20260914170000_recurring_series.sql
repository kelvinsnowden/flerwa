-- TXN-011 (MARKETPLACE_REMEDIATION_REGISTER.md) — founder decision
-- (RESOLVED 2026-09-14, item 11: "Build both now" — recurring-service
-- bookings and milestone payments). This is the recurring half:
-- docs/07-payments.md §3 ("Recurring transactions need per-occurrence
-- escrow — never take a large upfront payment for a series. A customer
-- booking quarterly property checks funds each occurrence shortly
-- before it happens") and TXN-011's own recommended solution ("schema
-- for a recurring_series table, a scheduled job to auto-create the next
-- occurrence's service_transactions draft, customer approval per
-- occurrence").
--
-- Deliberate design choice: each occurrence is a completely ordinary
-- service_transactions row, funded and released through the EXACT same
-- state machine and RPCs every other booking uses (rpc_confirm_manual_payment,
-- _release_transaction, cancel, dispute — none of them touched by this
-- migration). recurring_series only decides WHEN the next occurrence's
-- row gets created — never a stored payment method, never an auto-charge.
-- That is the "per-occurrence escrow, not a prepaid balance" rule from
-- docs/07 by construction: there is no code path anywhere that could
-- charge a customer for an occurrence they haven't individually seen,
-- funded, and can still cancel.
--
-- The next occurrence is created `lead_days` before it's due (default
-- 3) rather than on the due date itself, so the customer has time to
-- pay before the date arrives — same reasoning as escrow being required
-- before dispatch for a one-off booking. Fees use docs/10-business-model.md's
-- dedicated "Recurring series" row (5%/5%, seeded already in
-- fee_schedules by the differentiated-fee-schedule migration but
-- unreachable until now — _resolve_fee_pcts gets a new origin='recurring'
-- branch below).

-- ---------------------------------------------------------------------
-- recurring_series: the schedule itself. One row per standing
-- arrangement between a customer and provider for one service.
-- ---------------------------------------------------------------------
create table recurring_series (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references profiles(id),
  provider_id          uuid not null references providers(id),
  service_id           uuid not null references services(id),
  category_id          uuid not null references categories(id),
  location_id          uuid references locations(id),
  frequency            text not null check (frequency in ('weekly','biweekly','monthly')),
  customer_instructions text,
  contact_phone        text not null,
  next_occurrence_date date not null,
  lead_days            integer not null default 3 check (lead_days >= 0),
  is_active            boolean not null default true,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now()
);

create index recurring_series_due_idx on recurring_series (next_occurrence_date) where is_active;

alter table recurring_series enable row level security;

create policy "recurring series participant read" on recurring_series
  for select using (
    is_admin() or customer_id = auth.uid() or exists (
      select 1 from providers p where p.id = recurring_series.provider_id and p.user_id = auth.uid()
    )
  );
-- No insert/update/delete policy — every write goes through the
-- SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------
-- service_transactions gets a nullable back-reference so a customer/
-- provider/admin can see which occurrences belong to which series (and
-- so _create_recurring_occurrence has somewhere to record it). Every
-- existing row and every one-off booking leaves this null — no change
-- to any existing query that doesn't select this column.
-- ---------------------------------------------------------------------
alter table service_transactions add column recurring_series_id uuid references recurring_series(id);

-- ---------------------------------------------------------------------
-- _resolve_fee_pcts: add the 'recurring' origin — same priority
-- position as 'deal_desk' (an override of the vertical base rate, not
-- subject to the repeat-pair escalation, since a recurring series' own
-- 5%/5% rate already IS the retention-priced rate docs/10 wants).
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
  elsif p_origin = 'recurring' then
    v_scope := 'recurring';
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

-- ---------------------------------------------------------------------
-- _create_recurring_occurrence: creates one ordinary service_transactions
-- row for a series, exactly the way rpc_book_service creates a one-off
-- booking (price resolution, fee resolution, milestone check, scope
-- items, event log) — the only differences are origin='recurring' and
-- stamping recurring_series_id. Not granted to anon/authenticated —
-- reachable only from rpc_start_recurring_series (the first occurrence)
-- and rpc_generate_due_recurring_occurrences (every occurrence after).
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
end $$;

revoke all on function _create_recurring_occurrence(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- rpc_start_recurring_series: customer-facing. Same auth/clearance
-- checks as rpc_book_service, plus immediately creates the first
-- occurrence (so the customer has something to pay for right away) and
-- advances next_occurrence_date past it, so the cron sweep below
-- doesn't regenerate a duplicate first occurrence on its next run.
-- ---------------------------------------------------------------------
create or replace function rpc_start_recurring_series(
  p_service_id uuid,
  p_provider_id uuid,
  p_location_id uuid,
  p_frequency text,
  p_first_occurrence_date date,
  p_instructions text,
  p_contact_phone text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_service services%rowtype;
  v_category_id uuid;
  v_series_id uuid;
  v_interval interval;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  if p_frequency not in ('weekly','biweekly','monthly') then
    raise exception 'Invalid frequency.';
  end if;
  if p_first_occurrence_date < current_date then
    raise exception 'The first occurrence must be today or later.';
  end if;

  select * into v_service from services where id = p_service_id and is_active;
  if not found then raise exception 'Service not found or inactive.'; end if;
  if v_service.pricing_model <> 'recurring' then
    raise exception 'This service is not set up for recurring bookings.';
  end if;
  v_category_id := v_service.category_id;

  if v_service.category_id is not null and not exists (
    select 1 from provider_categories pc
    where pc.provider_id = p_provider_id and pc.category_id = v_category_id and pc.is_cleared
  ) then
    raise exception 'Provider is not cleared for this category.';
  end if;

  insert into recurring_series (
    customer_id, provider_id, service_id, category_id, location_id,
    frequency, customer_instructions, contact_phone, next_occurrence_date
  ) values (
    auth.uid(), p_provider_id, p_service_id, v_category_id, p_location_id,
    p_frequency, p_instructions, p_contact_phone, p_first_occurrence_date
  ) returning id into v_series_id;

  perform _create_recurring_occurrence(v_series_id);

  v_interval := case p_frequency
    when 'weekly' then interval '7 days'
    when 'biweekly' then interval '14 days'
    else interval '1 month'
  end;
  update recurring_series set next_occurrence_date = next_occurrence_date + v_interval where id = v_series_id;

  return v_series_id;
end $$;

revoke execute on function rpc_start_recurring_series(uuid, uuid, uuid, text, date, text, text) from public, anon;
grant execute on function rpc_start_recurring_series(uuid, uuid, uuid, text, date, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_cancel_recurring_series: stops future occurrences only — any
-- occurrence already created (paid or not) follows its own normal
-- booking lifecycle (cancel/dispute/etc.) completely independently.
-- Exactly the "customer can stop at any time" property docs/10 names as
-- the whole point of per-occurrence funding.
-- ---------------------------------------------------------------------
create or replace function rpc_cancel_recurring_series(p_series_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_series recurring_series%rowtype;
begin
  select * into v_series from recurring_series where id = p_series_id for update;
  if not found then raise exception 'Recurring series not found.'; end if;
  if v_series.customer_id <> auth.uid() and not is_admin() then
    raise exception 'Not authorized for this series.';
  end if;

  update recurring_series set is_active = false, cancelled_at = now() where id = p_series_id;
end $$;

revoke execute on function rpc_cancel_recurring_series(uuid) from public, anon;
grant execute on function rpc_cancel_recurring_series(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_generate_due_recurring_occurrences: the scheduled sweep. Same
-- "for update skip locked" pattern as every other batch job in this
-- codebase — a series another concurrent run is already processing is
-- simply skipped this pass, not double-processed.
-- ---------------------------------------------------------------------
create or replace function rpc_generate_due_recurring_occurrences() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_series recurring_series%rowtype;
  v_count integer := 0;
  v_interval interval;
begin
  for v_series in
    select * from recurring_series
    where is_active and next_occurrence_date - (lead_days || ' days')::interval <= now()
    for update skip locked
  loop
    perform _create_recurring_occurrence(v_series.id);

    v_interval := case v_series.frequency
      when 'weekly' then interval '7 days'
      when 'biweekly' then interval '14 days'
      else interval '1 month'
    end;

    update recurring_series set next_occurrence_date = next_occurrence_date + v_interval where id = v_series.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function rpc_generate_due_recurring_occurrences() from public, anon, authenticated;

-- Same advisory-lock overlap guard as rpc_run_auto_approve_sweep_locked
-- (20260912094623_scheduler_runs_and_locked_auto_approve_sweep.sql) —
-- a distinct lock key so the two sweeps never contend with each other.
create or replace function rpc_generate_due_recurring_occurrences_locked() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint := hashtext('generate_recurring_occurrences')::bigint;
  v_got_lock boolean;
  v_count integer;
begin
  v_got_lock := pg_try_advisory_lock(v_lock_key);
  if not v_got_lock then
    return -1;
  end if;

  begin
    v_count := rpc_generate_due_recurring_occurrences();
  exception when others then
    perform pg_advisory_unlock(v_lock_key);
    raise;
  end;

  perform pg_advisory_unlock(v_lock_key);
  return v_count;
end $$;

revoke all on function rpc_generate_due_recurring_occurrences_locked() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Seed exactly one real recurring-priced service so this feature has an
-- actual product surface to point at, matching docs/07's own example
-- ("a customer booking quarterly property checks") — rather than
-- shipping schema nothing in the catalog ever uses. NOT seeded with a
-- provider_categories clearance row: as of this migration, the live
-- project has zero cleared providers for ANY category at all (checked
-- directly — provider_categories has 2 rows total, none is_cleared,
-- and zero published providers), a pre-existing gap across the whole
-- explicit-provider booking path, not something introduced or fixable
-- by this migration. A provider must be published and cleared for this
-- category (existing /admin flow) before this service is actually
-- bookable with a chosen provider in the live app.
-- ---------------------------------------------------------------------
insert into services (category_id, slug, name, summary, pricing_model, fulfilment_mode, base_price_minor, currency, is_active, requires_location, scheduling_mode)
select id, 'quarterly-property-check', 'Quarterly property check', 'A standing arrangement — we check on your property every quarter and report back.',
       'recurring', 'on_site_customer_absent', 350000, 'KES', true, true, 'request'
from categories where vertical = 'home_services'
limit 1;
