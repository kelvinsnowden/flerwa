-- CRITICAL, pre-existing bug found during pre-deployment QA: providers.
-- user_id and service_transactions.customer_id both reference auth.users
-- directly. auth.users is not exposed to PostgREST's public schema, so
-- every `profiles:user_id(...)` / `profiles:customer_id(...)` embed used
-- throughout the app (booking detail, provider dashboard, provider
-- public profile, service detail's provider list, messages list/thread,
-- admin payments/disputes, provider job detail, task quote list — 11
-- call sites) fails with PGRST200 "Could not find a relationship
-- between 'providers'/'service_transactions' and 'user_id'/
-- 'customer_id' in the schema cache". Confirmed live against the
-- deployed app: a real booking's confirmation page failed to load
-- immediately after a successful, real booking submission.
--
-- Fix: retarget both foreign keys to reference public.profiles(id)
-- instead of auth.users(id) — the standard Supabase pattern for this
-- exact situation. profiles.id itself references auth.users(id) on
-- delete cascade and is populated synchronously by trg_handle_new_user
-- (AFTER INSERT on auth.users, same transaction), so every existing
-- providers.user_id / service_transactions.customer_id value already
-- has a matching profiles row (verified: zero orphans before applying
-- this) — this changes what PostgREST can see, not the actual
-- referential guarantee, which was already effectively 1:1 via auth.users.
alter table providers drop constraint providers_user_id_fkey;
alter table providers add constraint providers_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table service_transactions drop constraint service_transactions_customer_id_fkey;
alter table service_transactions add constraint service_transactions_customer_id_fkey
  foreign key (customer_id) references profiles(id);
