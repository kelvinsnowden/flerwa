-- PAY-004: rpc_confirm_manual_payment currently only checks is_admin() —
-- any single admin can unilaterally mark real money as funded. Retrofit
-- it into the same propose/execute dual-control pattern already used for
-- refund/suspend/category_pause (20260914120200_dual_control_approvals.sql),
-- gated by the finance_admin role that migration 20260914120000 already
-- created for exactly this purpose but never wired up.

create or replace function can_act_on_approval(p_action_type approval_action_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_action_type
    when 'refund' then is_trust_safety_admin() or is_finance_admin()
    when 'suspend_customer' then is_trust_safety_admin()
    when 'suspend_provider' then is_trust_safety_admin()
    when 'category_pause' then is_ops_admin() or is_trust_safety_admin()
    when 'confirm_manual_payment' then is_finance_admin()
  end;
$$;

-- ---------------------------------------------------------------------
-- _execute_confirm_manual_payment — exact body of the former
-- rpc_confirm_manual_payment, minus its own is_admin() check. Reachable
-- only through rpc_decide_admin_action's SECURITY DEFINER call chain.
-- auth.uid() here is the SECOND (deciding) admin — recorded as the one
-- who actually funded the transaction, matching _execute_refund's own
-- convention of attributing the execute-time action to the decider.
-- ---------------------------------------------------------------------
create or replace function _execute_confirm_manual_payment(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_transaction_id uuid := (p->>'transaction_id')::uuid;
  v_external_reference text := p->>'external_reference';
  v_notes text := p->>'notes';
  v_payment_id uuid;
begin
  v_payment_id := _fund_transaction(v_transaction_id, 'manual', v_external_reference, auth.uid(), v_notes);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'confirm_manual_payment', 'service_transactions', v_transaction_id,
          jsonb_build_object('payment_id', v_payment_id, 'external_reference', v_external_reference));
end $$;

revoke all on function _execute_confirm_manual_payment(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Wire the new action type into the decide dispatcher.
-- ---------------------------------------------------------------------
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
        when 'confirm_manual_payment' then perform _execute_confirm_manual_payment(v_row.payload);
      end case;
      update pending_admin_approvals set status = 'executed' where id = p_approval_id;
    exception when others then
      update pending_admin_approvals set status = 'execution_failed', error = sqlerrm where id = p_approval_id;
      raise;
    end;
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'decide_admin_action', 'pending_admin_approvals', p_approval_id,
          jsonb_build_object('decision', p_decision, 'action_type', v_row.action_type));
end $$;

-- ---------------------------------------------------------------------
-- Repoint rpc_confirm_manual_payment to PROPOSE instead of EXECUTE.
-- Same name and parameters, so admin/payments/actions.ts (confirmPayment)
-- keeps working unchanged — it just now returns an approval id and
-- performs nothing until a second finance admin approves it.
-- ---------------------------------------------------------------------
drop function if exists rpc_confirm_manual_payment(uuid, text, text);
create function rpc_confirm_manual_payment(p_transaction_id uuid, p_external_reference text, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not can_act_on_approval('confirm_manual_payment') then
    raise exception 'Only a finance admin may confirm a manual payment.';
  end if;
  if p_external_reference is null or btrim(p_external_reference) = '' then
    raise exception 'An M-Pesa reference or receipt note is required.';
  end if;

  return rpc_propose_admin_action('confirm_manual_payment',
    jsonb_build_object('transaction_id', p_transaction_id, 'external_reference', p_external_reference, 'notes', p_notes),
    coalesce(nullif(btrim(p_notes), ''), 'Manual payment confirmation: ' || p_external_reference));
end $$;

revoke all on function rpc_confirm_manual_payment(uuid, text, text) from public, anon;
grant execute on function rpc_confirm_manual_payment(uuid, text, text) to authenticated;
