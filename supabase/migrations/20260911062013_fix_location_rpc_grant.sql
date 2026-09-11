-- Same grant-surface gap SECURITY.md §8 already documented and fixed for
-- every other rpc_*: `revoke all ... from public` does not strip the
-- direct per-role grant this project's default privileges apply to `anon`
-- at CREATE FUNCTION time. Confirmed via has_function_privilege('anon', ...)
-- returning true despite the migration's own `revoke all from public`.
-- Not a live vulnerability (the function's own `auth.uid() is null` check
-- already rejects an anonymous caller — verified), but the grant surface
-- should match intent exactly, same standard applied everywhere else.
revoke execute on function rpc_get_or_create_location(text) from anon;
