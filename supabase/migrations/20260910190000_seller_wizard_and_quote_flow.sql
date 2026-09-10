-- =====================================================================
-- SECURITY FIX (found during this pass, not previously known): unlike
-- profiles.role (guarded by trg_profiles_guard_role), providers.
-- verification_status and is_published had NO guard trigger — only the
-- "providers self update" RLS policy, which has no column-level check.
-- Its own comment claims "verification_status is separately guarded —
-- see rpc functions", but no such guard ever existed: a provider could
-- run `update providers set verification_status = 'verified',
-- is_published = true where user_id = auth.uid()` directly today and
-- become a publicly-listed "verified" professional with zero admin
-- review. Closed the same way service_transactions' money-moving states
-- are guarded (trg_guard_transaction_financial_write): a BEFORE UPDATE
-- trigger blocking non-admin changes to the trust fields, verified by
-- construction since is_admin() re-checks auth.uid() for real even
-- inside SECURITY DEFINER callers (rpc_set_verification_status, the
-- admin verifications UI's direct update) — both keep working because
-- the caller genuinely is an admin; only a self-update by a non-admin
-- provider is now rejected.
-- =====================================================================
create or replace function trg_providers_guard_trust_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.is_published is distinct from old.is_published
      or new.verified_at is distinct from old.verified_at)
     and not is_admin() then
    raise exception 'Only an admin may change verification status or publish state.';
  end if;
  return new;
end $$;

create trigger providers_guard_trust_fields
  before update on providers
  for each row execute function trg_providers_guard_trust_fields();

-- =====================================================================
-- Seller onboarding wizard: category self-declaration. provider_categories
-- is otherwise admin-write-only (is_cleared/competence_score/jobs_completed
-- are all trust-sensitive) — this narrow RPC lets a seller declare "I offer
-- this category" and supply their own self-reported competence info
-- (years of experience, specialties, certifications — free-form in
-- `attributes`, exactly the column the schema already reserved for this:
-- "Category-specific: creator audience/platforms, trade certs"), while
-- never touching is_cleared, cleared_at, cleared_by, jobs_completed,
-- quality_rating or competence_score. Those remain exclusively set by
-- rpc_set_category_clearance (admin-only, unchanged).
-- =====================================================================
create or replace function rpc_set_provider_category(p_category_id uuid, p_attributes jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_provider_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  select id into v_provider_id from providers where user_id = auth.uid();
  if v_provider_id is null then raise exception 'You need a seller profile first.'; end if;

  insert into provider_categories (provider_id, category_id, attributes)
  values (v_provider_id, p_category_id, coalesce(p_attributes, '{}'::jsonb))
  on conflict (provider_id, category_id) do update
    set attributes = excluded.attributes;
end $$;

revoke execute on function rpc_set_provider_category(uuid, jsonb) from public, anon;
grant execute on function rpc_set_provider_category(uuid, jsonb) to authenticated;

-- =====================================================================
-- Post-a-Task's seller side. service_requests never captured how the
-- task would be fulfilled or how to reach the customer once booked —
-- both are required to convert an accepted quote into a real
-- service_transactions row (fulfilment_mode is NOT NULL there).
-- transaction_id mirrors deal_desk_requests' own traceability column.
-- =====================================================================
alter table service_requests
  add column fulfilment_mode fulfilment_mode not null default 'on_site_customer_present',
  add column contact_phone text,
  add column transaction_id uuid references service_transactions(id);

-- =====================================================================
-- rpc_submit_quote: a seller responds to an open task request. Mirrors
-- trg_enforce_quote_cap (already existed, already SECURITY DEFINER) for
-- the "max 5 quotes" rule — this function does not re-implement that
-- cap, it just inserts and lets the existing trigger enforce it.
-- Eligibility is scoped to "has declared this category" (via
-- provider_categories), not "is admin-cleared" — an unverified seller
-- can still quote (see MARKETPLACE_UX_AUDIT.md's trust-model section:
-- "new, no reviews" is a legitimate, honestly-labelled state, not a
-- reason to lock someone out of ever getting a first job).
-- =====================================================================
create or replace function rpc_submit_quote(
  p_request_id uuid, p_amount_minor bigint, p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_provider providers%rowtype;
  v_request service_requests%rowtype;
  v_quote_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select * into v_provider from providers where user_id = auth.uid();
  if not found then raise exception 'You need a seller profile first.'; end if;

  select * into v_request from service_requests where id = p_request_id for update;
  if not found then raise exception 'Task not found.'; end if;
  if v_request.state <> 'open' then raise exception 'This task is no longer accepting quotes.'; end if;
  if v_request.expires_at <= now() then raise exception 'This task has expired.'; end if;

  if not exists (
    select 1 from provider_categories pc
    where pc.provider_id = v_provider.id and pc.category_id = v_request.category_id
  ) then
    raise exception 'Add this category to your profile before quoting on it.';
  end if;

  if p_amount_minor <= 0 then raise exception 'Quote amount must be positive.'; end if;

  insert into quotes (request_id, provider_id, amount_minor, message)
  values (p_request_id, v_provider.id, p_amount_minor, p_message)
  returning id into v_quote_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_request.customer_id, 'quote_received', 'New quote on your task',
    v_provider.display_name || ' sent a quote for "' || v_request.title || '"'
  );

  return v_quote_id;
end $$;

revoke execute on function rpc_submit_quote(uuid, bigint, text) from public, anon;
grant execute on function rpc_submit_quote(uuid, bigint, text) to authenticated;

-- =====================================================================
-- rpc_accept_quote: converts an accepted quote into a REAL
-- service_transactions row through the exact same table/state machine
-- every other booking uses — no parallel payment lifecycle. Mirrors
-- rpc_book_service's fee calculation (12%) and rpc_convert_deal_desk_
-- request's shape (service_id null, origin marks provenance). Declines
-- every other pending quote on the same request, same as accepting one
-- offer implicitly closes out the others.
-- =====================================================================
create or replace function rpc_accept_quote(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_quote quotes%rowtype;
  v_request service_requests%rowtype;
  v_provider providers%rowtype;
  v_txn_id uuid;
  v_fee bigint;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;

  select * into v_request from service_requests where id = v_quote.request_id for update;
  if not found then raise exception 'Task not found.'; end if;
  if v_request.customer_id <> auth.uid() then raise exception 'Not authorized for this task.'; end if;
  if v_request.state <> 'open' then raise exception 'This task has already been resolved.'; end if;
  if v_quote.state <> 'pending' then raise exception 'This quote is no longer pending.'; end if;

  select * into v_provider from providers where id = v_quote.provider_id;

  v_fee := round(v_quote.amount_minor * 0.12); -- same 12% fee as rpc_book_service

  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, location_id,
    pricing_model, fulfilment_mode, state, origin,
    currency, service_amount_minor, platform_fee_minor,
    customer_instructions, contact_phone
  ) values (
    auth.uid(), v_quote.provider_id, null, v_request.category_id, v_request.location_id,
    'fixed', v_request.fulfilment_mode, 'requested', 'task',
    'KES', v_quote.amount_minor, v_fee,
    v_request.title || ' — ' || v_request.description, v_request.contact_phone
  ) returning id into v_txn_id;

  update quotes set state = 'accepted' where id = p_quote_id;
  update quotes set state = 'declined' where request_id = v_request.id and id <> p_quote_id and state = 'pending';
  update service_requests set state = 'awarded', transaction_id = v_txn_id where id = v_request.id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('from_task_request', v_request.id, 'quote_id', p_quote_id));

  insert into notifications (user_id, type, title, body, transaction_id)
  values (
    v_provider.user_id, 'quote_accepted', 'Your quote was accepted',
    'Your quote for "' || v_request.title || '" was accepted.', v_txn_id
  );

  return v_txn_id;
end $$;

revoke execute on function rpc_accept_quote(uuid) from public, anon;
grant execute on function rpc_accept_quote(uuid) to authenticated;

create or replace function rpc_decline_quote(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_quote quotes%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;
  if not exists (
    select 1 from service_requests r where r.id = v_quote.request_id and r.customer_id = auth.uid()
  ) then
    raise exception 'Not authorized for this quote.';
  end if;
  if v_quote.state <> 'pending' then raise exception 'This quote is no longer pending.'; end if;

  update quotes set state = 'declined' where id = p_quote_id;
end $$;

revoke execute on function rpc_decline_quote(uuid) from public, anon;
grant execute on function rpc_decline_quote(uuid) to authenticated;
