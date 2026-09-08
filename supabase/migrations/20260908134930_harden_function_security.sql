-- =====================================================================
-- Security hardening pass, driven by Supabase security advisors run
-- immediately after migration 3. Two real issues found:
--
-- 1. BUG: `revoke execute ... from anon, authenticated` on
--    _release_transaction/rpc_run_auto_approve_sweep did NOT work,
--    because `create function` grants EXECUTE to PUBLIC by default in
--    Postgres, and PUBLIC is a pseudo-role every other role inherits
--    from — revoking from named roles does not undo a PUBLIC grant.
--    Fix: revoke from PUBLIC explicitly.
--
-- 2. Every SECURITY DEFINER function is, by the same default, callable
--    directly via PostgREST (/rest/v1/rpc/<fn>) by anon AND authenticated,
--    regardless of the internal auth checks each function already
--    performs. The internal checks make this SAFE (an anon caller of
--    rpc_confirm_manual_payment gets 'Only an admin can...' and nothing
--    else happens) but it is not TIDY, and defense-in-depth says the
--    grant surface should match intent exactly. This migration:
--      - revokes EXECUTE from PUBLIC on every function in this schema
--      - re-grants EXECUTE to `authenticated` only on functions a
--        signed-in customer/provider/admin legitimately calls directly
--      - re-grants EXECUTE to `anon, authenticated` ONLY on is_admin()
--        and is_txn_participant(), because RLS policies invoke them as
--        part of policy evaluation for BOTH anon and authenticated
--        queries — revoking there would silently break every policy
--        that references them, not just close an API endpoint.
--      - leaves purely internal functions (log_event, recompute_reliability,
--        trigger functions, _release_transaction, the auto-approve sweep)
--        with NO direct grant to anon or authenticated. Trigger functions
--        do not need one: they run because the trigger fires, not because
--        the DML-issuing role has EXECUTE on them.
-- =====================================================================

-- ---------- fix 1: the actual bug ----------
revoke execute on function _release_transaction(uuid, boolean) from public;
revoke execute on function rpc_run_auto_approve_sweep() from public;

-- ---------- fix 2: search_path pinning (function_search_path_mutable) ----------
-- trg_profiles_guard_role is SECURITY DEFINER and was missing `set search_path`,
-- which is a real search-path-hijacking exposure for a definer function, not
-- just a lint nitpick. The other two are lower risk (not security definer),
-- fixed for consistency.
create or replace function trg_profiles_guard_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only an admin may change a user role.';
    end if;
  end if;
  return new;
end $$;

create or replace function trg_block_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception '% is append-only: % is not permitted', tg_table_name, tg_op;
end $$;

create or replace function trg_enforce_quote_cap() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from quotes where request_id = new.request_id) >= 5 then
    raise exception 'Quote cap reached for this request (max 5).';
  end if;
  return new;
end $$;

-- ---------- fix 3: revoke-then-explicitly-grant on every definer function ----------
revoke execute on function is_admin() from public;
revoke execute on function is_txn_participant(uuid) from public;
revoke execute on function log_event(uuid, text, txn_state, txn_state, jsonb) from public;
revoke execute on function recompute_reliability(uuid) from public;
revoke execute on function trg_handle_new_user() from public;
revoke execute on function trg_profiles_guard_role() from public;
revoke execute on function trg_block_mutation() from public;
revoke execute on function trg_enforce_quote_cap() from public;
revoke execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) from public;
revoke execute on function rpc_confirm_manual_payment(uuid, text, text) from public;
revoke execute on function rpc_provider_check_in(uuid, numeric, numeric) from public;
revoke execute on function rpc_submit_completion(uuid) from public;
revoke execute on function rpc_approve_and_release(uuid) from public;
revoke execute on function rpc_request_revision(uuid, text) from public;
revoke execute on function rpc_set_verification_status(uuid, verification_status, text) from public;
revoke execute on function rpc_set_category_clearance(uuid, uuid, boolean) from public;

-- Required by RLS policy evaluation for BOTH anon and authenticated queries.
grant execute on function is_admin() to anon, authenticated;
grant execute on function is_txn_participant(uuid) to anon, authenticated;
comment on function is_admin() is
  'Called from RLS policies (USING/WITH CHECK clauses) for both anon and authenticated roles. '
  'Must keep EXECUTE granted to both — revoking it does not close an API, it breaks every policy that uses it.';

-- Customer/provider-facing actions: signed-in users only. Each function performs
-- its own internal auth check in addition to this grant (defense in depth).
grant execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) to authenticated;
grant execute on function rpc_provider_check_in(uuid, numeric, numeric) to authenticated;
grant execute on function rpc_submit_completion(uuid) to authenticated;
grant execute on function rpc_approve_and_release(uuid) to authenticated;
grant execute on function rpc_request_revision(uuid, text) to authenticated;

-- Admin-only actions: still signed-in users (admins ARE authenticated users),
-- gated internally by is_admin(). Not granted to anon.
grant execute on function rpc_confirm_manual_payment(uuid, text, text) to authenticated;
grant execute on function rpc_set_verification_status(uuid, verification_status, text) to authenticated;
grant execute on function rpc_set_category_clearance(uuid, uuid, boolean) to authenticated;

-- log_event, recompute_reliability, trg_handle_new_user, trg_profiles_guard_role,
-- trg_block_mutation, trg_enforce_quote_cap, _release_transaction,
-- rpc_run_auto_approve_sweep: intentionally NO grant to anon or authenticated.
-- Trigger functions run via the trigger mechanism regardless of caller grants.
-- The other four are called only from within other SECURITY DEFINER functions
-- (which execute with the function owner's privileges) or from a trusted
-- scheduler using the service role, which bypasses PostgREST grants entirely.
