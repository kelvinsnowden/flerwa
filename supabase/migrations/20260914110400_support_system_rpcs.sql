-- MARKETPLACE_SUPPORT_SYSTEM_PLAN.md Phase 2: every privileged write on
-- the support schema goes through one of these SECURITY DEFINER RPCs —
-- same convention as rpc_start_conversation / rpc_set_active_payment_provider
-- / the admin_actions-logged RPCs throughout this codebase. Application
-- code (server actions) is responsible for rate-limiting the anon-facing
-- entry point (rpc_submit_support_request) via checkRateLimit before
-- calling it, exactly like signup/book_service/post_task/send_message
-- already do — this migration does not rate-limit itself.

-- ---------------------------------------------------------------------
-- rpc_submit_support_request — the only anon-callable write in this
-- schema. Creates a conversation + its first (customer) message and
-- returns a human-readable reference number. If p_related_transaction_id
-- is supplied, it is only trusted when the caller is authenticated AND
-- actually a participant of that transaction — never trusted blind from
-- an anonymous or unrelated caller, so this can't be used to leak or
-- link an arbitrary transaction into someone else's ticket.
-- ---------------------------------------------------------------------
create or replace function rpc_submit_support_request(
  p_email text,
  p_subject text,
  p_body text,
  p_name text default null,
  p_category_id uuid default null,
  p_related_transaction_id uuid default null
) returns table(conversation_id uuid, reference_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_email text;
  v_name text;
  v_txn_id uuid;
  v_reference text;
  v_conversation_id uuid;
  v_attempt int := 0;
begin
  if p_subject is null or btrim(p_subject) = '' then
    raise exception 'Subject is required.';
  end if;
  if length(p_subject) > 200 then
    raise exception 'Subject is too long.';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'Message is required.';
  end if;
  if length(p_body) > 8000 then
    raise exception 'Message is too long.';
  end if;

  if (select auth.uid()) is not null then
    select * into v_profile from profiles where id = (select auth.uid());
    v_email := coalesce(v_profile.email, p_email);
    v_name := coalesce(v_profile.full_name, p_name);
    if p_related_transaction_id is not null and is_txn_participant(p_related_transaction_id) then
      v_txn_id := p_related_transaction_id;
    end if;
  else
    if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'A valid email address is required.';
    end if;
    v_email := p_email;
    v_name := p_name;
  end if;

  -- Short, human-readable, collision-checked reference the customer sees
  -- in the confirmation email and quotes in replies (fallback thread
  -- matching only — the primary match is Message-ID/In-Reply-To).
  loop
    v_attempt := v_attempt + 1;
    v_reference := 'SUP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    -- Table alias required: the RETURNS TABLE OUT parameter of the same
    -- name shadows the bare column reference here (caught live — see
    -- fix_support_request_reference_ambiguity migration).
    exit when not exists (select 1 from support_conversations sc where sc.reference_number = v_reference);
    if v_attempt > 10 then
      raise exception 'Could not generate a unique reference number, try again.';
    end if;
  end loop;

  insert into support_conversations (
    reference_number, subject, category_id, customer_profile_id, customer_email, customer_name, related_transaction_id
  ) values (
    v_reference, btrim(p_subject), p_category_id, (select auth.uid()), v_email, v_name, v_txn_id
  ) returning id into v_conversation_id;

  insert into support_messages (conversation_id, sender_type, sender_id, author_email, author_name, body)
  values (v_conversation_id, 'customer', (select auth.uid()), v_email, v_name, btrim(p_body));

  return query select v_conversation_id, v_reference;
end;
$$;

revoke all on function rpc_submit_support_request(text, text, text, text, uuid, uuid) from public;
grant execute on function rpc_submit_support_request(text, text, text, text, uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- rpc_agent_reply_support_conversation — admin-only (Phase 2: "any admin
-- is a support agent", see plan §8 risk 1). Marks the conversation
-- 'pending' (awaiting the customer) and stamps last_agent_message_at.
-- ---------------------------------------------------------------------
create or replace function rpc_agent_reply_support_conversation(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_message_id uuid;
  v_agent profiles%rowtype;
begin
  if not is_admin() then raise exception 'Only an admin may reply as a support agent.'; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;
  if p_body is null or btrim(p_body) = '' then raise exception 'Reply cannot be empty.'; end if;

  select * into v_agent from profiles where id = (select auth.uid());

  insert into support_messages (conversation_id, sender_type, sender_id, author_email, author_name, body)
  values (p_conversation_id, 'agent', (select auth.uid()), v_agent.email, v_agent.full_name, btrim(p_body))
  returning id into v_message_id;

  update support_conversations
    set status = 'pending', last_agent_message_at = now()
    where id = p_conversation_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values ((select auth.uid()), 'support_agent_reply', 'support_conversations', p_conversation_id, '{}'::jsonb);

  return v_message_id;
end $$;

revoke all on function rpc_agent_reply_support_conversation(uuid, text) from public, anon;
grant execute on function rpc_agent_reply_support_conversation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_add_support_internal_note — admin-only, never customer-visible.
-- ---------------------------------------------------------------------
create or replace function rpc_add_support_internal_note(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_message_id uuid;
  v_agent profiles%rowtype;
begin
  if not is_admin() then raise exception 'Only an admin may add an internal note.'; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;
  if p_body is null or btrim(p_body) = '' then raise exception 'Note cannot be empty.'; end if;

  select * into v_agent from profiles where id = (select auth.uid());

  insert into support_messages (conversation_id, sender_type, sender_id, author_name, body, is_internal_note)
  values (p_conversation_id, 'agent', (select auth.uid()), v_agent.full_name, btrim(p_body), true)
  returning id into v_message_id;

  return v_message_id;
end $$;

revoke all on function rpc_add_support_internal_note(uuid, text) from public, anon;
grant execute on function rpc_add_support_internal_note(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_assign_support_conversation — assignee must itself be an admin
-- (Phase 2's "any admin is a support agent" surrogate for real agent
-- accounts). Pass null to unassign.
-- ---------------------------------------------------------------------
create or replace function rpc_assign_support_conversation(p_conversation_id uuid, p_assignee uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may assign a support conversation.'; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;
  if p_assignee is not null and not exists (select 1 from profiles where id = p_assignee and role = 'admin') then
    raise exception 'Assignee must be an admin.';
  end if;

  update support_conversations set assigned_to = p_assignee where id = p_conversation_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values ((select auth.uid()), 'support_assign', 'support_conversations', p_conversation_id, jsonb_build_object('assignee', p_assignee));
end $$;

revoke all on function rpc_assign_support_conversation(uuid, uuid) from public, anon;
grant execute on function rpc_assign_support_conversation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_set_support_conversation_status — stamps resolved_at/closed_at.
-- ---------------------------------------------------------------------
create or replace function rpc_set_support_conversation_status(p_conversation_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may change a support conversation''s status.'; end if;
  if p_status not in ('open', 'pending', 'resolved', 'closed') then raise exception 'Invalid status %.', p_status; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;

  update support_conversations set
    status = p_status,
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
    closed_at = case when p_status = 'closed' then now() else closed_at end
  where id = p_conversation_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values ((select auth.uid()), 'support_set_status', 'support_conversations', p_conversation_id, jsonb_build_object('status', p_status));
end $$;

revoke all on function rpc_set_support_conversation_status(uuid, text) from public, anon;
grant execute on function rpc_set_support_conversation_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_set_support_conversation_priority
-- ---------------------------------------------------------------------
create or replace function rpc_set_support_conversation_priority(p_conversation_id uuid, p_priority text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may change a support conversation''s priority.'; end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'Invalid priority %.', p_priority; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;

  update support_conversations set priority = p_priority where id = p_conversation_id;
end $$;

revoke all on function rpc_set_support_conversation_priority(uuid, text) from public, anon;
grant execute on function rpc_set_support_conversation_priority(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_set_support_conversation_category
-- ---------------------------------------------------------------------
create or replace function rpc_set_support_conversation_category(p_conversation_id uuid, p_category_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may change a support conversation''s category.'; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;
  if p_category_id is not null and not exists (select 1 from support_categories where id = p_category_id) then
    raise exception 'Unknown category.';
  end if;

  update support_conversations set category_id = p_category_id where id = p_conversation_id;
end $$;

revoke all on function rpc_set_support_conversation_category(uuid, uuid) from public, anon;
grant execute on function rpc_set_support_conversation_category(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_set_support_conversation_tags — replaces the full tag set (a
-- ticket's tags are small in number; replace-in-place is simplest and
-- matches how the admin UI's multi-select will submit them).
-- ---------------------------------------------------------------------
create or replace function rpc_set_support_conversation_tags(p_conversation_id uuid, p_tag_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may change a support conversation''s tags.'; end if;
  if not exists (select 1 from support_conversations where id = p_conversation_id) then
    raise exception 'Conversation not found.';
  end if;

  delete from support_conversation_tags where conversation_id = p_conversation_id;
  insert into support_conversation_tags (conversation_id, tag_id)
    select p_conversation_id, unnest(coalesce(p_tag_ids, array[]::uuid[]));
end $$;

revoke all on function rpc_set_support_conversation_tags(uuid, uuid[]) from public, anon;
grant execute on function rpc_set_support_conversation_tags(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_upsert_support_tag — small helper so the admin UI can create a new
-- tag inline rather than needing a separate tag-management screen first.
-- ---------------------------------------------------------------------
create or replace function rpc_upsert_support_tag(p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then raise exception 'Only an admin may create a support tag.'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'Tag name is required.'; end if;

  insert into support_tags (name) values (btrim(p_name))
    on conflict (name) do update set name = excluded.name
    returning id into v_id;
  return v_id;
end $$;

revoke all on function rpc_upsert_support_tag(text) from public, anon;
grant execute on function rpc_upsert_support_tag(text) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_upsert_support_canned_reply / rpc_delete_support_canned_reply
-- ---------------------------------------------------------------------
create or replace function rpc_upsert_support_canned_reply(
  p_title text, p_body text, p_id uuid default null, p_category_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then raise exception 'Only an admin may manage canned replies.'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title is required.'; end if;
  if p_body is null or btrim(p_body) = '' then raise exception 'Body is required.'; end if;

  if p_id is not null then
    update support_canned_replies
      set title = btrim(p_title), body = btrim(p_body), category_id = p_category_id, updated_at = now()
      where id = p_id
      returning id into v_id;
    if v_id is null then raise exception 'Canned reply not found.'; end if;
  else
    insert into support_canned_replies (title, body, category_id, created_by)
      values (btrim(p_title), btrim(p_body), p_category_id, (select auth.uid()))
      returning id into v_id;
  end if;
  return v_id;
end $$;

revoke all on function rpc_upsert_support_canned_reply(text, text, uuid, uuid) from public, anon;
grant execute on function rpc_upsert_support_canned_reply(text, text, uuid, uuid) to authenticated;

create or replace function rpc_delete_support_canned_reply(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may delete a canned reply.'; end if;
  delete from support_canned_replies where id = p_id;
end $$;

revoke all on function rpc_delete_support_canned_reply(uuid) from public, anon;
grant execute on function rpc_delete_support_canned_reply(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_set_active_notification_channel — same shape as
-- rpc_set_active_payment_provider, but scoped per-kind (deactivating
-- only other channels of the SAME kind, since email and sms are
-- independent — activating an email provider must not touch sms).
-- ---------------------------------------------------------------------
create or replace function rpc_set_active_notification_channel(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_channel notification_channels%rowtype;
begin
  if not is_admin() then raise exception 'Only an admin can change the active notification channel.'; end if;

  select * into v_channel from notification_channels where key = p_key;
  if not found then raise exception 'Unknown notification channel %.', p_key; end if;

  update notification_channels set is_active = false where kind = v_channel.kind and is_active;
  update notification_channels set is_active = true, connected_by = (select auth.uid()), connected_at = now() where key = p_key;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values ((select auth.uid()), 'set_active_notification_channel', 'notification_channels', null, jsonb_build_object('key', p_key, 'kind', v_channel.kind));
end $$;

revoke all on function rpc_set_active_notification_channel(text) from public, anon;
grant execute on function rpc_set_active_notification_channel(text) to authenticated;
