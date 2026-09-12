-- messages serves two message "kinds" in one table (transaction-scoped and
-- conversation-scoped -- a row has transaction_id XOR conversation_id,
-- never both), which is why 6 policies existed: a SELECT/INSERT/UPDATE
-- pair for each kind. Supabase's advisor counts this as 15 of its 105
-- multiple_permissive_policies findings, because for every action Postgres
-- must evaluate AND OR together both policies' quals per row, even though
-- a given row can only ever match one of the two kinds.
--
-- This merges each pair into ONE policy whose qual is the OR of both
-- original quals -- mathematically identical to what Postgres already
-- computes today (an OR of two permissive policies IS a single policy
-- with an ORed qual), just evaluated once instead of via two separate
-- policy objects. Zero access-semantics change. auth.uid() calls that
-- appear directly in these policies (the sender_id comparisons) are also
-- wrapped as (select auth.uid()) per the same initplan fix as the
-- previous migration.
--
-- Before/after equivalence verified via role-simulated SQL in this
-- session for: an unrelated authenticated user (blocked from both kinds),
-- a transaction participant (full access to their transaction thread,
-- no access to unrelated conversation threads), a conversation
-- participant (same, reversed), and admin (read access to both kinds).
-- See MARKETPLACE_SCALE_READINESS_AUDIT.md's implementation-status
-- section for the recorded results.

drop policy "messages conversation mark read" on messages;
drop policy "messages conversation participant send" on messages;
drop policy "messages conversation participants read" on messages;
drop policy "messages mark read" on messages;
drop policy "messages participant send" on messages;
drop policy "messages participants read" on messages;

create policy "messages participants read" on messages
  for select
  using (
    (transaction_id is not null and (is_txn_participant(transaction_id) or is_admin()))
    or (conversation_id is not null and (is_conversation_participant(conversation_id) or is_admin()))
  );

create policy "messages participant send" on messages
  for insert
  with check (
    sender_id = (select auth.uid())
    and (
      (transaction_id is not null and is_txn_participant(transaction_id))
      or (conversation_id is not null and is_conversation_participant(conversation_id))
    )
  );

create policy "messages mark read" on messages
  for update
  using (
    sender_id <> (select auth.uid())
    and (
      (transaction_id is not null and is_txn_participant(transaction_id))
      or (conversation_id is not null and is_conversation_participant(conversation_id))
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and (
      (transaction_id is not null and is_txn_participant(transaction_id))
      or (conversation_id is not null and is_conversation_participant(conversation_id))
    )
  );
