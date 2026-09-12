-- The raw input a KYC vendor check needs (a national ID number) plus an
-- explicit consent flag — collected from the provider themselves during
-- the apply wizard, not a trust claim in itself (verification_status
-- remains the only trust claim, still admin-gated). Self-editable like
-- headline/bio; not covered by trg_guard_provider_trust_fields because
-- entering your own ID number isn't the same act as claiming to be
-- verified.
alter table providers add column national_id_number text;
alter table providers add column identity_verification_consent boolean not null default false;
