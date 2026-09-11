-- Pre-service conversations. Confirmed by grep across every migration
-- that no such concept exists yet: `messages.transaction_id` is `not
-- null`, so a customer has never been able to message a professional
-- before a transaction exists. This is additive, not a rewrite of
-- messaging: existing transaction-scoped messages, their RLS policies,
-- their notification trigger, and their route are untouched. A
-- conversation optionally links to a transaction later (for cross-
-- reference), but the transaction keeps its own existing message
-- thread — this migration does not merge the two.

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references auth.users(id),
  provider_id     uuid not null references providers(id) on delete cascade,
  service_id      uuid references services(id),
  transaction_id  uuid references service_transactions(id),
  requested_date  date,
  requested_time  time,
  state           text not null default 'open' check (state in ('open', 'converted', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One pre-service thread per (customer, professional) pair — tapping
  -- "Message" again from a different service reuses the same thread and
  -- just updates its context fields, matching how a real conversation
  -- works (one ongoing chat, not one thread per topic).
  unique (customer_id, provider_id)
);
create index on conversations (provider_id);

alter table conversations enable row level security;

create policy "conversations participants read" on conversations
  for select using (
    customer_id = auth.uid()
    or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
    or is_admin()
  );
-- No direct insert/update policy: every write goes through
-- rpc_start_conversation (SECURITY DEFINER), same pattern as
-- provider_categories/rpc_set_provider_category.

-- ---------------------------------------------------------------------
-- messages: add the alternate scope, alongside the existing one
-- ---------------------------------------------------------------------
alter table messages add column conversation_id uuid references conversations(id) on delete cascade;
alter table messages alter column transaction_id drop not null;
alter table messages add constraint messages_scope_check check (
  (transaction_id is not null and conversation_id is null) or
  (transaction_id is null and conversation_id is not null)
);
create index on messages (conversation_id, created_at);

create or replace function is_conversation_participant(conv_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from conversations c
    left join providers p on p.id = c.provider_id
    where c.id = conv_id
      and (c.customer_id = auth.uid() or p.user_id = auth.uid())
  );
$$;
revoke all on function is_conversation_participant(uuid) from public;
grant execute on function is_conversation_participant(uuid) to anon, authenticated;

-- Additional, purely additive permissive policies — Postgres OR-combines
-- multiple permissive policies for the same command, so the existing
-- "messages participants read"/"messages participant send" policies
-- (transaction-scoped) are completely untouched by these.
create policy "messages conversation participants read" on messages
  for select using (conversation_id is not null and (is_conversation_participant(conversation_id) or is_admin()));
create policy "messages conversation participant send" on messages
  for insert with check (
    conversation_id is not null and sender_id = auth.uid() and is_conversation_participant(conversation_id)
  );
create policy "messages conversation mark read" on messages for update
  using (conversation_id is not null and is_conversation_participant(conversation_id) and sender_id <> auth.uid())
  with check (conversation_id is not null and is_conversation_participant(conversation_id) and sender_id <> auth.uid());

-- Extend the existing immutability guard to also protect conversation_id
-- (the original only listed transaction_id/sender_id/body/created_at).
create or replace function trg_guard_message_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.transaction_id is distinct from old.transaction_id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Messages are immutable except for read_at.';
  end if;
  return new;
end $$;

-- Extend the existing new-message notifier to also handle
-- conversation-scoped messages, branching on which FK is set.
create or replace function trg_notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_conv conversations%rowtype;
  v_provider_user_id uuid;
  v_recipient uuid;
  v_sender_name text;
begin
  if new.transaction_id is not null then
    select * into v_txn from service_transactions where id = new.transaction_id;
    select user_id into v_provider_user_id from providers where id = v_txn.provider_id;
    v_recipient := case when new.sender_id = v_txn.customer_id then v_provider_user_id else v_txn.customer_id end;
  else
    select * into v_conv from conversations where id = new.conversation_id;
    select user_id into v_provider_user_id from providers where id = v_conv.provider_id;
    v_recipient := case when new.sender_id = v_conv.customer_id then v_provider_user_id else v_conv.customer_id end;
  end if;

  if v_recipient is not null then
    select coalesce(full_name, 'Someone') into v_sender_name from profiles where id = new.sender_id;
    insert into notifications (user_id, type, title, body, transaction_id)
    values (v_recipient, 'new_message', 'New message from ' || v_sender_name,
            left(new.body, 140), new.transaction_id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- rpc_start_conversation — the only way to create a conversation or its
-- first message. Reuses an existing conversation with this professional
-- rather than spawning a duplicate thread; updates its context fields
-- (service/requested date/time) if new ones are supplied.
-- ---------------------------------------------------------------------
create or replace function rpc_start_conversation(
  p_provider_id uuid,
  p_message text,
  p_service_id uuid default null,
  p_requested_date date default null,
  p_requested_time time default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_user_id uuid;
  v_conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized.';
  end if;
  if p_message is null or trim(p_message) = '' then
    raise exception 'Message cannot be empty.';
  end if;
  if length(p_message) > 2000 then
    raise exception 'Message is too long.';
  end if;

  select user_id into v_provider_user_id from providers where id = p_provider_id;
  if v_provider_user_id is null then
    raise exception 'Professional not found.';
  end if;
  if v_provider_user_id = auth.uid() then
    raise exception 'You cannot message yourself.';
  end if;

  select id into v_conv_id from conversations
    where customer_id = auth.uid() and provider_id = p_provider_id
    for update;

  if v_conv_id is null then
    insert into conversations (customer_id, provider_id, service_id, requested_date, requested_time)
    values (auth.uid(), p_provider_id, p_service_id, p_requested_date, p_requested_time)
    returning id into v_conv_id;
  else
    update conversations
      set service_id = coalesce(p_service_id, service_id),
          requested_date = coalesce(p_requested_date, requested_date),
          requested_time = coalesce(p_requested_time, requested_time),
          updated_at = now()
      where id = v_conv_id;
  end if;

  insert into messages (conversation_id, sender_id, body)
  values (v_conv_id, auth.uid(), trim(p_message));

  return v_conv_id;
end;
$$;

revoke all on function rpc_start_conversation(uuid, text, uuid, date, time) from public;
revoke execute on function rpc_start_conversation(uuid, text, uuid, date, time) from anon;
grant execute on function rpc_start_conversation(uuid, text, uuid, date, time) to authenticated;
