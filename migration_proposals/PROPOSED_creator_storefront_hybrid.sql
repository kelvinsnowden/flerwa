-- =====================================================================
-- Hybrid creator storefront (Option C) — native portfolio extensions +
-- creator-authorized social proof (Instagram/TikTok).
-- PROPOSED, NOT APPLIED. Do not apply without explicit authorization.
--
-- Design notes:
-- - Reuses the existing self-authored, no-fabricated-metrics discipline
--   already established for provider_portfolio_items (tag, reach_label)
--   — nothing here computes a number the platform doesn't actually have.
-- - Visibility/moderation uses the SAME idiom as reviews.is_hidden
--   (supabase/migrations/20260914100517_review_moderation.sql): a
--   provider-controlled is_public flag plus an admin-only is_hidden
--   flag, narrowed RLS, and a dedicated rpc_admin_set_*_hidden function
--   that logs to admin_actions — not a new pattern invented for this.
-- - The is_hidden guard trigger mirrors trg_guard_provider_trust_fields's
--   exact shape (admin-only or bypass-flag), so a provider's own
--   blanket self-write policy can't be used to silently un-hide
--   moderated content.
-- =====================================================================

-- ---------------------------------------------------------------------
-- provider_portfolio_items: category/ownership/moderation metadata the
-- hybrid storefront needs. photo_url remains the thumbnail for both
-- images and native videos (existing NOT NULL invariant kept — no new
-- thumbnail_url column, avoiding an unnecessary field).
-- ---------------------------------------------------------------------
alter table provider_portfolio_items add column project_type text;
alter table provider_portfolio_items add column client_name text;
alter table provider_portfolio_items add column is_public boolean not null default true;
alter table provider_portfolio_items add column is_hidden boolean not null default false;
alter table provider_portfolio_items add column is_featured boolean not null default false;
-- Existing rows are self-uploaded original work under the platform's
-- current (undocumented) assumption; true is the correct backfill.
-- New uploads still require the provider to check a rights confirmation
-- box in the UI before the item can be saved.
alter table provider_portfolio_items add column rights_confirmed boolean not null default true;
-- Distinguishes a native, platform-hosted video (played in-app) from
-- the existing external-video-link behavior (opened on the origin
-- platform) — needed so the media viewer knows whether to render an
-- in-app <video> player or an external-link card. Existing video_url
-- rows are backfilled as 'external' since none are natively hosted today.
alter table provider_portfolio_items add column video_source text
  check (video_source in ('native', 'external'));
update provider_portfolio_items set video_source = 'external' where media_type = 'video' and video_url is not null;

drop policy "portfolio items public read" on provider_portfolio_items;
create policy "portfolio items public read" on provider_portfolio_items for select
  using (
    (is_public and not is_hidden)
    or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
    or is_admin()
  );

create or replace function trg_guard_portfolio_moderation() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if coalesce(current_setting('app.bypass_provider_trust_guard', true), 'off') = 'on' then
    return new;
  end if;
  if new.is_hidden is distinct from old.is_hidden then
    raise exception 'Only an admin can hide or unhide a portfolio item.';
  end if;
  return new;
end $$;

drop trigger if exists guard_portfolio_moderation on provider_portfolio_items;
create trigger guard_portfolio_moderation
  before update on provider_portfolio_items
  for each row execute function trg_guard_portfolio_moderation();

create or replace function rpc_admin_set_portfolio_item_hidden(p_item_id uuid, p_hidden boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can hide or unhide a portfolio item.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to hide or unhide a portfolio item.';
  end if;
  if not exists (select 1 from provider_portfolio_items where id = p_item_id) then
    raise exception 'Portfolio item not found.';
  end if;

  update provider_portfolio_items set is_hidden = p_hidden where id = p_item_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_portfolio_item_hidden', 'provider_portfolio_items', p_item_id,
          jsonb_build_object('hidden', p_hidden, 'reason', p_reason));
end $$;

revoke execute on function rpc_admin_set_portfolio_item_hidden(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_portfolio_item_hidden(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- provider_social_highlights: creator-authorized Instagram/TikTok
-- content. No thumbnail_url — this platform does not scrape or mirror
-- social content, so it has no legitimate way to obtain a real
-- thumbnail image; the UI renders a labeled fallback card instead (see
-- src/components/social/social-highlight-card.tsx). post_url is
-- validated and normalized server-side against an allowed-hostname list
-- per platform (src/lib/social-embed.ts) — the CHECK constraint below
-- only guards the coarse platform enum, not the URL shape itself, which
-- needs real parsing logic a CHECK constraint can't express safely.
-- ---------------------------------------------------------------------
create type social_highlight_platform as enum ('instagram', 'tiktok');

create table provider_social_highlights (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null references providers(id) on delete cascade,
  platform         social_highlight_platform not null,
  post_url         text not null,
  title            text,
  sort_order       int not null default 0,
  is_public        boolean not null default true,
  is_hidden        boolean not null default false,
  -- Required true to insert — the provider is explicitly confirming they
  -- have the right to share this link as their own work.
  rights_confirmed boolean not null,
  created_at       timestamptz not null default now()
);
create index on provider_social_highlights (provider_id, sort_order);

alter table provider_social_highlights enable row level security;
create policy "social highlights public read" on provider_social_highlights for select
  using (
    (is_public and not is_hidden)
    or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
    or is_admin()
  );
create policy "social highlights self write" on provider_social_highlights
  for all
  using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (
    (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) and rights_confirmed)
    or is_admin()
  );

create or replace function trg_guard_social_highlight_moderation() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if coalesce(current_setting('app.bypass_provider_trust_guard', true), 'off') = 'on' then
    return new;
  end if;
  if new.is_hidden is distinct from old.is_hidden then
    raise exception 'Only an admin can hide or unhide a social highlight.';
  end if;
  return new;
end $$;

drop trigger if exists guard_social_highlight_moderation on provider_social_highlights;
create trigger guard_social_highlight_moderation
  before update on provider_social_highlights
  for each row execute function trg_guard_social_highlight_moderation();

create or replace function rpc_admin_set_social_highlight_hidden(p_highlight_id uuid, p_hidden boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can hide or unhide a social highlight.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to hide or unhide a social highlight.';
  end if;
  if not exists (select 1 from provider_social_highlights where id = p_highlight_id) then
    raise exception 'Social highlight not found.';
  end if;

  update provider_social_highlights set is_hidden = p_hidden where id = p_highlight_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_social_highlight_hidden', 'provider_social_highlights', p_highlight_id,
          jsonb_build_object('hidden', p_hidden, 'reason', p_reason));
end $$;

revoke execute on function rpc_admin_set_social_highlight_hidden(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_social_highlight_hidden(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: allow native video uploads for portfolio items. Images stay
-- capped at 8MB client-side (unchanged); the bucket-wide limit is
-- raised to accommodate short native video clips. No server-side
-- transcoding/thumbnail generation is introduced — browsers play
-- uploaded mp4/webm/mov directly, with the existing required photo_url
-- serving as the poster/thumbnail, same as today's external-video items.
-- ---------------------------------------------------------------------
update storage.buckets
  set allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'],
      file_size_limit = 52428800 -- 50MB
  where id = 'provider-portfolio';

-- ---------------------------------------------------------------------
-- Reporting: let a customer flag a specific portfolio item or social
-- highlight through the existing report/flag mechanism
-- (supabase/migrations/20260915110000_tsf007_report_flag_mechanism.sql)
-- rather than only being able to report the provider's whole profile.
-- ---------------------------------------------------------------------
alter type report_target_type add value if not exists 'portfolio_item';
alter type report_target_type add value if not exists 'social_highlight';

-- IMPORTANT: can_report_target's extension to reference these two new
-- enum values is intentionally NOT in this file. Verified live (rolled
-- back) against production on 2026-09-15: Postgres rejects referencing a
-- brand-new enum value anywhere in the SAME transaction that added it —
-- "unsafe use of new value... New enum values must be committed before
-- they can be used" — even from a separate, later statement. (An earlier
-- draft of this proposal assumed the Postgres 12+ "later statement, same
-- transaction" exception would cover this; live testing disproved that
-- for this exact shape — a CASE expression comparing against the new
-- value inside a new CREATE FUNCTION body.) The can_report_target update
-- is therefore a separate file — see
-- PROPOSED_creator_storefront_hybrid_part2_report_target.sql — to be
-- applied in its own transaction strictly after this file's ALTER TYPE
-- statements have been applied and committed.
