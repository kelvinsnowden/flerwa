-- Registers the two adapters that now have code in src/lib/payments and
-- src/lib/verification (IntaSend, Kora) as available-but-not-active. This
-- is what makes them show up on /admin/integrations as connectable —
-- distinct from "active", which still requires real API credentials in
-- env vars and, for IntaSend, actually implementing webhook signature
-- verification (currently a deliberate fail-closed stub — see
-- src/lib/payments/adapters/intasend.ts).
insert into payment_providers (key, display_name, kind, is_active)
values ('intasend', 'IntaSend (M-Pesa + cards, Kenya)', 'aggregator', false);

insert into verification_providers (key, display_name, is_active)
values ('kora', 'Kora Identity (Kenya National ID, passport, KRA PIN)', false);
