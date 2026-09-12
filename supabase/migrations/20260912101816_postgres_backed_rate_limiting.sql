-- Phase 7 (MARKETPLACE_SCALE_READINESS_AUDIT.md / MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md):
-- a fixed-window rate limiter backed by Postgres (no Redis/external infra
-- needed at this scale). Deliberately keyed server-side, never by a
-- caller-supplied identity string: the function always derives "who" from
-- auth.uid() when a session exists, so an authenticated caller can only
-- ever burn through their OWN bucket, never target another user's —
-- p_anon_key (the only caller-supplied identity signal) is used ONLY when
-- auth.uid() is null, for the small set of pre-auth actions (signup) that
-- have no other identity to key on. p_action/p_max_count/p_window_seconds
-- are always fixed constants chosen by our own server action code, never
-- read from request bodies.
--
-- rate_limit_buckets has no RLS policies at all (default-deny for every
-- role) — the only way to touch it is through this SECURITY DEFINER
-- function, matching the "purely internal, no direct table grants"
-- pattern already used for scheduler_runs and payment_provider_events.

create table rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (bucket_key, window_start)
);

alter table rate_limit_buckets enable row level security;

create or replace function rpc_check_rate_limit(
  p_action text,
  p_max_count integer,
  p_window_seconds integer,
  p_anon_key text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity text;
  v_bucket_key text;
  v_window_start timestamptz;
  v_count integer;
begin
  v_identity := coalesce((select auth.uid())::text, 'ip:' || coalesce(p_anon_key, 'unknown'));
  v_bucket_key := v_identity || ':' || p_action;
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limit_buckets (bucket_key, window_start, count)
  values (v_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start) do update set count = rate_limit_buckets.count + 1
  returning count into v_count;

  -- Self-cleanup, no separate scheduled job needed: on ~1% of calls,
  -- drop buckets whose window closed over a day ago. Buckets are tiny
  -- rows and windows here are all <= 1 hour, so nothing legitimate is
  -- ever this old.
  if random() < 0.01 then
    delete from rate_limit_buckets where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max_count;
end $$;

revoke all on function rpc_check_rate_limit(text, integer, integer, text) from public;
grant execute on function rpc_check_rate_limit(text, integer, integer, text) to anon, authenticated;
