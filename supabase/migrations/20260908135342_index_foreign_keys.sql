-- =====================================================================
-- Covering indexes for every foreign key the performance advisor flagged
-- as unindexed after migration 2. Generated directly from pg_constraint/
-- pg_index (not hand-transcribed) to guarantee accuracy. All are
-- CREATE INDEX IF NOT EXISTS — additive, non-destructive, safe to
-- apply on a running table of any size at this stage (all empty).
-- =====================================================================

create index if not exists idx_admin_actions_admin_id on admin_actions (admin_id);
create index if not exists idx_deal_desk_requests_provider_id on deal_desk_requests (provider_id);
create index if not exists idx_deal_desk_requests_transaction_id on deal_desk_requests (transaction_id);
create index if not exists idx_disputes_opened_by on disputes (opened_by);
create index if not exists idx_disputes_resolved_by on disputes (resolved_by);
create index if not exists idx_messages_sender_id on messages (sender_id);
create index if not exists idx_notifications_transaction_id on notifications (transaction_id);
create index if not exists idx_payment_events_payment_id on payment_events (payment_id);
create index if not exists idx_payments_confirmed_by on payments (confirmed_by);
create index if not exists idx_provider_categories_cleared_by on provider_categories (cleared_by);
create index if not exists idx_provider_service_areas_location_id on provider_service_areas (location_id);
create index if not exists idx_provider_verifications_provider_id on provider_verifications (provider_id);
create index if not exists idx_provider_verifications_reviewed_by on provider_verifications (reviewed_by);
create index if not exists idx_providers_base_location_id on providers (base_location_id);
create index if not exists idx_quotes_provider_id on quotes (provider_id);
create index if not exists idx_reviews_reviewee_id on reviews (reviewee_id);
create index if not exists idx_reviews_reviewer_id on reviews (reviewer_id);
create index if not exists idx_saved_providers_provider_id on saved_providers (provider_id);
create index if not exists idx_service_checklist_items_service_id on service_checklist_items (service_id);
create index if not exists idx_service_requests_category_id on service_requests (category_id);
create index if not exists idx_service_requests_customer_id on service_requests (customer_id);
create index if not exists idx_service_requests_location_id on service_requests (location_id);
create index if not exists idx_service_scope_items_service_id on service_scope_items (service_id);
create index if not exists idx_service_transactions_location_id on service_transactions (location_id);
create index if not exists idx_service_transactions_service_id on service_transactions (service_id);
create index if not exists idx_transaction_checklist_results_checklist_item_id on transaction_checklist_results (checklist_item_id);
create index if not exists idx_transaction_checklist_results_completed_by on transaction_checklist_results (completed_by);
create index if not exists idx_transaction_events_actor_id on transaction_events (actor_id);
create index if not exists idx_transaction_evidence_checklist_item_id on transaction_evidence (checklist_item_id);
create index if not exists idx_transaction_evidence_uploaded_by on transaction_evidence (uploaded_by);
create index if not exists idx_transaction_scope_items_transaction_id on transaction_scope_items (transaction_id);
