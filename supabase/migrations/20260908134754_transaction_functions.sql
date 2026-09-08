-- =====================================================================
-- SECURITY DEFINER functions: the ONLY path that may move a transaction
-- through its state machine, touch money, or write reputation/events.
-- Every function re-validates the caller's identity and role itself —
-- it never trusts that RLS alone was sufficient, per Next.js docs:
-- "Server Functions are reachable via direct POST requests... always
-- verify authentication and authorization inside every Server Function."
-- =====================================================================

create or replace function log_event(
  p_transaction_id uuid, p_event_type text, p_from txn_state, p_to txn_state, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
begin
  select role into v_role from profiles where id = auth.uid();
  insert into transaction_events (transaction_id, event_type, actor_id, actor_role, from_state, to_state, payload)
  values (p_transaction_id, p_event_type, auth.uid(), v_role, p_from, p_to, p_payload);
end $$;

-- ---------------------------------------------------------------------
-- Book a fixed-price service. Server resolves the price; client never
-- supplies one. Creates the transaction in 'requested' state, unfunded.
-- ---------------------------------------------------------------------
create or replace function rpc_book_service(
  p_service_id uuid,
  p_provider_id uuid,
  p_location_id uuid,
  p_scheduled_for timestamptz,
  p_instructions text,
  p_contact_phone text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn_id uuid;
  v_service services%rowtype;
  v_price bigint;
  v_fee bigint;
  v_category_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

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
    customer_instructions, scheduled_for, contact_phone
  ) values (
    auth.uid(), p_provider_id, p_service_id, v_category_id, p_location_id,
    v_service.pricing_model, v_service.fulfilment_mode, 'requested', 'storefront',
    v_service.currency, v_price, v_fee,
    p_instructions, p_scheduled_for, p_contact_phone
  ) returning id into v_txn_id;

  -- copy the service's scope items onto the transaction (snapshot at time of booking)
  insert into transaction_scope_items (transaction_id, label, included, sort_order)
  select v_txn_id, label, included, sort_order from service_scope_items where service_id = p_service_id;

  perform log_event(v_txn_id, 'service_created', null, 'requested',
    jsonb_build_object('service_id', p_service_id, 'provider_id', p_provider_id));

  return v_txn_id;
end $$;

-- ---------------------------------------------------------------------
-- Admin confirms a manual payment was received. This is the ONLY way
-- a payment moves to 'funded'. No browser path can do this directly —
-- see docs/07-payments.md and BUILD_PLAN.md Phase 9.
-- ---------------------------------------------------------------------
create or replace function rpc_confirm_manual_payment(
  p_transaction_id uuid, p_external_reference text, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_payment_id uuid;
  v_group uuid := gen_random_uuid();
begin
  if not is_admin() then raise exception 'Only an admin can confirm a manual payment.'; end if;

  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state not in ('requested','quote_accepted') then
    raise exception 'Transaction is in state % and cannot be funded.', v_txn.state;
  end if;

  insert into payments (transaction_id, provider_key, state, amount_minor, currency,
                         external_reference, confirmed_by, confirmed_at, notes)
  values (p_transaction_id, 'manual', 'funded', v_txn.total_amount_minor, v_txn.currency,
          p_external_reference, auth.uid(), now(), p_notes)
  returning id into v_payment_id;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, p_transaction_id, 'customer_receivable', v_txn.customer_id, 'debit',  v_txn.total_amount_minor, v_txn.currency),
    (v_group, p_transaction_id, 'funds_held',          null,              'credit', v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'materials_held',      null,              'credit', v_txn.materials_amount_minor, v_txn.currency);

  update service_transactions
    set state = 'funded', funded_at = now(),
        escrow_expires_at = now() + interval '60 days',
        updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'payment_confirmed', v_txn.state, 'funded',
    jsonb_build_object('payment_id', v_payment_id, 'external_reference', p_external_reference));

  return v_payment_id;
end $$;

-- ---------------------------------------------------------------------
-- Provider accepts a funded job and moves it toward being performed.
-- ---------------------------------------------------------------------
create or replace function rpc_provider_check_in(p_transaction_id uuid, p_geo_lat numeric, p_geo_lng numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
begin
  select t.* into v_txn from service_transactions t
    join providers p on p.id = t.provider_id
    where t.id = p_transaction_id and p.user_id = auth.uid()
    for update;
  if not found then raise exception 'Not authorized for this transaction.'; end if;
  if v_txn.state not in ('funded','scheduled') then
    raise exception 'Cannot check in from state %.', v_txn.state;
  end if;

  update service_transactions set state = 'checked_in', checked_in_at = now(), updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'provider_checked_in', v_txn.state, 'checked_in',
    jsonb_build_object('geo_lat', p_geo_lat, 'geo_lng', p_geo_lng));
end $$;

-- ---------------------------------------------------------------------
-- Provider submits completion. Requires every REQUIRED checklist item
-- to have evidence attached — "make the provider prove what they did."
-- ---------------------------------------------------------------------
create or replace function rpc_submit_completion(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_missing int;
begin
  select t.* into v_txn from service_transactions t
    join providers p on p.id = t.provider_id
    where t.id = p_transaction_id and p.user_id = auth.uid()
    for update;
  if not found then raise exception 'Not authorized for this transaction.'; end if;
  if v_txn.state not in ('checked_in','in_progress','revision_requested') then
    raise exception 'Cannot submit completion from state %.', v_txn.state;
  end if;

  select count(*) into v_missing
  from service_checklist_items sci
  where sci.service_id = v_txn.service_id and sci.is_required
    and not exists (
      select 1 from transaction_checklist_results r
      where r.transaction_id = p_transaction_id and r.checklist_item_id = sci.id and r.is_complete
    );
  if v_missing > 0 then
    raise exception 'Cannot submit: % required checklist item(s) incomplete.', v_missing;
  end if;

  update service_transactions
    set state = 'evidence_submitted', evidence_at = now(),
        auto_approve_at = now() + interval '5 days',
        updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'completion_submitted', v_txn.state, 'evidence_submitted', '{}'::jsonb);

  insert into notifications (user_id, type, title, body, transaction_id)
  values (v_txn.customer_id, 'evidence_ready', 'Your report is ready',
          'Your provider has submitted evidence. Review it and approve, or request a revision.',
          p_transaction_id);
end $$;

-- ---------------------------------------------------------------------
-- Customer approves. This is the ONLY function that releases funds —
-- an admin also has a parallel path for the 5-day auto-approve, run by
-- a scheduled job, not by trusting the client's clock.
-- ---------------------------------------------------------------------
create or replace function rpc_approve_and_release(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from service_transactions where id = p_transaction_id and customer_id = auth.uid()
  ) and not is_admin() then
    raise exception 'Only the customer (or admin) may approve this job.';
  end if;
  perform _release_transaction(p_transaction_id, false);
end $$;

-- Internal: the actual release logic, callable by the authorized public RPC above
-- OR by the auto-approve sweep below. Not exposed to PostgREST directly because it
-- performs no authorization check of its own — both callers already did theirs.
create or replace function _release_transaction(p_transaction_id uuid, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_group uuid := gen_random_uuid();
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state <> 'evidence_submitted' then
    raise exception 'Cannot approve from state %.', v_txn.state;
  end if;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, p_transaction_id, 'funds_held',       null, 'debit',  v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, p_transaction_id, 'provider_payable',
       (select user_id from providers where id = v_txn.provider_id), 'credit', v_txn.service_amount_minor, v_txn.currency),
    (v_group, p_transaction_id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor, v_txn.currency);

  update service_transactions
    set state = 'released', approved_at = now(), released_at = now(), updated_at = now()
    where id = p_transaction_id;

  update payments set state = 'released', released_at = now() where transaction_id = p_transaction_id;

  perform log_event(p_transaction_id, 'customer_approved', 'evidence_submitted', 'released',
    jsonb_build_object('auto', p_auto));

  -- settle immediately in the MVP (manual payout confirmed by ops separately in practice);
  -- state is distinguished from 'released' so the payout step remains a distinct, auditable event.
  update service_transactions set state = 'settled', settled_at = now() where id = p_transaction_id;
  perform log_event(p_transaction_id, 'payment_released', 'released', 'settled', '{}'::jsonb);

  -- recompute the provider's portable reliability from the event log
  perform recompute_reliability(v_txn.provider_id);

  insert into notifications (user_id, type, title, body, transaction_id)
  values ((select user_id from providers where id = v_txn.provider_id), 'payment_released',
          'Payment released', 'Your payment has been released and marked settled.', p_transaction_id);
end $$;

-- ---------------------------------------------------------------------
-- Customer requests a revision (bounded, cites the brief — free text at
-- MVP, structured limit enforced by counting events).
-- ---------------------------------------------------------------------
create or replace function rpc_request_revision(p_transaction_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_revision_count int;
begin
  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found or v_txn.customer_id <> auth.uid() then raise exception 'Not authorized.'; end if;
  if v_txn.state <> 'evidence_submitted' then raise exception 'Cannot request revision from state %.', v_txn.state; end if;

  select count(*) into v_revision_count from transaction_events
    where transaction_id = p_transaction_id and event_type = 'revision_requested';
  if v_revision_count >= 2 then
    raise exception 'Revision limit reached (2). Open a dispute instead.';
  end if;

  update service_transactions set state = 'revision_requested', updated_at = now() where id = p_transaction_id;
  perform log_event(p_transaction_id, 'revision_requested', 'evidence_submitted', 'revision_requested',
    jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- Recompute portable Reliability from the append-only event log.
-- Bayesian shrinkage to a neutral prior so a brand-new provider is not
-- unrankable. NEVER hand-edited. Category Competence is separate and
-- intentionally NOT touched here — see docs/06-trust-architecture.md.
-- ---------------------------------------------------------------------
create or replace function recompute_reliability(p_provider_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_completed int; v_accepted int; v_disputes int; v_avg_rating numeric;
  v_completion_rate numeric; v_score numeric;
  k constant numeric := 5; prior constant numeric := 70;
begin
  select count(*) filter (where state in ('settled','reviewed','closed'))
    into v_completed from service_transactions where provider_id = p_provider_id;
  select count(*) into v_accepted from service_transactions
    where provider_id = p_provider_id and state <> 'requested';
  select count(*) into v_disputes from disputes d
    join service_transactions t on t.id = d.transaction_id
    where t.provider_id = p_provider_id;
  select avg(rating) into v_avg_rating from reviews r
    join service_transactions t on t.id = r.transaction_id
    where t.provider_id = p_provider_id and r.is_customer_review;

  v_completion_rate := case when v_accepted > 0 then round(100.0 * v_completed / v_accepted, 2) else null end;
  v_score := round(((coalesce(v_completion_rate, prior) * v_completed) + (prior * k)) / (v_completed + k), 2);

  insert into reliability_scores (provider_id, jobs_completed, jobs_accepted, completion_rate,
                                   dispute_count, avg_rating, score, sample_size, computed_at)
  values (p_provider_id, v_completed, v_accepted, v_completion_rate, v_disputes, v_avg_rating,
          v_score, v_completed, now())
  on conflict (provider_id) do update set
    jobs_completed = excluded.jobs_completed, jobs_accepted = excluded.jobs_accepted,
    completion_rate = excluded.completion_rate, dispute_count = excluded.dispute_count,
    avg_rating = excluded.avg_rating, score = excluded.score,
    sample_size = excluded.sample_size, computed_at = excluded.computed_at;
end $$;

-- ---------------------------------------------------------------------
-- Auto-approve sweep: run on a schedule (Phase 15 — pg_cron or an
-- external scheduler calling this via the service role). Protects the
-- PROVIDER from a customer who goes silent. See docs/04, docs/09.
-- ---------------------------------------------------------------------
create or replace function rpc_run_auto_approve_sweep()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_txn record; v_count int := 0;
begin
  for v_txn in
    select id from service_transactions
    where state = 'evidence_submitted' and auto_approve_at is not null and auto_approve_at <= now()
  loop
    perform _release_transaction(v_txn.id, true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
comment on function rpc_run_auto_approve_sweep() is
  'Calls _release_transaction() directly, bypassing the customer/admin auth check in rpc_approve_and_release, '
  'because a scheduled sweep has no user session (auth.uid() is null). It is SECURITY DEFINER and must be invoked '
  'only by a trusted scheduler (service role via pg_cron or an external cron hitting it through the service key), '
  'never exposed to anon/authenticated roles. See Phase 15 and revoke EXECUTE from anon/authenticated below.';

revoke execute on function rpc_run_auto_approve_sweep() from anon, authenticated;
revoke execute on function _release_transaction(uuid, boolean) from anon, authenticated;

-- ---------------------------------------------------------------------
-- Verification workflow: admin-only transitions. Never faked.
-- ---------------------------------------------------------------------
create or replace function rpc_set_verification_status(
  p_provider_id uuid, p_status verification_status, p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may set verification status.'; end if;
  update providers set verification_status = p_status,
    verified_at = case when p_status = 'verified' then now() else verified_at end,
    updated_at = now()
    where id = p_provider_id;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_verification_status', 'providers', p_provider_id,
          jsonb_build_object('status', p_status, 'notes', p_notes));
end $$;

create or replace function rpc_set_category_clearance(
  p_provider_id uuid, p_category_id uuid, p_cleared boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin may grant category clearance.'; end if;
  insert into provider_categories (provider_id, category_id, is_cleared, cleared_at, cleared_by)
  values (p_provider_id, p_category_id, p_cleared, case when p_cleared then now() end, auth.uid())
  on conflict (provider_id, category_id) do update
    set is_cleared = excluded.is_cleared, cleared_at = excluded.cleared_at, cleared_by = excluded.cleared_by;
  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_category_clearance', 'provider_categories', p_provider_id,
          jsonb_build_object('category_id', p_category_id, 'cleared', p_cleared));
end $$;
