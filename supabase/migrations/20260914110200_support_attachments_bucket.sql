-- support-attachments: PRIVATE bucket for ticket attachments. Unlike
-- avatars/portfolio (owner-uid-keyed paths), every write to this bucket
-- goes through the service-role client from a trusted server action —
-- never directly from the browser — because an anonymous support
-- submitter has no auth.uid() to key a path on, so there is no safe way
-- to write an INSERT policy an anonymous client could satisfy. Reads are
-- still governed by RLS for the two roles that need them (the owning
-- logged-in customer, and admin/agents); nothing here grants anon read.
--
-- Path convention: support-attachments/{conversation_id}/{message_id}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('support-attachments', 'support-attachments', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "support attachments owner or admin read" on storage.objects for select
  using (
    bucket_id = 'support-attachments' and (
      is_admin()
      or exists (
        select 1 from support_messages m
        join support_conversations c on c.id = m.conversation_id
        where m.id = ((storage.foldername(name))[2])::uuid
          and not m.is_internal_note
          and c.customer_profile_id = (select auth.uid())
      )
    )
  );
