-- =====================================================================
-- MARKETPLACE-001 — demand_rollup_daily aggregation job.
-- Applied per explicit user authorization. Verified via role-simulated,
-- rolled-back SQL against production before this apply.
--
-- FIX (found while building this job): demand_rollup_daily was created
-- in the demand_events migration
-- (supabase/migrations/20260915143409_marketplace_001_demand_events.sql)
-- with `primary key (day, category_id, location_id)` — Postgres implies
-- NOT NULL on every primary-key column, but a large share of real
-- demand_events rows legitimately have a NULL category_id (e.g.
-- provider_profile_viewed) and/or NULL location_id (search hasn't
-- captured a location at all yet). As designed, the rollup table could
-- never actually store a row for those events. Confirmed live before
-- this apply: demand_rollup_daily had 0 rows (safe to fix; no data
-- migration needed). Fixed here by moving to a surrogate primary key
-- plus `unique nulls not distinct (day, category_id, location_id)`
-- (Postgres 17) so NULL category/location are treated as a normal,
-- de-duplicated grouping value instead of being unrepresentable.
-- =====================================================================

alter table demand_rollup_daily drop constraint demand_rollup_daily_pkey;
alter table demand_rollup_daily add column id uuid primary key default gen_random_uuid();
alter table demand_rollup_daily alter column category_id drop not null;
alter table demand_rollup_daily alter column location_id drop not null;
alter table demand_rollup_daily add constraint demand_rollup_daily_day_category_location_key
  unique nulls not distinct (day, category_id, location_id);

create or replace function rpc_run_demand_rollup(p_day date default (current_date - 1))
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
begin
  with agg as (
    select
      p_day as day,
      category_id,
      location_id,
      count(*) filter (where event_type in ('search_performed', 'search_no_results')) as search_count,
      count(*) filter (where event_type = 'search_no_results') as no_result_count,
      count(*) filter (where event_type = 'booking_created') as booking_count
    from demand_events
    where occurred_at >= p_day::timestamptz and occurred_at < (p_day + 1)::timestamptz
    group by category_id, location_id
  ), upserted as (
    insert into demand_rollup_daily (day, category_id, location_id, search_count, no_result_count, booking_count)
    select day, category_id, location_id, search_count, no_result_count, booking_count from agg
    on conflict (day, category_id, location_id) do update set
      search_count = excluded.search_count,
      no_result_count = excluded.no_result_count,
      booking_count = excluded.booking_count
    returning 1
  )
  select count(*) into v_row_count from upserted;

  return jsonb_build_object('day', p_day, 'rollup_rows', v_row_count);
end $$;

revoke all on function rpc_run_demand_rollup(date) from public, anon, authenticated;

create or replace function rpc_run_demand_rollup_locked(p_day date default (current_date - 1))
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint := hashtext('demand_rollup')::bigint;
  v_got_lock boolean;
  v_result jsonb;
begin
  v_got_lock := pg_try_advisory_lock(v_lock_key);
  if not v_got_lock then
    return jsonb_build_object('skipped', true, 'reason', 'another run already in progress');
  end if;

  begin
    v_result := rpc_run_demand_rollup(p_day);
  exception when others then
    perform pg_advisory_unlock(v_lock_key);
    raise;
  end;

  perform pg_advisory_unlock(v_lock_key);
  return v_result;
end $$;

revoke all on function rpc_run_demand_rollup_locked(date) from public, anon, authenticated;
