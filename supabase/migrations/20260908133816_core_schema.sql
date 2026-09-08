-- =====================================================================
-- Trusted Services Marketplace — core schema
-- One generic service-transaction platform. Verticals are DATA, not code.
-- Money is always amount_minor (BIGINT) + currency. Never floats.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type user_role          as enum ('customer','provider','admin');
create type verification_status as enum ('pending','submitted','under_review','verified','rejected','expired');
create type pricing_model      as enum ('fixed','quote','hourly','recurring','application');
create type fulfilment_mode    as enum ('remote_digital','on_site_customer_present','on_site_customer_absent','at_provider','representation');
create type txn_state          as enum (
  'draft','requested','quoted','quote_accepted','funded','scheduled',
  'en_route','checked_in','in_progress','evidence_submitted','customer_review',
  'revision_requested','approved','released','settled','reviewed','closed',
  'cancelled_by_customer','cancelled_by_provider','expired','disputed','refunded');
create type payment_state      as enum ('unpaid','payment_pending','funded','released','refunded','failed');
create type evidence_type      as enum ('photo','video','document','checklist','geo_checkin','customer_confirmation','file_delivery','note');
create type dispute_state      as enum ('open','under_review','resolved','withdrawn');
create type ledger_account_type as enum ('customer_receivable','funds_held','materials_held','platform_revenue','provider_payable','payment_costs','refunds');

-- ---------- identity ----------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'customer',
  full_name     text,
  phone         text,
  email         text,
  avatar_url    text,
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column profiles.role is 'Only admins may change this. Enforced by trg_profiles_guard_role.';

-- ---------- geography ----------
create table locations (
  id         uuid primary key default gen_random_uuid(),
  country    text not null default 'KE',
  county     text not null,
  town       text not null,
  ward       text,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- catalogue ----------
create table categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  vertical       text not null,          -- remote_principal | business_services | home_services
  description    text,
  icon           text,
  is_active      boolean not null default true,
  requires_clearance boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
comment on column categories.requires_clearance is 'If true a provider must hold provider_categories clearance to be bookable here.';

create table services (
  id                   uuid primary key default gen_random_uuid(),
  category_id          uuid not null references categories(id) on delete restrict,
  slug                 text not null unique,
  name                 text not null,
  summary              text not null,
  description          text,
  pricing_model        pricing_model not null default 'fixed',
  fulfilment_mode      fulfilment_mode not null,
  base_price_minor     bigint not null check (base_price_minor >= 0),
  currency             char(3) not null default 'KES',
  duration_hours       numeric(5,2),
  turnaround_hours     int not null default 48,
  requires_location    boolean not null default true,
  is_active            boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on column services.base_price_minor is 'ASSUMPTION: launch prices are placeholders from the blueprint, editable in admin.';

create table service_scope_items (
  id         uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  label      text not null,
  included   boolean not null default true,
  sort_order int not null default 0
);

create table service_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references services(id) on delete cascade,
  label        text not null,
  help_text    text,
  is_required  boolean not null default true,
  requires_photo boolean not null default false,
  requires_note  boolean not null default false,
  sort_order   int not null default 0
);

-- ---------- providers ----------
create table providers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,
  slug                text not null unique,
  display_name        text not null,
  headline            text,
  bio                 text,
  base_location_id    uuid references locations(id),
  verification_status verification_status not null default 'pending',
  verified_at         timestamptz,
  is_accepting_work   boolean not null default true,
  is_published        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table providers is 'Generic. Category-specific attributes live in provider_categories.attributes, never here.';

create table provider_verifications (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references providers(id) on delete cascade,
  kind          text not null,   -- id_document | selfie | reference | certificate | address
  status        verification_status not null default 'submitted',
  storage_path  text,
  notes         text,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Per-category clearance AND competence. Competence NEVER transfers between categories.
create table provider_categories (
  provider_id     uuid not null references providers(id) on delete cascade,
  category_id     uuid not null references categories(id) on delete cascade,
  is_cleared      boolean not null default false,
  cleared_at      timestamptz,
  cleared_by      uuid references auth.users(id),
  jobs_completed  int not null default 0,
  quality_rating  numeric(3,2),
  competence_score numeric(5,2),
  attributes      jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  primary key (provider_id, category_id)
);
comment on column provider_categories.attributes is 'Category-specific: creator audience/platforms, trade certs. Keeps providers table generic.';

create table provider_services (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null references providers(id) on delete cascade,
  service_id       uuid not null references services(id) on delete cascade,
  price_minor      bigint check (price_minor >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (provider_id, service_id)
);
comment on column provider_services.price_minor is 'NULL = use services.base_price_minor. Server always resolves; client never sends price.';

create table provider_service_areas (
  provider_id uuid not null references providers(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  primary key (provider_id, location_id)
);

-- Portable reliability. One row per provider. Recomputed, never hand-edited.
create table reliability_scores (
  provider_id       uuid primary key references providers(id) on delete cascade,
  jobs_completed    int not null default 0,
  jobs_accepted     int not null default 0,
  completion_rate   numeric(5,2),
  on_time_rate      numeric(5,2),
  cancellation_rate numeric(5,2),
  dispute_count     int not null default 0,
  avg_rating        numeric(3,2),
  score             numeric(5,2),
  sample_size       int not null default 0,
  computed_at       timestamptz not null default now()
);

create index on services (category_id) where is_active;
create index on provider_services (service_id) where is_active;
create index on providers (verification_status) where is_published;
create index on provider_categories (category_id) where is_cleared;
