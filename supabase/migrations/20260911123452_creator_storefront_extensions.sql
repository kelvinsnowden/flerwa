-- =====================================================================
-- Generic, reusable extensions that happen to make a content-creator
-- storefront look right — same architecture for every provider type,
-- per the brief's own "polish the pilots without per-service
-- architectures" instruction. Nothing here is content-creator-specific
-- code; it's all real, optional, provider- or admin-authored data any
-- provider can use.
-- =====================================================================

-- services.icon: admin-curated, same precedent as categories.icon —
-- lets the "what I offer" quick-chip row on a storefront show a
-- per-SERVICE icon (a chef and a content creator both sell several
-- distinct services under one category; category.icon alone can't
-- distinguish them).
alter table services add column icon text;
update services set icon = 'video' where slug = 'content-creator-session';

-- portfolio items: optional, self-reported fields. reach_label is
-- explicitly free text the PROVIDER types in (like experience_summary),
-- never a platform-computed number — we have no real analytics
-- integration, so never fabricate "125K views" ourselves.
alter table provider_portfolio_items add column media_type text not null default 'image'
  check (media_type in ('image', 'video'));
alter table provider_portfolio_items add column video_url text;
alter table provider_portfolio_items add column reach_label text;
alter table provider_portfolio_items add column tag text;

-- providers.storefront_tagline: optional, self-authored short CTA line
-- (e.g. "Let's create something amazing") — any provider can set one,
-- not hardcoded per vertical.
alter table providers add column storefront_tagline text;

-- provider_faqs: generic Q&A list any provider can author about their
-- own services. Same self-write RLS pattern as
-- provider_availability_rules / provider_portfolio_items.
create table provider_faqs (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  question     text not null,
  answer       text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on provider_faqs (provider_id, sort_order);

alter table provider_faqs enable row level security;
create policy "faqs public read" on provider_faqs for select using (true);
create policy "faqs self write" on provider_faqs
  for all using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin());
