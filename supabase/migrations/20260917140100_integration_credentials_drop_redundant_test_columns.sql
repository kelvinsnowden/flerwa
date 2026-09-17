-- Connectivity/test status for a provider already has a home: the
-- existing last_tested_at/last_test_ok/last_test_error columns on
-- payment_providers/verification_providers/notification_channels, and the
-- existing rpc_record_*_provider_test / rpc_record_notification_channel_test
-- functions and testPaymentProvider/testVerificationProvider/testNotificationChannel
-- server actions that already write to them per-provider-key regardless of
-- is_active. Duplicating that here on integration_credentials would create
-- two "is this provider connected" answers for the same provider — the
-- exact "duplicate provider system" this table was built to avoid.
-- integration_credentials stays purely the encrypted-secret-storage +
-- enabled/disabled layer; Test Connection continues to run through the
-- existing per-provider test actions, which already transparently test
-- whatever resolveCredentials() resolves (database first, env fallback).
drop function if exists public.rpc_record_integration_credential_test(uuid, boolean, text);

alter table public.integration_credentials
  drop column if exists last_tested_at,
  drop column if exists last_test_ok,
  drop column if exists last_test_error_safe;
