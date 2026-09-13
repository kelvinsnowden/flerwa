-- PAY-006 (MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md): assert the
-- ledger's own internal double-entry invariant — every transaction_group
-- (one economic event: a funding, a dispute resolution, a cancellation
-- refund) must have its debits equal its credits, per currency. This has
-- never been checked by anything since ledger_entries was created —
-- identified as the single highest-value, zero-dependency financial-safety
-- gap in the marketplace remediation continuation pass.
--
-- Returns ONLY imbalanced groups — an empty result set means the ledger is
-- healthy. Does not require a connected payment aggregator (PAY-001) to be
-- useful: every ledger entry written so far comes from the manual-payment
-- path (_fund_transaction) and rpc_resolve_dispute/rpc_cancel_booking, all
-- of which already exist and write real ledger rows today.
create or replace function rpc_check_ledger_balance()
returns table(transaction_group uuid, currency char(3), debit_total bigint, credit_total bigint, imbalance_minor bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    le.transaction_group,
    le.currency,
    coalesce(sum(le.amount_minor) filter (where le.direction = 'debit'), 0) as debit_total,
    coalesce(sum(le.amount_minor) filter (where le.direction = 'credit'), 0) as credit_total,
    coalesce(sum(le.amount_minor) filter (where le.direction = 'debit'), 0)
      - coalesce(sum(le.amount_minor) filter (where le.direction = 'credit'), 0) as imbalance_minor
  from ledger_entries le
  group by le.transaction_group, le.currency
  having coalesce(sum(le.amount_minor) filter (where le.direction = 'debit'), 0)
      <> coalesce(sum(le.amount_minor) filter (where le.direction = 'credit'), 0);
$$;

revoke all on function rpc_check_ledger_balance() from public, anon, authenticated;

-- Wrapper the cron route actually calls: runs the check, returns a jsonb
-- summary (imbalance count + full detail) suitable for scheduler_runs.result,
-- following the exact same "record first, log everything" discipline as
-- the auto-approve sweep's own locked wrapper.
create or replace function rpc_run_ledger_reconciliation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_imbalances jsonb;
  v_count integer;
begin
  select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb), count(*)
    into v_imbalances, v_count
    from rpc_check_ledger_balance() b;

  return jsonb_build_object('imbalance_count', v_count, 'imbalances', v_imbalances);
end $$;

revoke all on function rpc_run_ledger_reconciliation() from public, anon, authenticated;
