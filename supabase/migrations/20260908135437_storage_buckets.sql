-- =====================================================================
-- Storage buckets and their RLS policies.
--
-- storage.objects already has RLS enabled by Supabase itself (its
-- ALTER TABLE is owned by supabase_storage_admin, not reachable from
-- migrations) — only policies are created here.
--
-- Path convention for the two private buckets: the first path segment
-- IS the authorization key, checked via storage.foldername(name)[1]:
--   provider-documents/{provider_user_id}/...   -> owner or admin
--   transaction-evidence/{transaction_id}/...    -> txn participant or admin
-- The application MUST upload to these exact path shapes or the RLS
-- check silently denies access (fails closed, not open).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('provider-documents', 'provider-documents', false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('transaction-evidence', 'transaction-evidence', false, 20971520, array['image/jpeg','image/png','video/mp4','application/pdf'])
on conflict (id) do nothing;

-- avatars: public read (it's a profile photo), owner-only write
create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- provider-documents: PRIVATE. Owner (the provider being verified) and admin only. Never public.
create policy "provider docs owner read" on storage.objects for select
  using (bucket_id = 'provider-documents' and
    ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy "provider docs owner write" on storage.objects for insert
  with check (bucket_id = 'provider-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- transaction-evidence: PRIVATE. Only participants of the referenced transaction, or admin.
-- Reuses is_txn_participant() from the RLS migration — same rule as the transaction_evidence table.
create policy "evidence participants read" on storage.objects for select
  using (bucket_id = 'transaction-evidence' and
    (is_admin() or is_txn_participant(((storage.foldername(name))[1])::uuid)));
create policy "evidence provider write" on storage.objects for insert
  with check (bucket_id = 'transaction-evidence' and
    (is_admin() or is_txn_participant(((storage.foldername(name))[1])::uuid)));
