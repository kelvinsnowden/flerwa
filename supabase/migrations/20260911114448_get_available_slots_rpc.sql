-- =====================================================================
-- rpc_get_available_slots: read-only computation of open bookable slots
-- for a scheduled service, mirroring the exact same rules/blocked/booked
-- checks rpc_book_service itself enforces at write time — so what the
-- customer sees here is consistent with what booking will actually
-- accept (booking still independently re-validates server-side; this is
-- a display aid, not the source of truth).
-- =====================================================================
create or replace function rpc_get_available_slots(
  p_provider_id uuid,
  p_service_id uuid,
  p_date date
) returns table(slot_start timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_service services%rowtype;
  v_provider providers%rowtype;
  v_duration interval;
  v_dow int;
begin
  select * into v_service from services where id = p_service_id and is_active;
  if not found or v_service.scheduling_mode <> 'scheduled' then
    return;
  end if;
  select * into v_provider from providers where id = p_provider_id;
  if not found then
    return;
  end if;

  v_duration := make_interval(mins => coalesce(v_service.slot_duration_minutes, 120));
  v_dow := extract(dow from p_date);

  return query
  select gs
  from provider_availability_rules r,
       lateral generate_series(
         (p_date::timestamp + r.start_time) at time zone 'Africa/Nairobi',
         (p_date::timestamp + r.end_time) at time zone 'Africa/Nairobi' - v_duration,
         v_duration
       ) gs
  where r.provider_id = p_provider_id and r.day_of_week = v_dow
    and gs >= now() + make_interval(hours => v_provider.min_notice_hours)
    and gs <= now() + make_interval(days => v_provider.max_advance_days)
    and not exists (
      select 1 from provider_blocked_slots b
      where b.provider_id = p_provider_id
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(gs, gs + v_duration, '[)')
    )
    and not exists (
      select 1 from provider_booked_slots bs
      where bs.provider_id = p_provider_id
        and bs.slot_range && tstzrange(gs, gs + v_duration, '[)')
    )
  order by gs;
end;
$$;

revoke all on function rpc_get_available_slots(uuid, uuid, date) from public;
grant execute on function rpc_get_available_slots(uuid, uuid, date) to anon, authenticated;
