-- CRITICAL SECURITY FIX: 20260914120200_dual_control_approvals.sql's own
-- comment claimed "Deliberately no grants on any _execute_* function to
-- anon/authenticated" but never actually issued the revoke — PostgreSQL
-- grants EXECUTE to PUBLIC by default on every new function, so
-- _execute_refund, _execute_suspend_customer, _execute_suspend_provider,
-- and _execute_category_pause have been callable by BOTH anon
-- (unauthenticated) and authenticated directly via
-- /rest/v1/rpc/_execute_<name> since that migration went live — with zero
-- internal authorization check (they trust they're only reached through
-- rpc_decide_admin_action's SECURITY DEFINER chain), completely
-- bypassing both the admin check and the whole GOV-P4 dual-control
-- mechanism those RPCs exist to enforce. Confirmed live via
-- has_function_privilege() before this fix: anon could execute all four.
--
-- Discovered as a side effect of adding _execute_confirm_manual_payment
-- (PAY-004) with the revoke this migration always should have had, and
-- the contrast made the gap on the original four visible in the advisor
-- output immediately.
revoke all on function _execute_refund(jsonb) from public, anon, authenticated;
revoke all on function _execute_suspend_customer(jsonb) from public, anon, authenticated;
revoke all on function _execute_suspend_provider(jsonb) from public, anon, authenticated;
revoke all on function _execute_category_pause(jsonb) from public, anon, authenticated;
