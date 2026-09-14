-- Live-tested rpc_submit_support_request and hit "column reference
-- reference_number is ambiguous" -- the RETURNS TABLE OUT parameter
-- reference_number shadows support_conversations.reference_number inside
-- the function body. Qualify the column reference explicitly. Applied
-- live via mcp__Supabase__apply_migration before this file was written;
-- this file exists so the migration history and the repo agree.
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

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'SUP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
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
