-- =====================================================================
-- In-app messaging: real-time, transaction-scoped chat between the two
-- actual participants on a booking (customer + assigned provider) — see
-- design-references/mobile/ "Messages" bottom-nav concept (15-messages.png
-- itself is not yet in the repo, so this is built to the same visual/
-- interaction language as the rest of this session's work rather than
-- to a screenshot that doesn't exist here).
--
-- The `messages` table, and its participant read/send RLS policies,
-- already existed from the original MVP build — this migration only
-- fills the gaps that were never finished: a read-receipt column, the
-- append-only guard every other mutable-looking table in this schema
-- has, a recipient-only "mark read" policy, a new-message notification
-- (reusing the existing notifications table/UI, the same pattern every
-- other RPC already uses), and Realtime so the UI updates live.
-- =====================================================================

alter table messages add column read_at timestamptz;

create index if not exists messages_transaction_id_created_at_idx on messages (transaction_id, created_at);
create index if not exists messages_unread_idx on messages (transaction_id) where read_at is null;

-- The only mutation ever allowed on a sent message is the RECIPIENT
-- marking it read — never the sender, never the message content. No
-- DELETE policy exists at all, so RLS denies every delete by default,
-- the same append-only posture as transaction_events/ledger_entries.
create policy "messages mark read" on messages for update
  using (is_txn_participant(transaction_id) and sender_id <> auth.uid())
  with check (is_txn_participant(transaction_id) and sender_id <> auth.uid());

create or replace function trg_guard_message_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.transaction_id is distinct from old.transaction_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Messages are immutable except for read_at.';
  end if;
  return new;
end $$;

create trigger guard_message_mutation before update on messages
  for each row execute function trg_guard_message_mutation();

-- A new message notifies the OTHER participant via the existing
-- notifications table/UI — SECURITY DEFINER because inserting a
-- notification for someone else's user_id is otherwise blocked by RLS
-- (notifications has no direct end-user INSERT policy; every other
-- notification in this schema is written the same way, from inside a
-- trusted function, never directly by a client).
create or replace function trg_notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_provider_user_id uuid;
  v_recipient uuid;
  v_sender_name text;
begin
  select * into v_txn from service_transactions where id = new.transaction_id;
  select user_id into v_provider_user_id from providers where id = v_txn.provider_id;
  v_recipient := case when new.sender_id = v_txn.customer_id then v_provider_user_id else v_txn.customer_id end;

  if v_recipient is not null then
    select coalesce(full_name, 'Someone') into v_sender_name from profiles where id = new.sender_id;
    insert into notifications (user_id, type, title, body, transaction_id)
    values (v_recipient, 'new_message', 'New message from ' || v_sender_name,
            left(new.body, 140), new.transaction_id);
  end if;
  return new;
end $$;

create trigger notify_new_message after insert on messages
  for each row execute function trg_notify_new_message();

-- Enables Supabase Realtime (postgres_changes) subscriptions on this
-- table so the thread UI updates live without polling.
alter publication supabase_realtime add table messages;
