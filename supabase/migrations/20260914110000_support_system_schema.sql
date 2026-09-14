-- MARKETPLACE_SUPPORT_SYSTEM_PLAN.md Phase 2: core email-first support
-- system schema. Provider-agnostic by explicit instruction — see §4 of
-- that plan and src/lib/notifications/*: nothing here references Resend
-- or any single vendor by name; notification_channels is the same shape
-- as the existing payment_providers registry.
--
-- Anonymity/RLS design decision (plan §6): an anonymous submitter gets NO
-- web view of their own conversation by reference number alone (would be
-- an enumeration hole) — email is their entire interface. A logged-in
-- customer's conversations are scoped by customer_profile_id = auth.uid(),
-- same shape as every other "participant read" policy in this schema.
-- Internal notes (is_internal_note) live in the same table as
-- customer-visible messages (Help Scout's own model) but are excluded
-- from every non-admin read policy.
--
-- No direct insert/update policies on support_conversations/
-- support_messages: every write goes through a SECURITY DEFINER RPC
-- (next migration), same pattern as conversations/rpc_start_conversation.

-- ---------------------------------------------------------------------
-- notification_channels — same shape as payment_providers, deliberately.
-- ---------------------------------------------------------------------
create table notification_channels (
  key            text primary key,
  kind           text not null check (kind in ('email', 'sms')),
  display_name   text not null,
  is_active      boolean not null default false,
  config         jsonb not null default '{}'::jsonb,
  connected_by   uuid references profiles(id),
  connected_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- At most one active channel per kind (email, sms) — not globally one
-- active row, since email and sms are independent channels.
create unique index one_active_notification_channel_per_kind
  on notification_channels (kind) where is_active;

-- Registered adapter, not yet activated: this environment's connected
-- Resend account has zero verified sending domains (see plan §7) — an
-- admin must explicitly activate it once a domain is verified, via
-- rpc_set_active_notification_channel in the next migration.
insert into notification_channels (key, kind, display_name)
values ('resend', 'email', 'Resend (transactional email)');

alter table notification_channels enable row level security;
create policy "notification channels admin read" on notification_channels for select using (is_admin());

-- ---------------------------------------------------------------------
-- support_categories — real marketplace workflows decide the taxonomy
-- later (plan §6 notes this isn't assumed final); seeded with a
-- deliberately small, generic starter set an admin can extend.
-- ---------------------------------------------------------------------
create table support_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into support_categories (name, slug, sort_order) values
  ('Booking issue', 'booking-issue', 1),
  ('Payment issue', 'payment-issue', 2),
  ('Account help', 'account-help', 3),
  ('Trust & safety', 'trust-safety', 4),
  ('Other', 'other', 5);

alter table support_categories enable row level security;
create policy "support categories public read" on support_categories for select using (is_active or is_admin());
create policy "support categories admin write" on support_categories for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- support_conversations
-- ---------------------------------------------------------------------
create table support_conversations (
  id                       uuid primary key default gen_random_uuid(),
  reference_number         text not null unique,
  subject                  text not null,
  status                   text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  priority                 text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  category_id              uuid references support_categories(id),
  channel                  text not null default 'email' check (channel in ('email', 'chat')),
  customer_profile_id      uuid references profiles(id),
  customer_email           text not null,
  customer_name            text,
  related_transaction_id   uuid references service_transactions(id),
  assigned_to              uuid references profiles(id),
  created_at               timestamptz not null default now(),
  last_customer_message_at timestamptz not null default now(),
  last_agent_message_at    timestamptz,
  resolved_at              timestamptz,
  closed_at                timestamptz
);

create index on support_conversations (customer_profile_id) where customer_profile_id is not null;
create index on support_conversations (status, priority, last_customer_message_at desc);
create index on support_conversations (assigned_to) where assigned_to is not null;
create index on support_conversations (related_transaction_id) where related_transaction_id is not null;

alter table support_conversations enable row level security;
create policy "support conversations owner or admin read" on support_conversations
  for select using (customer_profile_id = (select auth.uid()) or is_admin());

-- ---------------------------------------------------------------------
-- support_messages — internal notes live in the same table
-- (is_internal_note), never a separate notes table (Help Scout's model).
-- ---------------------------------------------------------------------
create table support_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references support_conversations(id) on delete cascade,
  sender_type       text not null check (sender_type in ('customer', 'agent', 'system')),
  sender_id         uuid references profiles(id),
  author_email      text,
  author_name       text,
  body              text not null,
  is_internal_note  boolean not null default false,
  email_message_id  text,
  email_in_reply_to text,
  created_at        timestamptz not null default now()
);

create index on support_messages (conversation_id, created_at);
create index support_messages_email_message_id_idx on support_messages (email_message_id) where email_message_id is not null;

alter table support_messages enable row level security;
create policy "support messages owner or admin read" on support_messages
  for select using (
    is_admin()
    or (
      not is_internal_note
      and exists (
        select 1 from support_conversations c
        where c.id = conversation_id and c.customer_profile_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------
-- support_attachments — points at a file in the support-attachments
-- storage bucket (next migration), never stores vendor-hosted URLs.
-- ---------------------------------------------------------------------
create table support_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references support_messages(id) on delete cascade,
  file_path     text not null,
  file_name     text not null,
  content_type  text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

create index on support_attachments (message_id);

alter table support_attachments enable row level security;
create policy "support attachments owner or admin read" on support_attachments
  for select using (
    is_admin()
    or exists (
      select 1 from support_messages m
      join support_conversations c on c.id = m.conversation_id
      where m.id = message_id and not m.is_internal_note and c.customer_profile_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- support_tags — internal taxonomy, admin-only in both directions.
-- ---------------------------------------------------------------------
create table support_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table support_conversation_tags (
  conversation_id  uuid not null references support_conversations(id) on delete cascade,
  tag_id           uuid not null references support_tags(id) on delete cascade,
  primary key (conversation_id, tag_id)
);

alter table support_tags enable row level security;
alter table support_conversation_tags enable row level security;
create policy "support tags admin only" on support_tags for all using (is_admin()) with check (is_admin());
create policy "support conversation tags admin only" on support_conversation_tags for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- support_canned_replies — agent drafting tool, never customer-visible.
-- ---------------------------------------------------------------------
create table support_canned_replies (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  category_id   uuid references support_categories(id),
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table support_canned_replies enable row level security;
create policy "support canned replies admin only" on support_canned_replies for all using (is_admin()) with check (is_admin());
