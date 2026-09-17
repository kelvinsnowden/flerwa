-- Public, read-only availability check — callable before a session exists
-- (signup) as well as by a signed-in user editing their own username
-- (account settings). Reveals only whether a specific candidate string is
-- taken, nothing else — no more sensitive than what's already visible on
-- any live storefront URL.
create or replace function public.rpc_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from profiles where username = lower(trim(p_username))
  );
$$;

revoke all on function rpc_username_available(text) from public;
grant execute on function rpc_username_available(text) to anon, authenticated;

-- Lets signup set a username at account-creation time (previously only
-- settable later from /account, easy to never notice). Live availability
-- checking on the signup form (rpc_username_available above) should catch
-- a collision before submission, but two people can still race for the
-- same exact string in the same instant — never let that block account
-- creation itself. On either a uniqueness or format-CHECK violation, the
-- profile is created with username left null, exactly as if the field had
-- been left blank; the person can set one later from /account.
create or replace function public.trg_handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_username text := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
begin
  begin
    insert into public.profiles (id, email, full_name, phone, username)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.phone, v_username);
  exception when unique_violation or check_violation then
    insert into public.profiles (id, email, full_name, phone, username)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.phone, null);
  end;
  return new;
end
$function$;
