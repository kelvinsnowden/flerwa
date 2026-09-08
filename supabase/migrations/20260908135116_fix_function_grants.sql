-- =====================================================================
-- Correction to migration 20260908090400. That migration's diagnosis was
-- wrong: it revoked EXECUTE from PUBLIC and assumed that closed the gap.
-- It did not. This Supabase project's default privileges grant EXECUTE
-- directly to the `anon` and `authenticated` roles (not just via PUBLIC)
-- on every newly created function — confirmed by querying
-- has_function_privilege() directly after applying migration 4, which
-- showed every rpc_* function still anon-executable despite the
-- "revoke ... from public" statements.
--
-- The correct fix — proven by migration 3's _release_transaction and
-- rpc_run_auto_approve_sweep, which DID close successfully — is to
-- revoke from the named roles (anon, authenticated) directly.
--
-- None of this was a live vulnerability: every rpc_* function performs
-- its own internal auth.uid()/is_admin() check and raises an exception
-- for an unauthorized caller regardless of the grant. This migration is
-- defense-in-depth, closing the grant surface to match intent exactly,
-- per SECURITY.md.
-- =====================================================================

revoke execute on function log_event(uuid, text, txn_state, txn_state, jsonb) from anon, authenticated;
revoke execute on function recompute_reliability(uuid) from anon, authenticated;
revoke execute on function trg_handle_new_user() from anon, authenticated;
revoke execute on function trg_profiles_guard_role() from anon, authenticated;
revoke execute on function trg_block_mutation() from anon, authenticated;
revoke execute on function trg_enforce_quote_cap() from anon, authenticated;

revoke execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) from anon, authenticated;
revoke execute on function rpc_confirm_manual_payment(uuid, text, text) from anon, authenticated;
revoke execute on function rpc_provider_check_in(uuid, numeric, numeric) from anon, authenticated;
revoke execute on function rpc_submit_completion(uuid) from anon, authenticated;
revoke execute on function rpc_approve_and_release(uuid) from anon, authenticated;
revoke execute on function rpc_request_revision(uuid, text) from anon, authenticated;
revoke execute on function rpc_set_verification_status(uuid, verification_status, text) from anon, authenticated;
revoke execute on function rpc_set_category_clearance(uuid, uuid, boolean) from anon, authenticated;

-- Re-grant to authenticated only (never anon) for the functions a signed-in
-- user legitimately calls. Each still performs its own internal check.
grant execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text) to authenticated;
grant execute on function rpc_provider_check_in(uuid, numeric, numeric) to authenticated;
grant execute on function rpc_submit_completion(uuid) to authenticated;
grant execute on function rpc_approve_and_release(uuid) to authenticated;
grant execute on function rpc_request_revision(uuid, text) to authenticated;
grant execute on function rpc_confirm_manual_payment(uuid, text, text) to authenticated;
grant execute on function rpc_set_verification_status(uuid, verification_status, text) to authenticated;
grant execute on function rpc_set_category_clearance(uuid, uuid, boolean) to authenticated;

-- is_admin() and is_txn_participant() are correctly left granted to BOTH
-- anon and authenticated (verified via has_function_privilege) — RLS
-- policies invoke them during policy evaluation for both roles.
