-- =====================================================================
-- MARKETPLACE-001 Phase 3/7 — demand/search event instrumentation.
-- PROPOSED, NOT APPLIED. Verified via role-simulated, rolled-back SQL
-- against production (see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md for
-- the design rationale). Do not apply without explicit authorization.
--
-- Refines the original Phase 3 sketch in
-- MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md in one way: instead of a raw
-- "anyone can insert" RLS policy, demand_events has NO insert policy at
-- all (default-deny, matching payments/ledger_entries) — the only
-- write path is rpc_log_demand_event, a SECURITY DEFINER function that
-- rate-limits every call via the existing rpc_check_rate_limit
-- primitive before inserting. This is consistent with this session's
-- MARKETPLACE-SECURITY-002/003 finding that direct client writes to a
-- table are a bug class, not just a shape-validation problem — apply
-- the same discipline to a brand-new table from day one rather than
-- proposing a weaker policy and hardening it later.
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
  -- Anonymous correlation, always present. Authenticated user_id only
  -- when the event genuinely needs it — a browsing session should not
  -- force-correlate to an identity.
  session_id         uuid not null,
  user_id            uuid references profiles(id),
  -- What was searched/viewed/booked — all nullable, a given event type
  -- only populates the fields relevant to it.
  search_term        text,
  category_id        uuid references categories(id),
  service_id         uuid references services(id),
  provider_id        uuid references providers(id),
  location_id        uuid references locations(id),
  -- Coarse budget bucket, not a raw amount — avoids leaking a precise
  -- customer budget signal. Values like 'under_1000', '1000_5000', are
  -- defined by the application layer, not enforced here.
  price_range_bucket text,
  result_count       integer,
  -- Correlates a whole funnel (search -> impression -> click -> view ->
  -- booking) without needing to guess from timestamps.
  correlation_id     uuid not null default gen_random_uuid(),
  source_surface     text not null, -- e.g. 'home_search', 'service_detail', 'provider_storefront'
  -- Client-generated idempotency key so a retried request (double
  -- submit, React strict-mode double-invoke, a flaky network retry)
  -- never double-counts.
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
-- No insert policy at all — default-deny for every role. The only
-- write path is rpc_log_demand_event below.
create policy "admin can read demand events" on demand_events
  for select using (is_admin());

comment on table demand_events is
  'Raw, append-only demand/funnel events. PROPOSED, not yet applied. Write: only via rpc_log_demand_event (rate-limited). Read: admin-only via RLS. Retention: intended ~90 days raw (deletion job not yet built, see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md) — aggregates in demand_rollup_daily survive indefinitely since they carry no raw search terms or per-user correlation.';

-- ---------------------------------------------------------------------
-- Write path: rate-limited, SECURITY DEFINER, the only way to insert.
-- Mirrors rpc_check_rate_limit's own identity derivation (auth.uid()
-- when signed in, else the caller-supplied session_id — never used for
-- anything security-sensitive, only to bound event volume per browsing
-- session). A generous but real limit: 120 events per rolling 10-minute
-- window per identity, covering a legitimate, fast-clicking browsing
-- session while bounding a scripted flood.
-- ---------------------------------------------------------------------
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
    -- Fail closed but quiet: analytics is best-effort, a rate-limited
    -- caller should not see a hard error surfaced in the UI. The
    -- calling code treats this as a no-op, not an exception, by
    -- catching it — see src/lib/demand-events.ts.
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

-- ---------------------------------------------------------------------
-- Rollup/aggregation strategy (sketch, not a scheduled job in this
-- proposal — see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md's own
-- caveat: at current near-zero volume, an admin page querying
-- demand_events directly with a bounded time window is not expensive
-- enough to require a rollup table yet. Build this once real volume
-- exists, using the same scheduler_runs + advisory-lock pattern already
-- proven for auto-approve-sweep/ledger-reconciliation/dispute
-- escalation. Table shape kept here for forward compatibility, unused
-- by this pass's admin pages.
-- ---------------------------------------------------------------------
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
  'Daily pre-aggregated demand counts. PROPOSED, not yet applied, and not yet written to by any job — reserved shape for when demand_events volume grows enough to need it.';
