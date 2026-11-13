-- rate_limits — audit finding 5 (2026-11-13; GCO-001, GC-019, GC-021).
--
-- Test written first: supabase/tests/security/160_rate_limits.sql.
--
-- WHAT THIS ADDS
--   private.rate_limits          one counter per person and action, for the current hour.
--   private.hit_rate_limit       counts one write and says whether it is still within the limit.
--   private.enforce_rate_limit   refuses with P0429 over the limit (owner decision 2026-11-13, the
--                                earlier Unwrap numbers): per person, per hour, 10 exchanges,
--                                30 wishlists, 300 items.
--   Called by create_exchange, and by BEFORE INSERT triggers on wishlists and wishlist_items (those are
--   written straight to the table under Row Level Security, so a trigger is the one place to count).
--
-- WHY: nothing bounded how much one signed-in person could create. The app shows its normal "couldn't
-- save" line for P0429; no new copy. A refused write rolls back, so its count goes with it.

-- 1. The counter ----------------------------------------------------------------------------------
-- WHY in `private` with RLS on and no grants: nobody reads or resets it through the API (tests 010, 020).
create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

-- WHY one row per key with a fixed window: one upsert per write, no table that grows with every write.
-- The window starts at the first write and resets on the first write after it has passed.
create function private.hit_rate_limit(p_key text, p_max integer, p_window interval) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start <= now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start <= now() - p_window then now() else r.window_start end
  returning r.hits into v_hits;
  return v_hits <= p_max;
end $$;

-- WHY no limit without a signed-in person: those writes come from the migration role or the service
-- role (e2e fixtures), never from the app's API roles.
create function private.enforce_rate_limit(p_action text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max integer;
begin
  if v_uid is null then
    return;
  end if;
  v_max := case p_action
    when 'create_exchange' then 10
    when 'create_wishlist' then 30
    when 'create_item' then 300
  end;
  if v_max is null then
    raise exception 'unknown rate limit action' using errcode = '22023';
  end if;
  if not private.hit_rate_limit(p_action || ':' || v_uid::text, v_max, interval '1 hour') then
    raise exception 'rate limited' using errcode = 'P0429';
  end if;
end $$;

-- WHY SECURITY DEFINER: the trigger runs as the signed-in person, who has no access to `private`.
create function private.limit_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit(tg_argv[0]);
  return new;
end $$;

revoke execute on function private.hit_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke execute on function private.enforce_rate_limit(text) from public, anon, authenticated;
revoke execute on function private.limit_insert() from public, anon, authenticated;

-- 2. Wishlists and items --------------------------------------------------------------------------
create trigger wishlists_rate_limit
  before insert on public.wishlists
  for each row execute function private.limit_insert('create_wishlist');

create trigger wishlist_items_rate_limit
  before insert on public.wishlist_items
  for each row execute function private.limit_insert('create_item');

-- 3. create_exchange: the same function as in 20261109152915_gift_day_date_only, plus the limit -----
-- WHY create or replace with the same arguments: the signature, owner and grants stay as they are.
-- WHY after validation and before the insert: a refused exchange never counts.
create or replace function public.create_exchange(
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

  perform private.enforce_rate_limit('create_exchange');

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
