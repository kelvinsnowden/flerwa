-- Pure performance fix, zero behavior change: wraps every direct auth.uid()
-- call inside these three shared RLS predicate functions as
-- (select auth.uid()), per Supabase's own documented auth_rls_initplan
-- remediation (https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).
-- auth.uid() is STABLE, so it returns the same value for the whole
-- statement either way -- wrapping it in a subquery only changes whether
-- Postgres's planner can treat it as a cached, per-statement value instead
-- of re-invoking it once per row scanned. These three functions are the
-- shared predicate used across most of this schema's RLS policies
-- (messages, service_transactions and others), so this single change
-- benefits every policy that calls them, not just messages -- fixing the
-- highest-leverage subset of the 33 auth_rls_initplan findings without
-- touching each table's own policy text.
create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function is_txn_participant(txn_id uuid) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from service_transactions t
    left join providers p on p.id = t.provider_id
    where t.id = txn_id
      and (t.customer_id = (select auth.uid()) or p.user_id = (select auth.uid()))
  );
$$;

create or replace function is_conversation_participant(conv_id uuid) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from conversations c
    left join providers p on p.id = c.provider_id
    where c.id = conv_id
      and (c.customer_id = (select auth.uid()) or p.user_id = (select auth.uid()))
  );
$$;
