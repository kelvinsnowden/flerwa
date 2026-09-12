-- Same bug class as the P0 fixed earlier for providers.user_id and
-- service_transactions.customer_id (see LAUNCH_READINESS.md): a column
-- pointed at auth.users instead of profiles, which PostgREST cannot
-- traverse for embedding ("profiles:customer_id(...)" in
-- src/app/messages/page.tsx). This one was missed when conversations was
-- added in the messaging-generalization pass, and it's not latent like
-- service_requests.customer_id — /messages embeds through it on every
-- load, for every user, so the inbox has been hard-erroring unconditionally
-- since that migration, confirmed live via a fresh test account.
-- profiles.id == auth.users.id for every row (trigger-created on signup),
-- so this changes nothing about existing data — zero orphans confirmed
-- before applying.
alter table conversations drop constraint conversations_customer_id_fkey;
alter table conversations add constraint conversations_customer_id_fkey
  foreign key (customer_id) references profiles(id) on delete cascade;
