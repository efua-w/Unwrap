-- gift_day_date_only — mid-slice 4 change (GCO-002, GCO-003, GCO-004, GC-008, GC-013).
--
-- Owner decision 2026-11-09: the gift day is a DATE only. There is no gift time anywhere.
--   * exchanges.event_at (timestamptz) is replaced by exchanges.gift_day (date, not null).
--   * The gift day is set in the organiser's zone (organiser_tz) and counts as passed at the END of that
--     day in that zone: exchange_state returns 'event_passed' from (gift_day + 1) 00:00 in organiser_tz.
--   * The join-by DAY is strictly before the gift day in both draw modes. As an instant: join_by_at must
--     not be later than the start of the gift day in organiser_tz.
--   * Everyone sees the gift day as the stored date (no conversion); only the cutoff uses organiser_tz.
--
-- Tests written first: supabase/tests/security/130_exchanges.sql. The earlier migration
-- (20261109104934_exchanges.sql) is already applied and is not edited. No access rule changes: the same
-- RLS policies apply, and the new column is granted to signed-in people by column grant only.
--
-- ENUM VALUE: exchange_status 'event_passed' keeps its name (renaming an enum value is not needed and
-- would ripple through generated types and slice 5+ code); the create_exchange error hint stays 'event'.

-- 1. The new column, backfilled from the organiser-local day of the old moment ---------------------
alter table public.exchanges add column gift_day date;
update public.exchanges set gift_day = (event_at at time zone organiser_tz)::date;
alter table public.exchanges alter column gift_day set not null;

-- 2. The join-by rule, now against the start of the gift day ----------------------------------------
-- WHY <= and not <: a manual draw closes joining at the next local midnight after the join-by day, which
-- is exactly the start of the gift day when the join-by day is the day before. `at time zone` on a
-- timestamp with a text zone column is stable within a statement, which a CHECK accepts.
alter table public.exchanges drop constraint exchanges_join_before_event;
alter table public.exchanges add constraint exchanges_join_before_gift_day
  check (join_by_at <= (gift_day::timestamp at time zone organiser_tz));

-- 3. create_exchange: one signature, no gift time ----------------------------------------------------
-- WHY drop and recreate: the argument list changes, so `create or replace` would leave the old 11-argument
-- function callable beside the new one.
drop function public.create_exchange(
  text, text, public.exchange_budget_preset, date, public.exchange_draw_mode, time, date, time, text, boolean, boolean
);

-- Same contract as before (GCO-001..003; errors are 22023 with the field as the hint: name, note, budget,
-- join_by, event, time_zone), except:
--   * p_gift_day is a date. It must not have ended in the organiser's zone: p_gift_day >= the organiser's
--     local today. A gift day that is today is allowed here; the join-by rule below then decides.
--   * The join-by DAY must be strictly before the gift day in both draw modes (hint join_by).
--   * "At join-by time": join-by = draw = p_join_by_date + p_draw_time in the zone.
--   * "When I choose": joining closes at the end of the join-by day (next local midnight); no draw time.
-- Order: zone, gift day, join-by, so a gift day in the past is reported on the gift field.
create function public.create_exchange(
  p_name text,
  p_note text,
  p_budget public.exchange_budget_preset,
  p_join_by_date date,
  p_draw_mode public.exchange_draw_mode,
  p_draw_time time,
  p_gift_day date,
  p_time_zone text,
  p_taking_part boolean,
  p_approval_required boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(p_name);
  v_note text := nullif(btrim(p_note), '');
  v_join_by timestamptz;
  v_draw timestamptz;
  v_tint public.exchange_tint;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid name' using errcode = '22023', hint = 'name';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'invalid note' using errcode = '22023', hint = 'note';
  end if;
  if p_budget is null then
    raise exception 'invalid budget' using errcode = '22023', hint = 'budget';
  end if;
  -- WHY the zone list from Postgres: an unknown name would make `at time zone` raise a different
  -- error, and a stored bad zone would break every later calculation.
  if p_time_zone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_time_zone
  ) then
    raise exception 'invalid time zone' using errcode = '22023', hint = 'time_zone';
  end if;

  -- WHY the organiser's local today: the gift day counts as passed at the END of that day in their zone.
  if p_gift_day is null or p_gift_day < (now() at time zone p_time_zone)::date then
    raise exception 'gift day in the past' using errcode = '22023', hint = 'event';
  end if;

  if p_join_by_date is null or p_draw_mode is null then
    raise exception 'invalid join-by' using errcode = '22023', hint = 'join_by';
  end if;
  -- WHY on dates, both modes: "the day before the gift day or earlier" is what the person picked.
  if p_join_by_date >= p_gift_day then
    raise exception 'join-by day not before gift day' using errcode = '22023', hint = 'join_by';
  end if;
  if p_draw_mode = 'at_join_by' then
    if p_draw_time is null then
      raise exception 'invalid join-by' using errcode = '22023', hint = 'join_by';
    end if;
    v_join_by := (p_join_by_date + p_draw_time) at time zone p_time_zone;
    v_draw := v_join_by;
  else
    v_join_by := ((p_join_by_date + 1)::timestamp) at time zone p_time_zone;
    v_draw := null;
  end if;
  if v_join_by <= now() then
    raise exception 'invalid join-by' using errcode = '22023', hint = 'join_by';
  end if;

  select t.tint into v_tint
  from unnest(enum_range(null::public.exchange_tint)) as t(tint)
  left join (
    select e.tint, count(*) as n
    from public.exchanges e
    where e.organiser_id = v_uid and e.cancelled_at is null and e.completed_at is null
    group by e.tint
  ) u on u.tint = t.tint
  order by coalesce(u.n, 0), random()
  limit 1;

  insert into public.exchanges (
    organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, gift_day, organiser_tz,
    approval_required, tint
  ) values (
    v_uid, v_name, v_note, p_budget, v_join_by, p_draw_mode, v_draw, p_gift_day, p_time_zone,
    coalesce(p_approval_required, false), v_tint
  )
  returning id into v_id;

  insert into public.exchange_members (exchange_id, user_id, taking_part, state)
  values (v_id, v_uid, coalesce(p_taking_part, true), 'active');

  return v_id;
end $$;

revoke execute on function public.create_exchange(
  text, text, public.exchange_budget_preset, date, public.exchange_draw_mode, time, date, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.create_exchange(
  text, text, public.exchange_budget_preset, date, public.exchange_draw_mode, time, date, text, boolean, boolean
) to authenticated;

-- 4. exchange_state: the gift day has passed at the end of that day in the organiser's zone -----------
-- Same order and null-for-non-members behaviour as before. SLICE 10 REPLACES THIS to return 'drawn'
-- once the caller's exchange has assignments; until then 'drawn' is unreachable.
create or replace function public.exchange_state(p_exchange uuid) returns public.exchange_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when e.cancelled_at is not null then 'cancelled'
    when e.completed_at is not null then 'complete'
    when now() >= ((e.gift_day + 1)::timestamp at time zone e.organiser_tz) then 'event_passed'
    when now() >= greatest(e.join_by_at, coalesce(e.reopened_join_by_at, e.join_by_at)) then 'joining_closed'
    else 'open'
  end::public.exchange_status
  from public.exchanges e
  where e.id = p_exchange
    and exists (
      select 1 from public.exchange_members m
      where m.exchange_id = e.id and m.user_id = auth.uid() and m.state = 'active'
    )
$$;

-- 5. Drop the gift time; read the gift day by column grant only --------------------------------------
alter table public.exchanges drop column event_at;
-- WHY a column grant and never a table-wide one: invite_token must stay unreadable to clients.
grant select (gift_day) on public.exchanges to authenticated;
