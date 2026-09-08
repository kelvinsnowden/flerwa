-- =====================================================================
-- Trusted Services Marketplace — transaction spine, evidence, payments,
-- ledger, reputation, disputes, messaging.
-- ONE service_transaction table serves every vertical (creator campaign,
-- property inspection, future fundi job) via category_id + enums, not
-- separate tables.
-- =====================================================================

-- ---------- the spine ----------
create table service_transactions (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references auth.users(id),
  provider_id           uuid references providers(id),
  service_id            uuid references services(id),
  category_id           uuid not null references categories(id),
  location_id           uuid references locations(id),

  pricing_model         pricing_model not null default 'fixed',
  fulfilment_mode       fulfilment_mode not null,
  state                 txn_state not null default 'draft',
  origin                text not null default 'storefront', -- storefront|request|deal_desk|admin

  currency              char(3) not null default 'KES',
  service_amount_minor  bigint not null default 0 check (service_amount_minor >= 0),
  materials_amount_minor bigint not null default 0 check (materials_amount_minor >= 0),
  platform_fee_minor    bigint not null default 0 check (platform_fee_minor >= 0),
  total_amount_minor    bigint generated always as
                         (service_amount_minor + materials_amount_minor + platform_fee_minor) stored,

  customer_instructions text,
  scheduled_for         timestamptz,
  address_text          text,          -- masked from provider until funded; see RLS
  contact_phone         text,

  requested_at   timestamptz not null default now(),
  funded_at      timestamptz,
  checked_in_at  timestamptz,
  evidence_at    timestamptz,
  approved_at    timestamptz,
  released_at    timestamptz,
  settled_at     timestamptz,
  closed_at      timestamptz,
  auto_approve_at   timestamptz,   -- evidence_at + 5 days; enforced by function, not trigger magic
  escrow_expires_at timestamptz,   -- funded_at + 60 days

  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table service_transactions is
  'THE spine. A creator campaign, a property inspection, a future plumbing job are all rows here, '
  'differentiated by category_id/pricing_model/fulfilment_mode — never by separate tables.';
comment on column service_transactions.materials_amount_minor is
  'Pass-through. NEVER counted as GMV or platform revenue. See docs/10-business-model.md.';

create index on service_transactions (customer_id);
create index on service_transactions (provider_id);
create index on service_transactions (state);
create index on service_transactions (category_id);

-- ---------- scope: the anti-dispute structure ----------
create table transaction_scope_items (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  label          text not null,
  included       boolean not null default true,
  quantity       int not null default 1,
  acceptance_criterion text,
  sort_order     int not null default 0
);

create table transaction_checklist_results (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       uuid not null references service_transactions(id) on delete cascade,
  checklist_item_id    uuid not null references service_checklist_items(id),
  is_complete          boolean not null default false,
  note                 text,
  completed_by         uuid references auth.users(id),
  completed_at         timestamptz,
  unique (transaction_id, checklist_item_id)
);

-- ---------- evidence ----------
create table transaction_evidence (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references service_transactions(id) on delete cascade,
  checklist_item_id uuid references service_checklist_items(id),
  type             evidence_type not null,
  storage_path     text,             -- private bucket path; signed URL issued server-side
  description      text,
  captured_in_app  boolean not null default false,
  geo_lat          numeric(9,6),
  geo_lng          numeric(9,6),
  geo_accuracy_m   numeric(8,2),
  uploaded_by      uuid not null references auth.users(id),
  created_at       timestamptz not null default now()
);
create index on transaction_evidence (transaction_id);

-- ---------- append-only event log ----------
create table transaction_events (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  event_type     text not null,   -- e.g. service_created, payment_confirmed, evidence_uploaded...
  actor_id       uuid references auth.users(id),
  actor_role     user_role,
  from_state     txn_state,
  to_state       txn_state,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index on transaction_events (transaction_id, created_at);
comment on table transaction_events is 'Append-only. Reputation and analytics are DERIVED from this, never stored as mutable truth.';

-- ---------- payments (provider-agnostic) ----------
create table payments (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  provider_key   text not null default 'manual', -- 'manual' | 'daraja' | future providers
  state          payment_state not null default 'unpaid',
  amount_minor   bigint not null check (amount_minor >= 0),
  currency       char(3) not null default 'KES',
  external_reference text,    -- e.g. M-Pesa receipt number, once a real rail is connected
  confirmed_by   uuid references auth.users(id),  -- admin who confirmed a manual payment; NULL for webhook-confirmed
  confirmed_at   timestamptz,
  released_at    timestamptz,
  refunded_at    timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);
comment on table payments is
  'MVP ships provider_key=manual: customer pays out-of-band, an ADMIN confirms receipt server-side. '
  'This is real and honest. Never mark funded from the browser. See docs/07-payments.md and SECURITY.md.';
create index on payments (transaction_id);

create table payment_events (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references payments(id) on delete cascade,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- double-entry ledger (append-only, enforced below) ----------
create table ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_group uuid not null,       -- groups the balanced set of entries for one economic event
  transaction_id uuid references service_transactions(id),
  account_type   ledger_account_type not null,
  account_ref    uuid,                   -- provider_id or customer user_id, per account_type
  direction      text not null check (direction in ('debit','credit')),
  amount_minor   bigint not null check (amount_minor >= 0),
  currency       char(3) not null default 'KES',
  created_at     timestamptz not null default now()
);
create index on ledger_entries (transaction_group);
create index on ledger_entries (transaction_id);

-- ---------- reviews & reputation ----------
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  reviewer_id    uuid not null references auth.users(id),
  reviewee_id    uuid not null references auth.users(id),
  rating         int not null check (rating between 1 and 5),
  comment        text,
  is_customer_review boolean not null, -- true = customer reviewing provider; false = reverse
  created_at     timestamptz not null default now(),
  unique (transaction_id, reviewer_id)
);
comment on table reviews is 'Only insertable via rpc_submit_review, which requires state=settled|reviewed. See RLS + function.';

-- ---------- disputes ----------
create table disputes (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  opened_by      uuid not null references auth.users(id),
  reason         text not null,
  description    text,
  state          dispute_state not null default 'open',
  resolution     text,
  financial_outcome jsonb,   -- {"provider_minor": x, "customer_refund_minor": y}
  resolved_by    uuid references auth.users(id),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index on disputes (transaction_id);

-- ---------- messaging ----------
create table messages (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id) on delete cascade,
  sender_id      uuid not null references auth.users(id),
  body           text not null,
  created_at     timestamptz not null default now()
);
create index on messages (transaction_id, created_at);

-- ---------- notifications ----------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  type        text not null,
  title       text not null,
  body        text,
  transaction_id uuid references service_transactions(id),
  channel     text not null default 'in_app', -- in_app|email|sms|whatsapp (only in_app live at MVP)
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on notifications (user_id, read_at);

-- ---------- deal desk (provider brings an existing customer) ----------
create table deal_desk_requests (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references providers(id) on delete cascade,
  customer_email  text,
  customer_phone  text,
  description     text not null,
  proposed_amount_minor bigint,
  state           text not null default 'pending', -- pending|invited|converted|declined
  transaction_id  uuid references service_transactions(id),
  created_at      timestamptz not null default now()
);

-- ---------- structured service requests (Post-a-Task, capped at 5 quotes) ----------
create table service_requests (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references auth.users(id),
  category_id   uuid not null references categories(id),
  location_id   uuid references locations(id),
  title         text not null,
  description   text not null,
  budget_hint_minor bigint,
  state         text not null default 'open', -- open|quoted|awarded|expired|cancelled
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

create table quotes (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references service_requests(id) on delete cascade,
  provider_id    uuid not null references providers(id) on delete cascade,
  amount_minor   bigint not null check (amount_minor >= 0),
  message        text,
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  state          text not null default 'pending', -- pending|accepted|declined|expired
  created_at     timestamptz not null default now(),
  unique (request_id, provider_id)
);
comment on table quotes is 'Capped at 5 quotes per request by rpc_submit_quote. Never charge providers to quote.';

-- Enforce max 5 quotes per request at the database level, not just app logic.
create or replace function trg_enforce_quote_cap() returns trigger
language plpgsql as $$
begin
  if (select count(*) from quotes where request_id = new.request_id) >= 5 then
    raise exception 'Quote cap reached for this request (max 5).';
  end if;
  return new;
end $$;
create trigger enforce_quote_cap before insert on quotes
  for each row execute function trg_enforce_quote_cap();

create table saved_providers (
  customer_id uuid not null references auth.users(id),
  provider_id uuid not null references providers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, provider_id)
);

-- ---------- audit ----------
create table admin_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id),
  action      text not null,
  target_table text,
  target_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- APPEND-ONLY ENFORCEMENT
-- =====================================================================
create or replace function trg_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: % is not permitted', tg_table_name, tg_op;
end $$;

create trigger ledger_entries_append_only
  before update or delete on ledger_entries
  for each row execute function trg_block_mutation();

create trigger transaction_events_append_only
  before update or delete on transaction_events
  for each row execute function trg_block_mutation();

-- =====================================================================
-- ROLE GUARD: a user cannot self-promote to admin/provider-privileged role
-- =====================================================================
create or replace function trg_profiles_guard_role() returns trigger
language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only an admin may change a user role.';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on profiles
  for each row execute function trg_profiles_guard_role();

-- new user -> profile row, defaulting to 'customer'. Never trusts client-supplied role.
create or replace function trg_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function trg_handle_new_user();
