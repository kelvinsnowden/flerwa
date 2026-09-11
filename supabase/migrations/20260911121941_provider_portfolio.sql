-- =====================================================================
-- Portfolio: real work-sample photos a provider uploads themselves.
-- Confirmed by grep across every migration that no such schema existed
-- (flagged as a deferred follow-up in MARKETPLACE_EXTENSION_AUDIT.md §5,
-- now built). Reuses the avatars bucket pattern exactly: public read
-- (it's a portfolio meant to be seen), owner-only write, first path
-- segment is auth.uid().
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('provider-portfolio', 'provider-portfolio', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "portfolio public read" on storage.objects for select
  using (bucket_id = 'provider-portfolio');
create policy "portfolio owner write" on storage.objects for insert
  with check (bucket_id = 'provider-portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "portfolio owner update" on storage.objects for update
  using (bucket_id = 'provider-portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "portfolio owner delete" on storage.objects for delete
  using (bucket_id = 'provider-portfolio' and (storage.foldername(name))[1] = auth.uid()::text);

create table provider_portfolio_items (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  photo_url    text not null,
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on provider_portfolio_items (provider_id, sort_order);

alter table provider_portfolio_items enable row level security;
create policy "portfolio items public read" on provider_portfolio_items for select using (true);
create policy "portfolio items self write" on provider_portfolio_items
  for all using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin());
