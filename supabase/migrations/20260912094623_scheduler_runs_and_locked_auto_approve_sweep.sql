-- Durable record of every scheduled-job execution, for the "last success/
-- failure timestamp" and "operational visibility" requirements — ephemeral
-- function logs alone don't survive being queried later from /admin.
create table scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean,
  result jsonb,
  error text
);

create index scheduler_runs_job_name_started_at_idx on scheduler_runs(job_name, started_at desc);

alter table scheduler_runs enable row level security;
create policy "admin can read scheduler runs" on scheduler_runs for select using (is_admin());
-- No insert/update policy for anon/authenticated — writes happen only via
-- the service-role client from the cron Route Handler, same pattern as
-- payment_provider_events.

-- rpc_run_auto_approve_sweep() itself is already safe under overlap by
-- construction (_release_transaction takes each row `for update` and
-- re-checks state before acting — confirmed by reading its body this
-- session), so this wrapper isn't a correctness fix. It exists purely so
-- two overlapping cron invocations (e.g. a slow run plus a retry) don't
-- both do redundant work scanning the same candidate rows — a performance
-- nicety, not a safety requirement, kept separate from the original
-- function so that function's own audited behavior is untouched.
create or replace function rpc_run_auto_approve_sweep_locked() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint := hashtext('auto_approve_sweep')::bigint;
  v_got_lock boolean;
  v_count integer;
begin
  v_got_lock := pg_try_advisory_lock(v_lock_key);
  if not v_got_lock then
    return -1; -- another run is already in progress; caller treats this as a no-op, not an error
  end if;

  begin
    v_count := rpc_run_auto_approve_sweep();
  exception when others then
    perform pg_advisory_unlock(v_lock_key);
    raise;
  end;

  perform pg_advisory_unlock(v_lock_key);
  return v_count;
end $$;

revoke all on function rpc_run_auto_approve_sweep_locked() from public, anon, authenticated;
