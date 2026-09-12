-- Generic payment-provider and verification-provider registry, plus audit
-- tables for inbound events/checks from whichever real vendor gets
-- connected later (IntaSend, Paystack, Kora, Smile ID, etc.). This does
-- NOT hardcode any one vendor.

create table payment_providers (
  key text primary key,
  display_name text not null,
  kind text not null default 'aggregator' check (kind in ('manual', 'aggregator')),
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references profiles(id),
  connected_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_active_payment_provider on payment_providers ((true)) where is_active;

create table verification_providers (
  key text primary key,
  display_name text not null,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references profiles(id),
  connected_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_active_verification_provider on verification_providers ((true)) where is_active;

insert into payment_providers (key, display_name, kind, is_active, connected_at)
values ('manual', 'Manual (M-Pesa Till/Paybill, admin-confirmed)', 'manual', true, now());

insert into verification_providers (key, display_name, is_active, connected_at)
values ('manual', 'Manual (admin reviews submitted documents)', true, now());

create table payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references payment_providers(key),
  transaction_id uuid references service_transactions(id),
  event_type text not null,
  external_reference text,
  amount_minor bigint,
  currency char(3),
  signature_verified boolean not null,
  raw_payload jsonb not null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now()
);

create index payment_provider_events_txn_idx on payment_provider_events(transaction_id);
create index payment_provider_events_unprocessed_idx on payment_provider_events(processed) where not processed;

create table identity_verification_checks (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references verification_providers(key),
  provider_id uuid not null references providers(id),
  check_type text not null,
  external_reference text,
  status text not null check (status in ('pending', 'passed', 'failed', 'manual_review')),
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index identity_verification_checks_provider_idx on identity_verification_checks(provider_id, created_at desc);

alter table payment_providers enable row level security;
alter table verification_providers enable row level security;
alter table payment_provider_events enable row level security;
alter table identity_verification_checks enable row level security;

create policy "admin can read payment providers" on payment_providers for select using (is_admin());
create policy "admin can read verification providers" on verification_providers for select using (is_admin());
create policy "admin can read payment provider events" on payment_provider_events for select using (is_admin());
create policy "admin can read identity verification checks" on identity_verification_checks for select using (is_admin());
