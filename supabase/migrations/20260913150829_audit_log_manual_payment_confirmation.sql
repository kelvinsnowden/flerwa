-- Admin capability audit (MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md): every
-- other admin RPC in this codebase inserts into admin_actions except this
-- one — rpc_confirm_manual_payment marks real money as funded and had zero
-- audit trail. Same signature, same behavior (still delegates to
-- _fund_transaction unchanged); the only addition is the audit insert.
create or replace function rpc_confirm_manual_payment(
  p_transaction_id uuid, p_external_reference text, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_payment_id uuid;
begin
  if not is_admin() then raise exception 'Only an admin can confirm a manual payment.'; end if;
  v_payment_id := _fund_transaction(p_transaction_id, 'manual', p_external_reference, auth.uid(), p_notes);

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'confirm_manual_payment', 'service_transactions', p_transaction_id,
          jsonb_build_object('payment_id', v_payment_id, 'external_reference', p_external_reference));

  return v_payment_id;
end $$;

revoke execute on function rpc_confirm_manual_payment(uuid, text, text) from public, anon;
grant execute on function rpc_confirm_manual_payment(uuid, text, text) to authenticated;
