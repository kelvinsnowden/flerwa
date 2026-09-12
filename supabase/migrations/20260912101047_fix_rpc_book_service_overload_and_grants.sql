-- CORRECTIVE: the previous migration (idempotent_request_mode_booking)
-- added p_idempotency_key as a new parameter via CREATE OR REPLACE, which
-- in Postgres does not replace a function whose argument LIST changed —
-- it creates a second overload. That left the old 6-arg rpc_book_service
-- callable and unchanged (no idempotency protection), and worse: the new
-- 7-arg overload picked up Postgres's default PUBLIC execute grant on
-- newly created functions, which every role (including anon) inherits —
-- an unintended grant this codebase's own discipline (SECURITY.md §8:
-- match the grant surface to intent exactly) explicitly guards against,
-- caught immediately via a live pg_proc check rather than left in place.
-- Not separately exploitable (the function's own `auth.uid() is null`
-- check still blocks anon from actually booking anything), but it must
-- not persist as-is per rule 3 (never weaken security for performance/
-- convenience, even inadvertently).
--
-- Fix: drop the stale 6-arg overload outright (its only caller,
-- src/app/services/[slug]/actions.ts, is updated in this same commit to
-- always pass the 7th argument), then explicitly restore the exact
-- original grant posture (authenticated only, no anon, no public) on the
-- surviving 7-arg function.

drop function if exists rpc_book_service(uuid, uuid, uuid, timestamptz, text, text);

revoke all on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text, text) from public, anon;
grant execute on function rpc_book_service(uuid, uuid, uuid, timestamptz, text, text, text) to authenticated;
