-- The 7 unindexed foreign keys flagged by Supabase's performance advisor
-- (MARKETPLACE_SCALE_READINESS_AUDIT.md §4 #4), all on tables added this
-- session. Each one supports a real join/lookup pattern already present in
-- the app code, not added speculatively:
--   conversations.service_id      -- storefront "which service was this conversation about"
--   conversations.transaction_id  -- messages page's txn<->conversation join
--   identity_verification_checks.provider_key -- /admin/verifications joins by provider_key
--   payment_provider_events.provider_key       -- /admin/integrations recent-events list
--   payment_providers.connected_by             -- who last activated a provider, admin-facing
--   service_requests.transaction_id            -- converted-request lookup
--   verification_providers.connected_by        -- same as payment_providers
-- No composite/covering index already exists for any of these (confirmed
-- via a fresh pg_indexes read before writing this migration).
create index conversations_service_id_idx on conversations(service_id);
create index conversations_transaction_id_idx on conversations(transaction_id);
create index identity_verification_checks_provider_key_idx on identity_verification_checks(provider_key);
create index payment_provider_events_provider_key_idx on payment_provider_events(provider_key);
create index payment_providers_connected_by_idx on payment_providers(connected_by);
create index service_requests_transaction_id_idx on service_requests(transaction_id);
create index verification_providers_connected_by_idx on verification_providers(connected_by);
