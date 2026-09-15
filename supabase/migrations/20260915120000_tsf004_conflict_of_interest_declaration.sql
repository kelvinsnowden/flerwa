-- TSF-004: require a conflict-of-interest affirmation before check-in.
-- Scoped to every check-in (not gated behind a Tier 3/PROV-001 tiering
-- model, which doesn't exist yet) — cheap, valuable now, and a narrower
-- per-tier requirement can be layered on top later without removing this.
drop function rpc_provider_check_in(uuid, numeric, numeric);

create function rpc_provider_check_in(
  p_transaction_id uuid, p_geo_lat numeric, p_geo_lng numeric, p_no_conflict_declared boolean
) returns void language plpgsql security definer set search_path = public as $$
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
  if p_no_conflict_declared is not true then
    raise exception 'You must confirm you have no undisclosed relationship with the customer before checking in.';
  end if;

  update service_transactions set state = 'checked_in', checked_in_at = now(), updated_at = now()
    where id = p_transaction_id;

  perform log_event(p_transaction_id, 'provider_checked_in', v_txn.state, 'checked_in',
    jsonb_build_object('geo_lat', p_geo_lat, 'geo_lng', p_geo_lng));

  perform log_event(p_transaction_id, 'conflict_of_interest_declared', 'checked_in', 'checked_in',
    jsonb_build_object('declared_by', auth.uid(), 'declared_at', now()));

  perform _release_milestone(p_transaction_id, 'materials');
end $$;

revoke all on function rpc_provider_check_in(uuid, numeric, numeric, boolean) from public, anon;
grant execute on function rpc_provider_check_in(uuid, numeric, numeric, boolean) to authenticated;
