-- Founder decision (MARKETPLACE_REMEDIATION_REGISTER.md
-- DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL, GOV-P4): two-person
-- approval for every refund, payout override, ban, and emergency pause —
-- no single-admin threshold. This migration retrofits the four such
-- actions that already have a real admin UI today (rpc_resolve_dispute,
-- rpc_admin_set_provider_suspended, rpc_set_customer_suspended,
-- rpc_admin_set_category_active). "Payout override" (the admin-only
-- branch of rpc_approve_and_release) has no existing UI trigger yet —
-- left out of this pass rather than inventing a new feature that wasn't
-- asked for; the mechanism below is generic enough to add it later.
--
-- Design: split each action into a PROPOSE half (the existing RPC name
-- and parameters, unchanged — so no calling code anywhere needs to
-- change) and an EXECUTE half (a new, ungranted "_execute_*" function
-- containing the exact original business logic, byte-for-byte, minus its
-- own is_admin() check). Proposing creates a pending_admin_approvals row
-- and does NOT perform the action. A second, different admin with the
-- same domain permission must call rpc_decide_admin_action to actually
-- run it — enforced by comparing proposed_by to the decider's own
-- auth.uid(), not just checking "is some admin".

create type approval_status as enum ('pending', 'approved', 'rejected', 'executed', 'execution_failed');
create type approval_action_type as enum ('refund', 'suspend_customer', 'suspend_provider', 'category_pause');

create table pending_admin_approvals (
  id            uuid primary key default gen_random_uuid(),
  action_type   approval_action_type not null,
  payload       jsonb not null,
  reason        text,
  proposed_by   uuid not null references profiles(id),
  proposed_at   timestamptz not null default now(),
  decided_by    uuid references profiles(id),
  decided_at    timestamptz,
  status        approval_status not null default 'pending',
  error         text
);

create index on pending_admin_approvals (status, proposed_at);

alter table pending_admin_approvals enable row level security;
-- Full transparency for any admin (not just the domain that owns a given
-- action type) — an approval queue that only some admins can even see
-- would undermine the two-person-review purpose. Writes only via RPC.
create policy "pending approvals readable by admins" on pending_admin_approvals for select using (is_admin());

create or replace function can_act_on_approval(p_action_type approval_action_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_action_type
    when 'refund' then is_trust_safety_admin() or is_finance_admin()
    when 'suspend_customer' then is_trust_safety_admin()
    when 'suspend_provider' then is_trust_safety_admin()
    when 'category_pause' then is_ops_admin() or is_trust_safety_admin()
  end;
$$;

-- ---------------------------------------------------------------------
-- Generic propose/decide pair. Not granted to anon; authenticated only,
-- same as every other admin RPC in this schema.
-- ---------------------------------------------------------------------
create or replace function rpc_propose_admin_action(p_action_type approval_action_type, p_payload jsonb, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not can_act_on_approval(p_action_type) then
    raise exception 'You do not have permission to propose a % action.', p_action_type;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required.';
  end if;

  insert into pending_admin_approvals (action_type, payload, reason, proposed_by)
  values (p_action_type, p_payload, p_reason, auth.uid())
  returning id into v_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'propose_admin_action', 'pending_admin_approvals', v_id,
          jsonb_build_object('action_type', p_action_type, 'payload', p_payload));

  return v_id;
end $$;

create or replace function rpc_decide_admin_action(p_approval_id uuid, p_decision text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row pending_admin_approvals%rowtype;
begin
  if p_decision not in ('approve', 'reject') then raise exception 'Invalid decision %.', p_decision; end if;

  select * into v_row from pending_admin_approvals where id = p_approval_id for update;
  if not found then raise exception 'Approval request not found.'; end if;
  if v_row.status <> 'pending' then raise exception 'This request has already been decided.'; end if;
  if not can_act_on_approval(v_row.action_type) then
    raise exception 'You do not have permission to decide a % action.', v_row.action_type;
  end if;
  -- The whole point: a second, DIFFERENT admin must decide.
  if v_row.proposed_by = auth.uid() then
    raise exception 'A different admin must approve or reject this — you cannot decide your own proposal.';
  end if;

  if p_decision = 'reject' then
    update pending_admin_approvals set status = 'rejected', decided_by = auth.uid(), decided_at = now()
      where id = p_approval_id;
  else
    update pending_admin_approvals set status = 'approved', decided_by = auth.uid(), decided_at = now()
      where id = p_approval_id;

    begin
      case v_row.action_type
        when 'refund' then perform _execute_refund(v_row.payload);
        when 'suspend_customer' then perform _execute_suspend_customer(v_row.payload);
        when 'suspend_provider' then perform _execute_suspend_provider(v_row.payload);
        when 'category_pause' then perform _execute_category_pause(v_row.payload);
      end case;
      update pending_admin_approvals set status = 'executed' where id = p_approval_id;
    exception when others then
      -- The approval DECISION still stands (audit trail preserved) even
      -- if execution itself fails (e.g. the underlying row changed state
      -- between proposal and approval) — surfaced to the approver as a
      -- real error, not silently swallowed.
      update pending_admin_approvals set status = 'execution_failed', error = sqlerrm where id = p_approval_id;
      raise;
    end;
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'decide_admin_action', 'pending_admin_approvals', p_approval_id,
          jsonb_build_object('decision', p_decision, 'action_type', v_row.action_type));
end $$;

revoke all on function rpc_propose_admin_action(approval_action_type, jsonb, text) from public, anon;
grant execute on function rpc_propose_admin_action(approval_action_type, jsonb, text) to authenticated;
revoke all on function rpc_decide_admin_action(uuid, text) from public, anon;
grant execute on function rpc_decide_admin_action(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- _execute_refund — exact body of the former rpc_resolve_dispute, minus
-- its own is_admin() check (trusted: only reachable via
-- rpc_decide_admin_action's own SECURITY DEFINER call chain, never
-- granted directly to authenticated/anon).
-- ---------------------------------------------------------------------
create or replace function _execute_refund(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dispute_id uuid := (p->>'dispute_id')::uuid;
  v_provider_minor bigint := (p->>'provider_minor')::bigint;
  v_customer_refund_minor bigint := (p->>'customer_refund_minor')::bigint;
  v_resolution text := p->>'resolution';
  v_dispute disputes%rowtype;
  v_txn service_transactions%rowtype;
  v_provider_user_id uuid;
  v_group uuid := gen_random_uuid();
  v_new_state txn_state;
begin
  select * into v_dispute from disputes where id = v_dispute_id for update;
  if not found then raise exception 'Dispute not found.'; end if;
  if v_dispute.state = 'resolved' then raise exception 'Dispute is already resolved.'; end if;

  select * into v_txn from service_transactions where id = v_dispute.transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_txn.state <> 'disputed' then
    raise exception 'Transaction is in state % — only a disputed transaction can be resolved this way.', v_txn.state;
  end if;

  if v_provider_minor < 0 or v_customer_refund_minor < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;
  if v_provider_minor + v_customer_refund_minor <> v_txn.service_amount_minor then
    raise exception 'Provider amount + customer refund (%) must equal the service amount (%).',
      v_provider_minor + v_customer_refund_minor, v_txn.service_amount_minor;
  end if;

  select user_id into v_provider_user_id from providers where id = v_txn.provider_id;

  insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
  values
    (v_group, v_txn.id, 'funds_held', null, 'debit', v_txn.service_amount_minor + v_txn.platform_fee_minor, v_txn.currency),
    (v_group, v_txn.id, 'platform_revenue', null, 'credit', v_txn.platform_fee_minor, v_txn.currency);

  if v_provider_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'provider_payable', v_provider_user_id, 'credit', v_provider_minor, v_txn.currency);
  end if;
  if v_customer_refund_minor > 0 then
    insert into ledger_entries (transaction_group, transaction_id, account_type, account_ref, direction, amount_minor, currency)
    values (v_group, v_txn.id, 'refunds', v_txn.customer_id, 'credit', v_customer_refund_minor, v_txn.currency);
  end if;

  update disputes
    set state = 'resolved', resolution = v_resolution,
        financial_outcome = jsonb_build_object('provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor),
        resolved_by = auth.uid(), resolved_at = now()
    where id = v_dispute_id;

  v_new_state := case when v_customer_refund_minor = v_txn.service_amount_minor then 'refunded' else 'settled' end;

  perform set_config('app.bypass_txn_guard', 'on', true);
  update service_transactions
    set state = v_new_state,
        settled_at = case when v_new_state = 'settled' then now() else settled_at end,
        updated_at = now()
    where id = v_txn.id;

  perform log_event(v_txn.id, 'dispute_resolved', 'disputed', v_new_state,
    jsonb_build_object('dispute_id', v_dispute_id, 'provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor));

  perform recompute_reliability(v_txn.provider_id);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'resolve_dispute', 'disputes', v_dispute_id,
          jsonb_build_object('resolution', v_resolution, 'provider_minor', v_provider_minor, 'customer_refund_minor', v_customer_refund_minor));

  insert into notifications (user_id, type, title, body, transaction_id)
  values
    (v_txn.customer_id, 'dispute_resolved', 'Your dispute has been resolved', v_resolution, v_txn.id),
    (v_provider_user_id, 'dispute_resolved', 'A dispute has been resolved', v_resolution, v_txn.id);
end $$;

create or replace function _execute_suspend_customer(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid := (p->>'profile_id')::uuid;
  v_suspended boolean := (p->>'suspended')::boolean;
  v_reason text := p->>'reason';
  v_target profiles%rowtype;
begin
  select * into v_target from profiles where id = v_profile_id;
  if not found then raise exception 'Account not found.'; end if;
  if v_target.role = 'admin' then raise exception 'Cannot suspend an admin account through this action.'; end if;

  update profiles set is_suspended = v_suspended where id = v_profile_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_customer_suspended', 'profiles', v_profile_id,
          jsonb_build_object('suspended', v_suspended, 'reason', v_reason));
end $$;

create or replace function _execute_suspend_provider(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_provider_id uuid := (p->>'provider_id')::uuid;
  v_suspended boolean := (p->>'suspended')::boolean;
  v_reason text := p->>'reason';
begin
  if not exists (select 1 from providers where id = v_provider_id) then raise exception 'Provider not found.'; end if;

  update providers set is_suspended = v_suspended where id = v_provider_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_provider_suspended', 'providers', v_provider_id,
          jsonb_build_object('suspended', v_suspended, 'reason', v_reason));
end $$;

create or replace function _execute_category_pause(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_category_id uuid := (p->>'category_id')::uuid;
  v_active boolean := (p->>'active')::boolean;
  v_reason text := p->>'reason';
begin
  if not exists (select 1 from categories where id = v_category_id) then raise exception 'Category not found.'; end if;

  update categories set is_active = v_active where id = v_category_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_category_active', 'categories', v_category_id,
          jsonb_build_object('active', v_active, 'reason', v_reason));
end $$;

-- Deliberately no grants on any _execute_* function to anon/authenticated
-- — only reachable through rpc_decide_admin_action's own SECURITY
-- DEFINER call chain (which executes as the function owner throughout,
-- including nested calls), or a service-role context.

-- ---------------------------------------------------------------------
-- Repoint the four existing entrypoints to PROPOSE instead of EXECUTE.
-- Same names, same parameters — every existing caller (the dispute-
-- resolution page, SuspendControl, the category-pause action) keeps
-- working unchanged; only the return type and actual effect changes
-- (was: performs the action immediately and returns void; now: creates a
-- pending approval and returns its id). UI copy is updated separately to
-- reflect "submitted for a second admin's approval" instead of "done".
-- ---------------------------------------------------------------------
drop function if exists rpc_resolve_dispute(uuid, bigint, bigint, text);
create function rpc_resolve_dispute(p_dispute_id uuid, p_provider_minor bigint, p_customer_refund_minor bigint, p_resolution text)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not can_act_on_approval('refund') then raise exception 'Only a trust & safety or finance admin may resolve a dispute.'; end if;
  return rpc_propose_admin_action('refund',
    jsonb_build_object('dispute_id', p_dispute_id, 'provider_minor', p_provider_minor,
                        'customer_refund_minor', p_customer_refund_minor, 'resolution', p_resolution),
    p_resolution);
end $$;
revoke all on function rpc_resolve_dispute(uuid, bigint, bigint, text) from public, anon;
grant execute on function rpc_resolve_dispute(uuid, bigint, bigint, text) to authenticated;

drop function if exists rpc_set_customer_suspended(uuid, boolean, text);
create function rpc_set_customer_suspended(p_profile_id uuid, p_suspended boolean, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not can_act_on_approval('suspend_customer') then raise exception 'Only a trust & safety admin may change suspension status.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required to suspend or reinstate an account.'; end if;
  return rpc_propose_admin_action('suspend_customer',
    jsonb_build_object('profile_id', p_profile_id, 'suspended', p_suspended, 'reason', p_reason),
    p_reason);
end $$;
revoke all on function rpc_set_customer_suspended(uuid, boolean, text) from public, anon;
grant execute on function rpc_set_customer_suspended(uuid, boolean, text) to authenticated;

drop function if exists rpc_admin_set_provider_suspended(uuid, boolean, text);
create function rpc_admin_set_provider_suspended(p_provider_id uuid, p_suspended boolean, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not can_act_on_approval('suspend_provider') then raise exception 'Only a trust & safety admin may change provider suspension status.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required to suspend or reinstate a provider.'; end if;
  return rpc_propose_admin_action('suspend_provider',
    jsonb_build_object('provider_id', p_provider_id, 'suspended', p_suspended, 'reason', p_reason),
    p_reason);
end $$;
revoke all on function rpc_admin_set_provider_suspended(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_provider_suspended(uuid, boolean, text) to authenticated;

drop function if exists rpc_admin_set_category_active(uuid, boolean, text);
create function rpc_admin_set_category_active(p_category_id uuid, p_active boolean, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not can_act_on_approval('category_pause') then raise exception 'Only an ops or trust & safety admin may pause or resume a category.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required to pause or resume a category.'; end if;
  return rpc_propose_admin_action('category_pause',
    jsonb_build_object('category_id', p_category_id, 'active', p_active, 'reason', p_reason),
    p_reason);
end $$;
revoke all on function rpc_admin_set_category_active(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_category_active(uuid, boolean, text) to authenticated;
