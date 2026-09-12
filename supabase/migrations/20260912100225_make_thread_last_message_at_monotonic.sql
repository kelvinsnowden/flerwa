-- Defensive hardening of trg_bump_thread_last_message_at (just applied in
-- denormalize_thread_last_message_at): use GREATEST so an out-of-order
-- insert (e.g. a future backfill/import job inserting older messages
-- after newer ones) can never regress last_message_at backward, which
-- would make an active thread wrongly drop out of the bounded/paginated
-- inbox ordering. No behavior change for the normal case (messages
-- inserted in real time, created_at = now()).
create or replace function trg_bump_thread_last_message_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.transaction_id is not null then
    update service_transactions
      set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
      where id = new.transaction_id;
  elsif new.conversation_id is not null then
    update conversations
      set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
      where id = new.conversation_id;
  end if;
  return new;
end;
$$;
