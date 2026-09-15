-- =====================================================================
-- MARKETPLACE-001 Phase 3/7 — demand/search event instrumentation.
-- Applied per explicit user authorization. Verified via role-simulated,
-- rolled-back SQL against production before this apply (see
-- MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md for the design rationale).
--
-- Refines the original Phase 3 sketch: instead of a raw "anyone can
-- insert" RLS policy, demand_events has NO insert policy at all
-- (default-deny, matching payments/ledger_entries) — the only write
-- path is rpc_log_demand_event, a SECURITY DEFINER function that
-- rate-limits every call via the existing rpc_check_rate_limit
-- primitive before inserting.
-- =====================================================================

create type demand_event_type as enum (
  'search_performed',
  'search_no_results',
  'search_results_viewed',
  'provider_impression',
  'provider_profile_viewed',
  'service_viewed',
  'booking_started',
  'booking_created',
  'booking_completed',
  'booking_cancelled',
  'quote_requested',
  'quote_received',
  'quote_accepted',
  'request_created',
  'request_unfulfilled',
  'provider_unavailable',
  'search_abandoned'
);

create table demand_events (
  id                 uuid primary key default gen_random_uuid(),
  event_type         demand_event_type not null,
  occurred_at        timestamptz not null default now(),
  session_id         uuid not null,
  user_id            uuid references profiles(id),
  search_term        text,
  category_id        uuid references categories(id),
  service_id         uuid references services(id),
  provider_id        uuid references providers(id),
  location_id        uuid references locations(id),
  price_range_bucket text,
  result_count       integer,
  correlation_id     uuid not null default gen_random_uuid(),
  source_surface     text not null,
  dedup_key          text,
  metadata           jsonb not null default '{}'::jsonb,
  constraint demand_events_search_term_length check (search_term is null or char_length(search_term) <= 200)
);

create unique index demand_events_dedup_idx on demand_events (dedup_key) where dedup_key is not null;
create index demand_events_type_time_idx on demand_events (event_type, occurred_at desc);
create index demand_events_category_time_idx on demand_events (category_id, occurred_at desc) where category_id is not null;
create index demand_events_location_time_idx on demand_events (location_id, occurred_at desc) where location_id is not null;
create index demand_events_correlation_idx on demand_events (correlation_id);
create index demand_events_session_idx on demand_events (session_id, occurred_at);

alter table demand_events enable row level security;
create policy "admin can read demand events" on demand_events
  for select using (is_admin());

comment on table demand_events is
  'Raw, append-only demand/funnel events. Write: only via rpc_log_demand_event (rate-limited). Read: admin-only via RLS. Retention: intended ~90 days raw (deletion job not yet built, see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md) — aggregates in demand_rollup_daily survive indefinitely since they carry no raw search terms or per-user correlation.';

create or replace function rpc_log_demand_event(
  p_event_type demand_event_type,
  p_session_id uuid,
  p_source_surface text,
  p_category_id uuid default null,
  p_service_id uuid default null,
  p_provider_id uuid default null,
  p_location_id uuid default null,
  p_search_term text default null,
  p_price_range_bucket text default null,
  p_result_count integer default null,
  p_correlation_id uuid default null,
  p_dedup_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_allowed boolean;
begin
  if p_session_id is null then raise exception 'session_id is required.'; end if;
  if p_source_surface is null or btrim(p_source_surface) = '' then raise exception 'source_surface is required.'; end if;

  v_allowed := rpc_check_rate_limit('demand_event', 120, 600, p_session_id::text);
  if not v_allowed then
    raise exception 'Rate limit exceeded for demand event logging.';
  end if;

  insert into demand_events (
    event_type, session_id, user_id, search_term, category_id, service_id,
    provider_id, location_id, price_range_bucket, result_count,
    correlation_id, source_surface, dedup_key, metadata
  ) values (
    p_event_type, p_session_id, auth.uid(), nullif(btrim(coalesce(p_search_term, '')), ''), p_category_id, p_service_id,
    p_provider_id, p_location_id, p_price_range_bucket, p_result_count,
    coalesce(p_correlation_id, gen_random_uuid()), p_source_surface, p_dedup_key, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (dedup_key) where dedup_key is not null
    do nothing
  returning id into v_id;

  if v_id is null and p_dedup_key is not null then
    select id into v_id from demand_events where dedup_key = p_dedup_key;
  end if;

  return v_id;
end $$;

revoke all on function rpc_log_demand_event(demand_event_type, uuid, text, uuid, uuid, uuid, uuid, text, text, integer, uuid, text, jsonb) from public;
grant execute on function rpc_log_demand_event(demand_event_type, uuid, text, uuid, uuid, uuid, uuid, text, text, integer, uuid, text, jsonb) to anon, authenticated;

create table demand_rollup_daily (
  day             date not null,
  category_id     uuid references categories(id),
  location_id     uuid references locations(id),
  search_count    integer not null default 0,
  no_result_count integer not null default 0,
  booking_count   integer not null default 0,
  primary key (day, category_id, location_id)
);
alter table demand_rollup_daily enable row level security;
create policy "admin can read demand rollup" on demand_rollup_daily
  for select using (is_admin());
comment on table demand_rollup_daily is
  'Daily pre-aggregated demand counts. Not yet written to by any job — reserved shape for when demand_events volume grows enough to need it.';
