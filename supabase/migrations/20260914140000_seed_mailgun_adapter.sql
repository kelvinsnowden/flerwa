-- Registers the Mailgun adapter (src/lib/notifications/adapters/mailgun.ts)
-- as available-but-not-active, same pattern as the Resend seed
-- (20260914110000_support_system_schema.sql). Shows up on
-- /admin/integrations as connectable; flipping it active still requires
-- real Mailgun credentials (MAILGUN_API_KEY, MAILGUN_DOMAIN,
-- MAILGUN_WEBHOOK_SIGNING_KEY) in env vars, none of which are set by
-- default.
insert into notification_channels (key, kind, display_name)
values ('mailgun', 'email', 'Mailgun (transactional email)');
