-- =====================================================================
-- rpc_get_provider_response_minutes: a REAL "usually responds within
-- X min" stat, computed from actual conversations/messages timestamps
-- now that pre-service messaging exists — not a fabricated number. Only
-- meaningful once a provider has real conversation history; returns
-- null (never a placeholder value) until then, same "honest empty
-- state" discipline as reliability_scores / "No reviews yet".
--
-- SECURITY DEFINER because conversations/messages RLS is participant-
-- only — an anonymous storefront visitor is not a participant in any of
-- this provider's conversations, so a plain client-side query would see
-- nothing. This function only returns an aggregate number, never row
-- content, so it's safe to expose publicly.
-- =====================================================================
create or replace function rpc_get_provider_response_minutes(p_provider_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select round(avg(extract(epoch from (first_reply - first_msg)) / 60))::int
  from (
    select c.id,
      min(m.created_at) filter (where m.sender_id = c.customer_id) as first_msg,
      min(m.created_at) filter (where m.sender_id <> c.customer_id) as first_reply
    from conversations c
    join messages m on m.conversation_id = c.id
    where c.provider_id = p_provider_id
    group by c.id
  ) t
  where first_reply is not null and first_msg is not null and first_reply > first_msg;
$$;

revoke all on function rpc_get_provider_response_minutes(uuid) from public;
grant execute on function rpc_get_provider_response_minutes(uuid) to anon, authenticated;
