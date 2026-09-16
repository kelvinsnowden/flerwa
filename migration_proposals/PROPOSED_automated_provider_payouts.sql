-- =====================================================================
-- Automated provider payouts: a wallet the provider withdraws from,
-- not a push-on-every-release model.
-- PROPOSED, NOT APPLIED. Do not apply without explicit authorization.
--
-- Context: _release_transaction / _release_milestone already move money
-- from funds_held to provider_payable the instant a customer approves
-- (or a milestone fires) — that was already correct and this migration
-- does NOT touch either function. What was missing: no way to actually
-- send that money to the provider's phone. An earlier draft of this
-- proposal auto-queued a payout at every release event (a push model);
-- this version is a pull model instead — provider_payable's running
-- balance already functions as a wallet, so this migration adds a
-- balance function and a withdrawal-request RPC on top of it, rather
-- than hooking into the release path at all. Simpler and touches less:
-- the two release functions are unmodified byte-for-byte from
-- 20260914160000_milestone_payments.sql.
--
-- Reuses every existing pattern this codebase already has for "vendor-
-- agnostic, webhook-confirmed, admin-auditable money movement":
--   - payment_providers' provider-registry + legal-signoff-gate shape
--     (20260911233617_payment_verification_provider_registry.sql,
--     20260913140512_payment_provider_legal_signoff_gate.sql) mirrored
--     here as payout_providers — a SEPARATE table, not a new `kind` on
--     payment_providers, because that table's
--     `one_active_payment_provider` partial unique index assumes only
--     one provider is ever active AT ALL, which is correct for
--     collections but wrong here: the active collection vendor and the
--     active payout vendor are independent choices.
--   - payment_provider_events + rpc_ingest_payment_event's idempotent-
--     webhook-ingestion shape (20260912100758_idempotent_payment_
--     provider_event_ingestion.sql) mirrored as payout_provider_events +
--     rpc_ingest_payout_event.
--   - trg_guard_provider_trust_fields's guard-trigger shape, extended
--     (not duplicated) to also protect the new payout_phone column.
--   - is_hidden-style "an admin can always intervene" via
--     rpc_admin_retry_payout logging to admin_actions.
--
-- Money-safety properties:
--   - A withdrawal can never exceed the provider's actual available
--     balance (wallet_balance_minor: lifetime provider_payable credits
--     minus debits, minus every withdrawal already requested — pending,
--     processing, or paid — so a provider can't request the same money
--     twice while a request is in flight, and a failed request doesn't
--     permanently lock funds since 'failed' isn't subtracted).
--   - destination_phone is snapshotted onto the payouts row at request
--     time — a later payout_phone change can never redirect a request
--     already in flight.
--   - Every payout_phone change (self or admin) is logged to
--     provider_payout_phone_history with old/new value and who changed
--     it — the highest-value fraud vector here is redirecting a payout
--     number right before a withdrawal.
--   - Activating a real payout vendor requires the same explicit legal-
--     signoff gate as activating a collection vendor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- payout_providers: separate registry from payment_providers (see
-- rationale above). Seeded with 'intasend' — the only vendor with a
-- publicly documented outbound M-Pesa payout API among the two already
-- integrated for collections. Pesapal is deliberately NOT seeded here:
-- it is a collections/checkout gateway with no publicly documented
-- outbound disbursement API, so no adapter file claims to speak one —
-- see src/lib/payouts/registry.ts.
-- ---------------------------------------------------------------------
create table payout_providers (
  key                         text primary key,
  display_name                text not null,
  is_active                   boolean not null default false,
  config                      jsonb not null default '{}'::jsonb,
  legal_signoff_confirmed_at  timestamptz,
  legal_signoff_confirmed_by  uuid references auth.users(id),
  legal_signoff_note          text,
  connected_by                uuid references profiles(id),
  connected_at                timestamptz,
  created_at                  timestamptz not null default now()
);
create unique index one_active_payout_provider on payout_providers ((true)) where is_active;

alter table payout_providers enable row level security;
create policy "admin can read payout providers" on payout_providers for select using (is_admin());

insert into payout_providers (key, display_name) values ('intasend', 'IntaSend Payouts');

-- ---------------------------------------------------------------------
-- providers.payout_phone: where withdrawals go. Deliberately NOT auto-
-- populated from profiles.phone (the login/OTP number) — a provider
-- must explicitly confirm a number for RECEIVING money, which may not
-- be the same number, via rpc_set_payout_phone below.
-- ---------------------------------------------------------------------
alter table providers add column payout_phone text;

create table provider_payout_phone_history (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  old_phone    text,
  new_phone    text,
  changed_by   uuid references auth.users(id),
  changed_at   timestamptz not null default now()
);
create index on provider_payout_phone_history (provider_id);

create or replace function trg_log_payout_phone_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.payout_phone is distinct from old.payout_phone then
    insert into provider_payout_phone_history (provider_id, old_phone, new_phone, changed_by)
    values (new.id, old.payout_phone, new.payout_phone, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists log_payout_phone_change on providers;
create trigger log_payout_phone_change
  after update on providers
  for each row execute function trg_log_payout_phone_change();

-- Extend the EXISTING trust-field guard (not a new trigger) so a
-- provider's own blanket self-write policy on `providers` can't be used
-- to bypass rpc_set_payout_phone's validation/audit path.
create or replace function trg_guard_provider_trust_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if coalesce(current_setting('app.bypass_provider_trust_guard', true), 'off') = 'on' then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.user_id is distinct from old.user_id
     or new.id is distinct from old.id
     or new.is_published is distinct from old.is_published
     or new.payout_phone is distinct from old.payout_phone then
    raise exception 'Verification status, publish state, and payout phone can only be changed via their dedicated functions (rpc_set_verification_status / rpc_set_payout_phone).';
  end if;
  return new;
end $$;

create or replace function rpc_set_payout_phone(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_provider_id uuid;
begin
  if p_phone is null or btrim(p_phone) = '' then
    raise exception 'A payout phone number is required.';
  end if;
  -- Expects an already-normalized +254 number (src/lib/phone.ts
  -- normalizeKenyanPhone runs in the server action before this call) —
  -- re-validated here since this function is the real security boundary.
  if p_phone !~ '^\+254[17]\d{8}$' then
    raise exception 'Payout phone must be a normalized Kenyan number, e.g. +254712345678.';
  end if;

  select id into v_provider_id from providers where user_id = auth.uid();
  if v_provider_id is null then raise exception 'You do not have a professional profile yet.'; end if;

  perform set_config('app.bypass_provider_trust_guard', 'on', true);
  update providers set payout_phone = p_phone, updated_at = now() where id = v_provider_id;
end $$;
revoke all on function rpc_set_payout_phone(text) from public, anon;
grant execute on function rpc_set_payout_phone(text) to authenticated;

-- ---------------------------------------------------------------------
-- payouts: withdrawal requests, one row per request. NOT tied to a
-- single service_transactions row — a provider's wallet aggregates
-- earnings across every completed job, and a withdrawal draws against
-- the pooled balance, not one specific release. No INSERT/UPDATE policy
-- for regular users, exactly mirroring `payments` (see
-- 20260908134556_transactions_payments_trust.sql): every write goes
-- through rpc_request_payout, rpc_record_payout_attempt, or
-- rpc_ingest_payout_event — all SECURITY DEFINER, the last two
-- service-role-only.
-- ---------------------------------------------------------------------
create type payout_state as enum ('pending', 'processing', 'paid', 'failed');

create table payouts (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid not null references providers(id),
  amount_minor        bigint not null check (amount_minor > 0),
  currency            char(3) not null default 'KES',
  -- Snapshotted at request time — see money-safety notes above. A later
  -- payout_phone change can never redirect a request already in flight.
  destination_phone   text not null,
  payout_provider_key text,
  state               payout_state not null default 'pending',
  external_reference  text,
  failure_reason      text,
  attempt_count       int not null default 0,
  requested_by        uuid not null references auth.users(id),
  initiated_at        timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on payouts (provider_id);
create index on payouts (state);

alter table payouts enable row level security;
create policy "payouts owner read" on payouts for select
  using (
    exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
    or is_admin()
  );
comment on table payouts is
  'No INSERT/UPDATE policy for regular users. Written only by rpc_request_payout, rpc_record_payout_attempt, and rpc_ingest_payout_event (the last two service-role only) — mirrors payments table lockdown.';

-- ---------------------------------------------------------------------
-- wallet_balance_minor: lifetime provider_payable credits minus debits
-- (a debit happens when a dispute/cancellation claws back an already-
-- released milestone — see 20260914160000_milestone_payments.sql's own
-- comment on reversing only what funds_held actually still holds),
-- minus every withdrawal already requested that hasn't failed (pending/
-- processing/paid all count — 'failed' does not, so a failed attempt
-- never permanently locks funds). Internal helper, not directly callable
-- by the browser — see rpc_get_my_wallet_balance below for the provider-
-- facing wrapper.
-- ---------------------------------------------------------------------
create or replace function wallet_balance_minor(p_provider_id uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select coalesce(sum(case when le.direction = 'credit' then le.amount_minor else -le.amount_minor end), 0)
      from ledger_entries le
      join providers p on p.user_id = le.account_ref
      where le.account_type = 'provider_payable' and p.id = p_provider_id
    ) - (
      select coalesce(sum(amount_minor), 0)
      from payouts
      where provider_id = p_provider_id and state in ('pending', 'processing', 'paid')
    ),
    0
  );
$$;
revoke all on function wallet_balance_minor(uuid) from public, anon, authenticated;

create or replace function rpc_get_my_wallet_balance() returns bigint
language plpgsql stable security definer set search_path = public as $$
declare v_provider_id uuid;
begin
  select id into v_provider_id from providers where user_id = auth.uid();
  if v_provider_id is null then raise exception 'You do not have a professional profile yet.'; end if;
  return wallet_balance_minor(v_provider_id);
end $$;
revoke all on function rpc_get_my_wallet_balance() from public, anon;
grant execute on function rpc_get_my_wallet_balance() to authenticated;

-- ---------------------------------------------------------------------
-- rpc_request_payout: the ONLY way a payouts row is created. Provider-
-- initiated, never automatic on release — this is the "wallet the
-- provider withdraws from" the whole migration is built around.
-- p_amount_minor null means "withdraw everything available".
-- ---------------------------------------------------------------------
create or replace function rpc_request_payout(p_amount_minor bigint default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_provider_id uuid;
  v_phone text;
  v_balance bigint;
  v_amount bigint;
  v_payout_id uuid;
begin
  select id, payout_phone into v_provider_id, v_phone from providers where user_id = auth.uid();
  if v_provider_id is null then raise exception 'You do not have a professional profile yet.'; end if;
  if v_phone is null then raise exception 'Add a payout number before requesting a withdrawal.'; end if;

  v_balance := wallet_balance_minor(v_provider_id);
  v_amount := coalesce(p_amount_minor, v_balance);

  if v_amount <= 0 then raise exception 'Nothing available to withdraw.'; end if;
  if v_amount > v_balance then
    raise exception 'Requested amount exceeds your available balance (% available).', v_balance;
  end if;

  insert into payouts (provider_id, amount_minor, currency, destination_phone, state, requested_by)
  values (v_provider_id, v_amount, 'KES', v_phone, 'pending', auth.uid())
  returning id into v_payout_id;

  return v_payout_id;
end $$;
revoke all on function rpc_request_payout(bigint) from public, anon;
grant execute on function rpc_request_payout(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- rpc_record_payout_attempt: called from the app layer (server action,
-- via the ADMIN client — never a direct authenticated grant) right after
-- it calls the payout vendor's "send money" API, to record whether that
-- HTTP call itself succeeded. This is NOT the same as the payout being
-- paid — vendors confirm actual completion asynchronously via webhook
-- (rpc_ingest_payout_event below). The `where state in ('pending',
-- 'failed')` guard makes this safe to call even if invoked twice.
-- ---------------------------------------------------------------------
create or replace function rpc_record_payout_attempt(
  p_payout_id uuid, p_provider_key text, p_success boolean, p_external_reference text, p_failure_reason text
) returns void language plpgsql security definer set search_path = public as $$
begin
  update payouts set
    payout_provider_key = p_provider_key,
    external_reference = coalesce(p_external_reference, external_reference),
    state = case when p_success then 'processing'::payout_state else 'failed'::payout_state end,
    failure_reason = case when p_success then null else p_failure_reason end,
    attempt_count = attempt_count + 1,
    initiated_at = case when p_success then now() else initiated_at end,
    updated_at = now()
  where id = p_payout_id and state in ('pending', 'failed');
end $$;
revoke all on function rpc_record_payout_attempt(uuid, text, boolean, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- payout_provider_events + rpc_ingest_payout_event: idempotent webhook
-- ingestion, same shape as payment_provider_events / rpc_ingest_
-- payment_event (20260912100758_idempotent_payment_provider_event_
-- ingestion.sql) — dedupe key is (provider_key, external_reference,
-- event_type) for the same reason documented there: a payout's
-- external_reference legitimately carries multiple different
-- event_types over its lifecycle.
-- ---------------------------------------------------------------------
create table payout_provider_events (
  id                  uuid primary key default gen_random_uuid(),
  provider_key        text not null,
  payout_id           uuid references payouts(id),
  event_type          text not null,
  external_reference  text,
  amount_minor        bigint,
  currency            char(3),
  signature_verified  boolean not null,
  raw_payload         jsonb not null default '{}'::jsonb,
  processed           boolean not null default false,
  processing_error    text,
  created_at          timestamptz not null default now()
);
alter table payout_provider_events enable row level security;
create policy "payout_provider_events admin read" on payout_provider_events for select using (is_admin());

create unique index payout_provider_events_dedupe_idx
  on payout_provider_events (provider_key, external_reference, event_type)
  where external_reference is not null and external_reference <> '';

create or replace function rpc_ingest_payout_event(
  p_provider_key text,
  p_event_type text,
  p_payout_id uuid,
  p_external_reference text,
  p_amount_minor bigint,
  p_currency char(3),
  p_signature_verified boolean,
  p_raw_payload jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_payout payouts%rowtype;
  v_error text := null;
begin
  if not p_signature_verified then
    v_error := 'Webhook signature did not verify.';
  elsif p_payout_id is null then
    v_error := 'No payout id resolved from this webhook.';
  else
    select * into v_payout from payouts where id = p_payout_id for update;
    if not found then
      v_error := 'Payout not found.';
    elsif v_payout.state <> 'processing' then
      v_error := format('Payout is in state %s, expected processing.', v_payout.state);
    end if;
  end if;

  insert into payout_provider_events (provider_key, payout_id, event_type, external_reference,
                                       amount_minor, currency, signature_verified, raw_payload,
                                       processed, processing_error)
  values (p_provider_key, p_payout_id, p_event_type, p_external_reference,
          p_amount_minor, p_currency, p_signature_verified, p_raw_payload,
          v_error is null, v_error)
  on conflict (provider_key, external_reference, event_type)
    where external_reference is not null and external_reference <> ''
    do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from payout_provider_events
      where provider_key = p_provider_key and external_reference = p_external_reference and event_type = p_event_type
      order by created_at desc limit 1;
    return v_event_id;
  end if;

  if v_error is null and p_event_type = 'payout.completed' then
    update payouts set state = 'paid', paid_at = now(), updated_at = now() where id = p_payout_id;
    insert into notifications (user_id, type, title, body)
    select user_id, 'payment_released', 'Withdrawal sent', 'Your withdrawal has been sent to your M-Pesa number.'
    from providers where id = v_payout.provider_id;
  elsif v_error is null and p_event_type = 'payout.failed' then
    update payouts set state = 'failed', failure_reason = 'The payout vendor reported this withdrawal failed.', updated_at = now() where id = p_payout_id;
  end if;

  return v_event_id;
end $$;
-- rpc_ingest_payout_event is called ONLY from the payout webhook route
-- handler using the service-role client, never from a browser session —
-- same "purely internal" class as rpc_ingest_payment_event.
revoke all on function rpc_ingest_payout_event(text, text, uuid, text, bigint, char, boolean, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- rpc_admin_retry_payout: the safety valve for a failed withdrawal
-- attempt (vendor HTTP error, vendor-reported failure). Resets to
-- 'pending' so the retry-sweep cron (app-layer, src/app/api/cron/
-- payout-retry-sweep) picks it back up. Every retry is logged to
-- admin_actions with a required reason, same as every other admin
-- money-adjacent action in this codebase.
-- ---------------------------------------------------------------------
create or replace function rpc_admin_retry_payout(p_payout_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can retry a payout.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to retry a payout.';
  end if;
  if not exists (select 1 from payouts where id = p_payout_id and state = 'failed') then
    raise exception 'Only a failed payout can be retried.';
  end if;

  update payouts set state = 'pending', failure_reason = null, updated_at = now() where id = p_payout_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'retry_payout', 'payouts', p_payout_id, jsonb_build_object('reason', p_reason));
end $$;
revoke execute on function rpc_admin_retry_payout(uuid, text) from public, anon;
grant execute on function rpc_admin_retry_payout(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Legal sign-off gate + active-provider toggle for payouts — the exact
-- same shape as payment_providers' equivalent
-- (20260913140512_payment_provider_legal_signoff_gate.sql), because
-- activating automated B2C disbursement is at least as legally
-- significant as activating a collection aggregator (money-transmission/
-- agent-banking regulatory questions), not less.
-- ---------------------------------------------------------------------
create or replace function rpc_confirm_payout_provider_legal_signoff(p_key text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may confirm legal sign-off for a payout provider.'; end if;
  if not exists (select 1 from payout_providers where key = p_key) then
    raise exception 'Unknown payout provider %.', p_key;
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'A note explaining the basis for sign-off is required (e.g. which legal opinion, dated, by whom).';
  end if;

  update payout_providers
    set legal_signoff_confirmed_at = now(), legal_signoff_confirmed_by = auth.uid(), legal_signoff_note = p_note
    where key = p_key;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'confirm_payout_provider_legal_signoff', 'payout_providers', null, jsonb_build_object('key', p_key, 'note', p_note));
end $$;
revoke execute on function rpc_confirm_payout_provider_legal_signoff(text, text) from public, anon;
grant execute on function rpc_confirm_payout_provider_legal_signoff(text, text) to authenticated;

create or replace function rpc_set_active_payout_provider(p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_provider payout_providers%rowtype;
begin
  if not is_admin() then raise exception 'Only an admin can change the active payout provider.'; end if;

  select * into v_provider from payout_providers where key = p_key;
  if not found then raise exception 'Unknown payout provider %.', p_key; end if;

  if v_provider.legal_signoff_confirmed_at is null then
    raise exception
      'Cannot activate payout provider % — legal sign-off not confirmed. Call rpc_confirm_payout_provider_legal_signoff first.',
      p_key;
  end if;

  update payout_providers set is_active = false where is_active;
  update payout_providers set is_active = true, connected_by = auth.uid(), connected_at = now() where key = p_key;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_active_payout_provider', 'payout_providers', null, jsonb_build_object('key', p_key));
end $$;
revoke execute on function rpc_set_active_payout_provider(text) from public, anon;
grant execute on function rpc_set_active_payout_provider(text) to authenticated;
