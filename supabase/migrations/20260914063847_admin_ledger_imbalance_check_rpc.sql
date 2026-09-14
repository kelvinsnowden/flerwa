-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md PAY-C9: rpc_check_ledger_balance
-- (PAY-006) is deliberately granted to postgres/service_role only — it was
-- built for the cron route (src/lib/supabase/admin.ts's service-role
-- client), never an interactive admin session. Rather than widen that
-- grant (it has no is_admin() check of its own — anyone able to invoke it
-- would see raw financial-imbalance data) or start using the service-role
-- client from an interactive page (a real architectural change, not made
-- casually), this adds a thin is_admin()-gated wrapper, matching every
-- other admin-facing RPC in this codebase, so /admin/ledger can show a
-- live imbalance check without touching the cron-only function's grants.
create or replace function rpc_admin_check_ledger_balance()
returns table(transaction_group uuid, currency char(3), debit_total bigint, credit_total bigint, imbalance_minor bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may run the ledger balance check.'; end if;
  return query select * from rpc_check_ledger_balance();
end $$;

revoke execute on function rpc_admin_check_ledger_balance() from public, anon;
grant execute on function rpc_admin_check_ledger_balance() to authenticated;
