-- Admin → Integrations control center: adds real "last tested" state to
-- the three existing provider registries (payment_providers,
-- verification_providers, notification_channels) instead of the previous
-- binary is_active-only status. Deliberately NOT added to payout_providers
-- — that table's own migration hasn't been applied to production yet (see
-- /admin/payouts and this page's existing "not live yet" branch).
--
-- last_test_ok is nullable on purpose: null means "never tested", distinct
-- from true/false ("tested, and it passed/failed") — the UI needs all
-- three states to show "Not tested yet" honestly rather than guessing.

alter table payment_providers
  add column last_tested_at timestamptz,
  add column last_test_ok boolean,
  add column last_test_error text;

alter table verification_providers
  add column last_tested_at timestamptz,
  add column last_test_ok boolean,
  add column last_test_error text;

alter table notification_channels
  add column last_tested_at timestamptz,
  add column last_test_ok boolean,
  add column last_test_error text;

-- Admin-gated: records the result of a real connectivity check the server
-- already ran against the vendor's API (see src/lib/*/adapters/*.ts
-- testConnection implementations) — this RPC only persists the result,
-- it never performs the check itself. Same is_admin()-checks-itself
-- pattern as rpc_set_active_payment_provider.
create or replace function rpc_record_payment_provider_test(p_key text, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an admin can record a payment provider connection test.'; end if;
  if not exists (select 1 from payment_providers where key = p_key) then
    raise exception 'Unknown payment provider %.', p_key;
  end if;
  update payment_providers
    set last_tested_at = now(), last_test_ok = p_ok, last_test_error = p_error
    where key = p_key;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'test_payment_provider_connection', 'payment_providers', null,
          jsonb_build_object('key', p_key, 'ok', p_ok, 'error', p_error));
end $$;

create or replace function rpc_record_verification_provider_test(p_key text, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an admin can record a verification provider connection test.'; end if;
  if not exists (select 1 from verification_providers where key = p_key) then
    raise exception 'Unknown verification provider %.', p_key;
  end if;
  update verification_providers
    set last_tested_at = now(), last_test_ok = p_ok, last_test_error = p_error
    where key = p_key;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'test_verification_provider_connection', 'verification_providers', null,
          jsonb_build_object('key', p_key, 'ok', p_ok, 'error', p_error));
end $$;

create or replace function rpc_record_notification_channel_test(p_key text, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an admin can record a notification channel connection test.'; end if;
  if not exists (select 1 from notification_channels where key = p_key) then
    raise exception 'Unknown notification channel %.', p_key;
  end if;
  update notification_channels
    set last_tested_at = now(), last_test_ok = p_ok, last_test_error = p_error
    where key = p_key;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'test_notification_channel_connection', 'notification_channels', null,
          jsonb_build_object('key', p_key, 'ok', p_ok, 'error', p_error));
end $$;

revoke all on function rpc_record_payment_provider_test(text, boolean, text) from public, anon;
grant execute on function rpc_record_payment_provider_test(text, boolean, text) to authenticated;
revoke all on function rpc_record_verification_provider_test(text, boolean, text) from public, anon;
grant execute on function rpc_record_verification_provider_test(text, boolean, text) to authenticated;
revoke all on function rpc_record_notification_channel_test(text, boolean, text) from public, anon;
grant execute on function rpc_record_notification_channel_test(text, boolean, text) to authenticated;
