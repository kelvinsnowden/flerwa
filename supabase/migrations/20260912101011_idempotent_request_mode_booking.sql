-- Phase 4 (MARKETPLACE_SCALE_READINESS_AUDIT.md / MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md):
-- rpc_book_service (used by scheduling_mode 'none'/'request' services —
-- 'scheduled' services go through rpc_request_scheduled_service instead,
-- which already gets double-submit protection as a side effect of its
-- provider_booked_slots exclusion constraint) had no idempotency guard at
-- all: a double-click, a resubmit after a slow response, or a duplicate
-- network retry of the same form submission could create two separate
-- service_transactions rows for the same booking intent, each needing its
-- own separate payment. The client already disables the submit button
-- while pending, but that's UI-layer only — it's not a guarantee under
-- real network conditions and offers no protection at the actual source
-- of truth.
--
-- Adds an optional client-supplied idempotency key, scoped per customer.
-- The booking form (src/app/services/[slug]/booking-form.tsx) generates
-- one fresh key per page view/mount, so a genuine new booking attempt
-- (fresh page load) always gets a new key, while any repeat submission of
-- that SAME rendered form reuses it. A second call with a key already
-- used by that customer returns the FIRST transaction's id instead of
-- creating a duplicate — same idempotent-insert pattern used for payment
-- webhooks in the previous migration.
--
-- p_idempotency_key defaults to null (backward compatible with any other
-- caller that doesn't pass one, though none currently exists) and, when
-- null, never dedupes — every legacy/no-key call behaves exactly as
-- before.

alter table service_transactions add column idempotency_key text;

create unique index service_transactions_customer_idempotency_key_idx
  on service_transactions (customer_id, idempotency_key)
  where idempotency_key is not null;

create or replace function rpc_book_service(
  p_service_id uuid,
  p_provider_id uuid,
  p_location_id uuid,
  p_scheduled_for timestamptz,
  p_instructions text,
  p_contact_phone text,
  p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn_id uuid;
  v_service services%rowtype;
  v_price bigint;
  v_fee bigint;
  v_category_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  if p_idempotency_key is not null then
    select id into v_txn_id from service_transactions
      where customer_id = auth.uid() and idempotency_key = p_idempotency_key;
    if found then
      return v_txn_id; -- already booked by an earlier call with this exact key — idempotent no-op
    end if;
  end if;

  select * into v_service from services where id = p_service_id and is_active;
  if not found then raise exception 'Service not found or inactive.'; end if;
  v_category_id := v_service.category_id;

  if p_provider_id is not null then
    if v_service.category_id is not null and not exists (
      select 1 from provider_categories pc
      where pc.provider_id = p_provider_id and pc.category_id = v_category_id and pc.is_cleared
    ) then
      raise exception 'Provider is not cleared for this category.';
    end if;
  end if;

  -- resolve price server-side: provider override else service base price
  select coalesce(ps.price_minor, v_service.base_price_minor) into v_price
  from provider_services ps
  where ps.provider_id = p_provider_id and ps.service_id = p_service_id and ps.is_active;
  if v_price is null then v_price := v_service.base_price_minor; end if;

  v_fee := round(v_price * 0.12); -- REC: 12% customer-side fee for remote-principal category, see docs/10-business-model.md

  insert into service_transactions (
    customer_id, provider_id, service_id, category_id, location_id,
    pricing_model, fulfilment_mode, state, origin,
    currency, service_amount_minor, platform_fee_minor,
    customer_instructions, scheduled_for, contact_phone, idempotency_key
  ) values (
    auth.uid(), p_provider_id, p_service_id, v_category_id, p_location_id,
    v_service.pricing_model, v_service.fulfilment_mode, 'requested', 'storefront',
    v_service.currency, v_price, v_fee,
    p_instructions, p_scheduled_for, p_contact_phone, p_idempotency_key
  )
  on conflict (customer_id, idempotency_key) where idempotency_key is not null
    do nothing
  returning id into v_txn_id;

  if v_txn_id is null then
    -- Lost a race against a concurrent call with the same key (both passed
    -- the earlier SELECT check before either had inserted) — the unique
    -- index still caught it. Return the winner's id rather than erroring.
    select id into v_txn_id from service_transactions
      where customer_id = auth.uid() and idempotency_key = p_idempotency_key;
    return v_txn_id;
  end if;

  -- copy the service's scope items onto the transaction (snapshot at time of booking)
  insert into transaction_scope_items (transaction_id, label, included, sort_order)
  select v_txn_id, label, included, sort_order from service_scope_items where service_id = p_service_id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('service_id', p_service_id, 'provider_id', p_provider_id));

  return v_txn_id;
end $$;
