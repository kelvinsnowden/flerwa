-- TXN-004: disputes have no deadline/time-bound field at all — the
-- five-tier ladder in docs/06-trust-architecture.md ("Disputes") has no
-- enforcement mechanism, so a dispute can sit 'open' indefinitely with no
-- forced escalation:
--   L0 Self-serve  0-24h   (rpc_request_revision's included-allowance path — not disputes)
--   L1 Guided      48h to respond
--   L2 Auto        instant (no automatable objective-rules engine exists)
--   L3 Mediation   72h
--   L4 Adjudicate  5 days
--
-- Scope decision: a dispute already arrives with reason+description (a
-- "structured claim + evidence"), so it starts at L1's 48h timer, not
-- L0. L2's automated-rules resolution and L3's "both parties accept a
-- proposed split" step don't exist in this schema (rpc_resolve_dispute is
-- a unilateral admin decision under dual control, not a two-party accept
-- flow) — building those is a materially larger feature, out of scope
-- here. What IS built: a real SLA deadline, and a sweep that escalates
-- open->under_review once L1's window lapses (L3's 72h mediation window,
-- docs' own total of 48h+72h=120h=5 days lines up with L4's stated
-- total), then flags (once, not daily) a dispute still unresolved past
-- that combined window as overdue for adjudication. The sweep
-- deliberately does NOT auto-execute a financial resolution at any
-- stage — docs/06's own auto-resolution rules table requires reading
-- evidence no cron job can safely judge (proration, scope disagreement,
-- missing evidence); L4 is explicitly "trained ops decides on an
-- evidence rubric", a human action. The sweep's job is to make an
-- unresolved dispute impossible to lose track of, not to move money.

alter table disputes
  add column sla_deadline timestamptz,
  add column escalated_at timestamptz,
  add column overdue_notified_at timestamptz;

-- Anchor existing open/under_review disputes to a real deadline (from
-- their own created_at, not migration-run time) so the sweep has
-- something meaningful to act on immediately rather than only for
-- disputes opened after this migration.
update disputes set sla_deadline = created_at + interval '48 hours'
  where state in ('open', 'under_review') and sla_deadline is null;

create or replace function rpc_open_dispute(
  p_transaction_id uuid, p_reason text, p_description text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_txn service_transactions%rowtype;
  v_dispute_id uuid;
begin
  if auth.uid() is null or not is_txn_participant(p_transaction_id) then
    raise exception 'Not authorized for this transaction.';
  end if;

  select * into v_txn from service_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found.'; end if;

  if v_txn.state not in (
    'funded', 'scheduled', 'en_route', 'checked_in', 'in_progress',
    'evidence_submitted', 'customer_review', 'revision_requested'
  ) then
    raise exception 'Cannot open a dispute from state %.', v_txn.state;
  end if;

  insert into disputes (transaction_id, opened_by, reason, description, sla_deadline)
  values (p_transaction_id, auth.uid(), p_reason, p_description, now() + interval '48 hours')
  returning id into v_dispute_id;

  update service_transactions set state = 'disputed', updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'dispute_opened', v_txn.state, 'disputed',
    jsonb_build_object('dispute_id', v_dispute_id, 'reason', p_reason));

  return v_dispute_id;
end $$;

-- ---------------------------------------------------------------------
-- The escalation sweep. Not granted to anon/authenticated — invoked only
-- via the locked wrapper below, from a service-role cron context, same
-- shape as rpc_run_auto_approve_sweep / rpc_generate_due_recurring_occurrences.
-- ---------------------------------------------------------------------
create or replace function rpc_escalate_overdue_disputes() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin_ids uuid[] := array(select id from profiles where role = 'admin');
  v_dispute disputes%rowtype;
  v_escalated integer := 0;
  v_overdue_flagged integer := 0;
begin
  -- Stage 1: open -> under_review once the initial 48h (L1) window lapses.
  for v_dispute in
    select * from disputes
    where state = 'open' and sla_deadline is not null and sla_deadline < now() and escalated_at is null
    for update
  loop
    update disputes set state = 'under_review', escalated_at = now(), sla_deadline = now() + interval '72 hours'
      where id = v_dispute.id;

    perform log_event(v_dispute.transaction_id, 'dispute_escalated', 'disputed', 'disputed',
      jsonb_build_object('dispute_id', v_dispute.id, 'escalated_to', 'under_review'));

    insert into notifications (user_id, type, title, body, transaction_id)
    select admin_id, 'dispute_escalated', 'Dispute overdue — escalated to mediation',
           'A dispute opened ' || to_char(v_dispute.created_at, 'YYYY-MM-DD') || ' had no response within 48h and has been escalated.',
           v_dispute.transaction_id
    from unnest(v_admin_ids) as admin_id;

    v_escalated := v_escalated + 1;
  end loop;

  -- Stage 2: under_review past its own (72h) deadline — flag once for
  -- urgent adjudication. Never re-notified on subsequent sweep runs.
  for v_dispute in
    select * from disputes
    where state = 'under_review' and escalated_at is not null
      and sla_deadline is not null and sla_deadline < now() and overdue_notified_at is null
    for update
  loop
    update disputes set overdue_notified_at = now() where id = v_dispute.id;

    perform log_event(v_dispute.transaction_id, 'dispute_overdue', 'disputed', 'disputed',
      jsonb_build_object('dispute_id', v_dispute.id, 'overdue_for', 'adjudication'));

    insert into notifications (user_id, type, title, body, transaction_id)
    select admin_id, 'dispute_overdue', 'URGENT: dispute overdue for adjudication',
           'A dispute opened ' || to_char(v_dispute.created_at, 'YYYY-MM-DD') || ' is now past its full SLA window and needs a decision today.',
           v_dispute.transaction_id
    from unnest(v_admin_ids) as admin_id;

    v_overdue_flagged := v_overdue_flagged + 1;
  end loop;

  return jsonb_build_object('escalated', v_escalated, 'overdue_flagged', v_overdue_flagged);
end $$;

revoke all on function rpc_escalate_overdue_disputes() from public, anon, authenticated;

-- Same advisory-lock overlap guard as rpc_run_auto_approve_sweep_locked /
-- rpc_generate_due_recurring_occurrences_locked — a distinct lock key.
create or replace function rpc_escalate_overdue_disputes_locked() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lock_key bigint := hashtext('escalate_overdue_disputes')::bigint;
  v_got_lock boolean;
  v_result jsonb;
begin
  v_got_lock := pg_try_advisory_lock(v_lock_key);
  if not v_got_lock then
    return jsonb_build_object('skipped_overlap', true, 'escalated', 0, 'overdue_flagged', 0);
  end if;

  begin
    v_result := rpc_escalate_overdue_disputes();
  exception when others then
    perform pg_advisory_unlock(v_lock_key);
    raise;
  end;

  perform pg_advisory_unlock(v_lock_key);
  return v_result || jsonb_build_object('skipped_overlap', false);
end $$;

revoke all on function rpc_escalate_overdue_disputes_locked() from public, anon, authenticated;
