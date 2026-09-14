-- Registers the Pesapal adapter (src/lib/payments/adapters/pesapal.ts) as
-- available-but-not-active, same pattern as the IntaSend seed
-- (20260911235445_seed_available_aggregator_adapters.sql). Shows up on
-- /admin/integrations as connectable; flipping it active still requires
-- real Pesapal credentials (PESAPAL_CONSUMER_KEY/SECRET, PESAPAL_IPN_ID,
-- PESAPAL_CALLBACK_URL) in env vars — none of which are set by default.
insert into payment_providers (key, display_name, kind, is_active)
values ('pesapal', 'Pesapal (M-Pesa, cards, bank — hosted checkout)', 'aggregator', false);
