-- GOV-P4 hardening (SEC-014): both can_act_on_approval and
-- rpc_decide_admin_action's execution dispatch used a bare
-- `case p_action_type when ... end` with NO else branch. In Postgres, an
-- unmatched CASE returns NULL, not an error. That NULL flows into
-- `if not can_act_on_approval(...) then raise exception`: `not null` is
-- null, and `if null then` never executes in plpgsql — so a
-- p_action_type value with no WHEN branch would silently bypass the
-- entire permission check, letting ANY authenticated user propose/decide
-- that action. Currently harmless (all 6 live enum values are covered by
-- both CASEs, confirmed via enum_range), but this is the exact two-step
-- pattern (ALTER TYPE ADD VALUE, then a separate migration redefining
-- these two functions) used for both confirm_manual_payment and
-- force_resolve_stuck_transaction this session — the next such addition
-- is one missed function-update away from a silent bypass. Adding
-- explicit ELSE branches makes a future gap fail loud instead of
-- silently open.
create or replace function can_act_on_approval(p_action_type approval_action_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_action_type
    when 'refund' then is_trust_safety_admin() or is_finance_admin()
    when 'suspend_customer' then is_trust_safety_admin()
    when 'suspend_provider' then is_trust_safety_admin()
    when 'category_pause' then is_ops_admin() or is_trust_safety_admin()
    when 'confirm_manual_payment' then is_finance_admin()
    when 'force_resolve_stuck_transaction' then is_trust_safety_admin() or is_finance_admin()
    else false
  end;
$$;

create or replace function rpc_decide_admin_action(p_approval_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
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
        when 'force_resolve_stuck_transaction' then perform _execute_force_resolve_stuck_transaction(v_row.payload);
        else raise exception 'No executor registered for action type %.', v_row.action_type;
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

revoke all on function can_act_on_approval(approval_action_type) from public, anon, authenticated;
grant execute on function can_act_on_approval(approval_action_type) to authenticated;
revoke all on function rpc_decide_admin_action(uuid, text) from public, anon;
grant execute on function rpc_decide_admin_action(uuid, text) to authenticated;
