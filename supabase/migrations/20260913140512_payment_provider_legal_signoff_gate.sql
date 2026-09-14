-- MARKETPLACE_REMEDIATION_REGISTER.md LEGAL-001/002/005/006/008 all block
-- connecting a real payment aggregator (PSP-status opinion, contractor
-- classification, terms/privacy notice, insurance, tax treatment — none
-- resolved). Nothing today stops an admin from calling
-- rpc_set_active_payment_provider('intasend') before any of that exists —
-- is_admin() is the only check. This does not resolve any of those legal
-- questions (that remains a founder/legal decision, tracked in the
-- register); it only makes it impossible to activate a real money-moving
-- aggregator *by accident or without an explicit, separately-logged
-- attestation* that legal sign-off happened. 'manual' (admin-confirmed
-- M-Pesa Till/Paybill) is exempt — it's the already-live, no-new-rail path.
alter table payment_providers
  add column legal_signoff_confirmed_at timestamptz,
  add column legal_signoff_confirmed_by uuid references auth.users(id),
  add column legal_signoff_note text;

create or replace function rpc_confirm_payment_provider_legal_signoff(p_key text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may confirm legal sign-off for a payment provider.'; end if;
  if not exists (select 1 from payment_providers where key = p_key) then
    raise exception 'Unknown payment provider %.', p_key;
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'A note explaining the basis for sign-off is required (e.g. which legal opinion, dated, by whom).';
  end if;

  update payment_providers
    set legal_signoff_confirmed_at = now(),
        legal_signoff_confirmed_by = auth.uid(),
        legal_signoff_note = p_note
    where key = p_key;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'confirm_payment_provider_legal_signoff', 'payment_providers', null,
          jsonb_build_object('key', p_key, 'note', p_note));
end $$;

revoke execute on function rpc_confirm_payment_provider_legal_signoff(text, text) from public, anon;
grant execute on function rpc_confirm_payment_provider_legal_signoff(text, text) to authenticated;

create or replace function rpc_set_active_payment_provider(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_provider payment_providers%rowtype;
begin
  if not is_admin() then raise exception 'Only an admin can change the active payment provider.'; end if;

  select * into v_provider from payment_providers where key = p_key;
  if not found then raise exception 'Unknown payment provider %.', p_key; end if;

  if v_provider.kind = 'aggregator' and v_provider.legal_signoff_confirmed_at is null then
    raise exception
      'Cannot activate aggregator provider % — legal sign-off not confirmed. Call rpc_confirm_payment_provider_legal_signoff first (see MARKETPLACE_REMEDIATION_REGISTER.md LEGAL-001/002/005/006/008).',
      p_key;
  end if;

  update payment_providers set is_active = false where is_active;
  update payment_providers set is_active = true, connected_by = auth.uid(), connected_at = now() where key = p_key;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_active_payment_provider', 'payment_providers', null, jsonb_build_object('key', p_key));
end $$;

revoke execute on function rpc_set_active_payment_provider(text) from public, anon;
grant execute on function rpc_set_active_payment_provider(text) to authenticated;
