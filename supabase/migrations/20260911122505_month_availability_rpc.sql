-- =====================================================================
-- rpc_get_month_availability: a per-day Available/Booked/Unavailable
-- status for a provider's public storefront calendar, computed from the
-- same real availability_rules/blocked_slots/booked_slots this session
-- already built for actual booking — this is a read-only display aid,
-- not a new source of truth. A day is:
--   unavailable — no working-hours rule for that weekday, or the whole
--                 day is blocked
--   booked      — has at least one confirmed booked slot that day
--   available   — otherwise
-- =====================================================================
create or replace function rpc_get_month_availability(p_provider_id uuid, p_year int, p_month int)
returns table(day date, status text)
language sql
security definer
stable
set search_path = public
as $$
  select d::date as day,
    case
      when not exists (
        select 1 from provider_availability_rules r
        where r.provider_id = p_provider_id and r.day_of_week = extract(dow from d)::int
      ) then 'unavailable'
      when exists (
        select 1 from provider_blocked_slots b
        where b.provider_id = p_provider_id
          and tstzrange(b.starts_at, b.ends_at) @> tstzrange(
            d at time zone 'Africa/Nairobi',
            (d + interval '1 day') at time zone 'Africa/Nairobi',
            '[)'
          )
      ) then 'unavailable'
      when exists (
        select 1 from provider_booked_slots bs
        where bs.provider_id = p_provider_id
          and bs.slot_range && tstzrange(
            d at time zone 'Africa/Nairobi',
            (d + interval '1 day') at time zone 'Africa/Nairobi',
            '[)'
          )
      ) then 'booked'
      else 'available'
    end as status
  from generate_series(
    make_date(p_year, p_month, 1)::timestamp,
    (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::timestamp,
    interval '1 day'
  ) d;
$$;

revoke all on function rpc_get_month_availability(uuid, int, int) from public;
grant execute on function rpc_get_month_availability(uuid, int, int) to anon, authenticated;
