-- Found during the Phase 2 production-readiness audit: the inbound
-- webhook route had zero idempotency handling -- a retried or replayed
-- webhook delivery would insert a duplicate message (or a duplicate
-- conversation, for an unmatched inbound email). The route now checks
-- email_message_id before inserting (application-layer fix, see
-- src/app/api/webhooks/support-inbound/route.ts); this is the
-- database-layer defense-in-depth for the race between two concurrent
-- deliveries both passing that check before either insert lands --
-- matching this schema's own existing idempotency convention (see
-- idempotent_payment_provider_event_ingestion /
-- idempotent_request_mode_booking).
--
-- Replaces the plain (non-unique) index of the same shape created in the
-- original schema migration -- a unique index already serves the same
-- lookup, so keeping both would be redundant.
drop index support_messages_email_message_id_idx;

create unique index support_messages_email_message_id_unique
  on support_messages (email_message_id) where email_message_id is not null;
