-- Phase 3.3 (MARKETPLACE_SCALE_READINESS_AUDIT.md / MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md):
-- the inbox page (src/app/messages/page.tsx) previously had to fetch EVERY
-- message the signed-in user had ever sent or received, across every
-- transaction and conversation, just to compute "latest message + unread
-- count per thread" in application code. That read is unbounded — it
-- grows without limit as a user accumulates conversation history, with no
-- LIMIT clause anywhere in the query.
--
-- This denormalizes the latest-message timestamp onto the parent thread
-- (service_transactions / conversations) via a trigger, so the inbox can
-- instead query threads — a set naturally bounded by how many
-- transactions/conversations a user actually has, and now paginable —
-- with only the single latest message embedded per thread, rather than
-- scanning full message history. No existing column, policy, or business
-- rule is changed; this only adds new columns/index/trigger.

alter table service_transactions add column last_message_at timestamptz;
alter table conversations add column last_message_at timestamptz;

create index service_transactions_last_message_at_idx on service_transactions (last_message_at desc nulls last);
create index conversations_last_message_at_idx on conversations (last_message_at desc nulls last);

create or replace function trg_bump_thread_last_message_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.transaction_id is not null then
    update service_transactions set last_message_at = new.created_at where id = new.transaction_id;
  elsif new.conversation_id is not null then
    update conversations set last_message_at = new.created_at where id = new.conversation_id;
  end if;
  return new;
end;
$$;

revoke all on function trg_bump_thread_last_message_at() from public, anon, authenticated;

create trigger bump_thread_last_message_at
  after insert on messages
  for each row execute function trg_bump_thread_last_message_at();
