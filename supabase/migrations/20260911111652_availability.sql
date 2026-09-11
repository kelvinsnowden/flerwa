-- =====================================================================
-- Reusable availability model. Confirmed by grep across every prior
-- migration for availability|calendar|slot|schedule — none of this
-- existed, so this is new, not a duplicate of something already built.
--
-- `services.scheduling_mode` lets the catalogue (not hard-coded
-- per-service-name branches in application code) decide whether a
-- service uses a real calendar. Chef is the pilot set to 'scheduled' in
-- this migration's seed update below; the other four pilots stay on the
-- 'request' default (customer proposes a date/time, provider/customer
-- coordinate over conversation/messages — no calendar forced on them).
-- =====================================================================

create extension if not exists btree_gist;

alter table services add column scheduling_mode text not null default 'request'
  check (scheduling_mode in ('none', 'request', 'scheduled'));
alter table services add column slot_duration_minutes int
  check (slot_duration_minutes is null or slot_duration_minutes > 0);

comment on column services.scheduling_mode is
  'none: no calendar, request/conversation only. request: customer proposes a date/time, provider confirms manually (default). scheduled: real calendar enforced server-side via provider_booked_slots.';

-- Buffer/notice/advance-window are operational constraints of the
-- professional, not per-service, so they live on `providers` directly
-- rather than a new 1:1 settings table.
alter table providers add column booking_buffer_minutes int not null default 0 check (booking_buffer_minutes >= 0);
alter table providers add column min_notice_hours int not null default 2 check (min_notice_hours >= 0);
alter table providers add column max_advance_days int not null default 60 check (max_advance_days >= 1);

-- ---------------------------------------------------------------------
-- provider_availability_rules: recurring weekly working hours.
-- ---------------------------------------------------------------------
create table provider_availability_rules (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6), -- 0 = Sunday, matches extract(dow from ...)
  start_time   time not null,
  end_time     time not null,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
create index on provider_availability_rules (provider_id);

alter table provider_availability_rules enable row level security;
create policy "availability rules public read" on provider_availability_rules for select using (true);
create policy "availability rules self write" on provider_availability_rules
  for all using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin());

-- ---------------------------------------------------------------------
-- provider_blocked_slots: one-off blocked ranges a provider sets
-- manually (time off, already committed elsewhere, etc).
-- ---------------------------------------------------------------------
create table provider_blocked_slots (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  reason       text,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on provider_blocked_slots (provider_id, starts_at);

alter table provider_blocked_slots enable row level security;
create policy "blocked slots public read" on provider_blocked_slots for select using (true);
create policy "blocked slots self write" on provider_blocked_slots
  for all using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin());

-- ---------------------------------------------------------------------
-- provider_booked_slots: the actual confirmed commitments, one row per
-- scheduled transaction. The exclusion constraint is the real
-- double-booking guard, enforced by Postgres itself rather than an
-- application-level check-then-insert (which races under concurrent
-- requests): two customers attempting to book the same provider at an
-- overlapping time cannot both succeed — the second insert is rejected
-- with a 23P01 exclusion_violation.
-- ---------------------------------------------------------------------
create table provider_booked_slots (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references providers(id) on delete cascade,
  transaction_id  uuid not null references service_transactions(id) on delete cascade,
  slot_range      tstzrange not null,
  created_at      timestamptz not null default now(),
  unique (transaction_id),
  exclude using gist (provider_id with =, slot_range with &&)
);
create index on provider_booked_slots (provider_id);

alter table provider_booked_slots enable row level security;
create policy "booked slots participant read" on provider_booked_slots for select using (
  exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
  or exists (select 1 from service_transactions t where t.id = transaction_id and t.customer_id = auth.uid())
  or is_admin()
);
-- No direct write policy for anyone: only rpc_book_service (SECURITY
-- DEFINER, redefined below) may insert, alongside the transaction it
-- belongs to, in the same function call/transaction.

-- ---------------------------------------------------------------------
-- rpc_book_service, extended (not replaced) with server-enforced
-- calendar rules for scheduling_mode = 'scheduled' services. Every
-- branch below is additive: a 'request'/'none' service goes through
-- exactly the same path as before this migration.
-- ---------------------------------------------------------------------
create or replace function rpc_book_service(
  p_service_id uuid,
  p_provider_id uuid,
  p_location_id uuid,
  p_scheduled_for timestamptz,
  p_instructions text,
  p_contact_phone text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn_id uuid;
  v_service services%rowtype;
  v_provider providers%rowtype;
  v_price bigint;
  v_fee bigint;
  v_category_id uuid;
  v_slot_end timestamptz;
  v_dow int;
  v_local_start time;
  v_local_end time;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

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
    select * into v_provider from providers where id = p_provider_id;
  end if;

  if v_service.scheduling_mode = 'scheduled' then
    if v_provider.id is null then
      raise exception 'This service requires choosing a professional with an open calendar.';
    end if;
    if p_scheduled_for is null then
      raise exception 'This service requires choosing a date and time.';
    end if;
    if p_scheduled_for < now() + make_interval(hours => v_provider.min_notice_hours) then
      raise exception 'That time is too soon — this professional needs at least % hours notice.', v_provider.min_notice_hours;
    end if;
    if p_scheduled_for > now() + make_interval(days => v_provider.max_advance_days) then
      raise exception 'That time is too far ahead — this professional only takes bookings up to % days in advance.', v_provider.max_advance_days;
    end if;

    v_slot_end := p_scheduled_for + make_interval(mins => coalesce(v_service.slot_duration_minutes, 120));
    v_dow := extract(dow from (p_scheduled_for at time zone 'Africa/Nairobi'));
    v_local_start := (p_scheduled_for at time zone 'Africa/Nairobi')::time;
    v_local_end := (v_slot_end at time zone 'Africa/Nairobi')::time;

    if not exists (
      select 1 from provider_availability_rules r
      where r.provider_id = p_provider_id and r.day_of_week = v_dow
        and r.start_time <= v_local_start and r.end_time >= v_local_end
    ) then
      raise exception 'This professional is not available at that time.';
    end if;

    if exists (
      select 1 from provider_blocked_slots b
      where b.provider_id = p_provider_id
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_scheduled_for, v_slot_end, '[)')
    ) then
      raise exception 'This professional is unavailable at that time.';
    end if;
  end if;

  -- resolve price server-side: provider override else service base price
  select coalesce(ps.price_minor, v_service.base_price_minor) into v_price
  from provider_services ps
  where ps.provider_id = p_provider_id and ps.service_id = p_service_id and ps.is_active;
  if v_price is null then v_price := v_service.base_price_minor; end if;

  v_fee := round(v_price * 0.12); -- REC: 12% customer-side fee for remote-principal category, see docs/10-business-model.md

  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, location_id,
    pricing_model, fulfilment_mode, state, origin,
    currency, service_amount_minor, platform_fee_minor,
    customer_instructions, scheduled_for, contact_phone
  ) values (
    auth.uid(), p_provider_id, p_service_id, v_category_id, p_location_id,
    v_service.pricing_model, v_service.fulfilment_mode, 'requested', 'storefront',
    v_service.currency, v_price, v_fee,
    p_instructions, p_scheduled_for, p_contact_phone
  ) returning id into v_txn_id;

  if v_service.scheduling_mode = 'scheduled' then
    begin
      insert into provider_booked_slots (provider_id, transaction_id, slot_range)
      values (p_provider_id, v_txn_id, tstzrange(p_scheduled_for, v_slot_end, '[)'));
    exception when exclusion_violation then
      raise exception 'That time was just booked by someone else — please pick another slot.';
    end;
  end if;

  -- copy the service's scope items onto the transaction (snapshot at time of booking)
  insert into transaction_scope_items (transaction_id, label, included, sort_order)
  select v_txn_id, label, included, sort_order from service_scope_items where service_id = p_service_id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('service_id', p_service_id, 'provider_id', p_provider_id));

  return v_txn_id;
end $$;

revoke all on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) from public;
revoke execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) from anon;
grant execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Set the personal-chef pilot service to real scheduling — the brief's
-- own named "strongest calendar candidate". A 2-hour default slot.
-- ---------------------------------------------------------------------
update services set scheduling_mode = 'scheduled', slot_duration_minutes = 120
where slug = 'personal-chef';
