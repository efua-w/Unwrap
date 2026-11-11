-- exchanges — slice 4 (GCO-001, GCO-002, GCO-003, GCO-004, GC-008, GC-013; plan §3, §5, §6).
--
-- Tests written first: supabase/tests/security/130_exchanges.sql. The function allowlist (030) needs no
-- change: it lists only what ANON may execute, and every function here is signed-in only.
--
-- WHAT THIS ADDS
--   public.exchanges          one row per exchange: name, note, budget preset, join-by / draw / gift
--                             moments, the organiser's zone, approval switch, invite token, tint, and
--                             the columns later slices fill (cancelled, completed, reopened, blocked,
--                             draw round). Nothing is ever hard-deleted.
--   public.exchange_members   who is in an exchange and whether they take part. The organiser always has
--                             a row (taking_part false when they only organise).
--   public.is_member / is_organiser     RLS helpers about the caller only (definer, so the policies on
--                             exchange_members do not recurse into themselves).
--   public.create_exchange    the only way to start an exchange (GCO-001..003).
--   public.exchange_state     the calculated status, for members only (plan §3: never stored).
--   public.get_exchange_invite_token    the invite token, for the organiser only.
--
-- NOT HERE, ON PURPOSE: attached_wishlist_id (slice 5), assignments (slice 10), joining (slice 5).
-- The organiser reads no assignment, request or email data from these tables (core security rule).

-- 1. Types ----------------------------------------------------------------------------------------
-- WHY enums for the closed lists: a typo cannot be stored, and the generated TypeScript types list
-- the exact values. Budget presets follow the Decisions table (labels are copy, not data).
create type public.exchange_budget_preset as enum ('5k_10k', '10k_20k', '20k_50k', '50k_plus');
create type public.exchange_draw_mode as enum ('at_join_by', 'organiser_chooses');
create type public.exchange_tint as enum ('clay', 'peach', 'sand', 'mint');
create type public.exchange_member_state as enum ('active', 'left', 'removed');
-- WHY here although nothing stores it: it is the return type of exchange_state().
create type public.exchange_status as enum ('open', 'joining_closed', 'drawn', 'event_passed', 'complete', 'cancelled');

-- 2. Tables ---------------------------------------------------------------------------------------

-- WHY no ON DELETE CASCADE anywhere (never-do 8): exchanges are only cancelled or completed.
create table public.exchanges (
  id uuid primary key default gen_random_uuid(),
  -- WHY default auth.uid() and no client grant: nobody creates an exchange for someone else.
  organiser_id uuid not null default auth.uid() references public.profiles (id),
  -- WHY 40 code points (GCO-001); char_length counts code points, so an emoji is one.
  name text not null
    constraint exchanges_name_length check (char_length(btrim(name)) between 1 and 40)
    constraint exchanges_name_trimmed check (name = btrim(name)),
  -- WHY 280 (GCO-001). No note is null, never an empty string.
  note text
    constraint exchanges_note_length check (char_length(note) <= 280 and btrim(note) <> '' and note = btrim(note)),
  budget_preset public.exchange_budget_preset not null,
  -- WHY the moments are timestamptz computed in Postgres from the organiser's dates, times and zone
  -- (see create_exchange): a client never sends a timestamp, and DST or a wrong browser clock cannot
  -- produce a different instant here.
  join_by_at timestamptz not null,
  draw_mode public.exchange_draw_mode not null,
  draw_at timestamptz,
  event_at timestamptz not null,
  -- WHY stored: the organiser's zone fixes what "end of the join-by day" and "18:00" meant when they
  -- chose them. Viewers still see every time in their own zone (product rule).
  organiser_tz text not null
    constraint exchanges_organiser_tz_length check (char_length(organiser_tz) between 1 and 64),
  approval_required boolean not null default false,
  -- WHY both a default and the exchanges_set_invite_token trigger: the default keeps the column
  -- optional on insert (and in the generated types); the trigger overwrites any value sent, so the
  -- token is always server-made. Clients have no select grant on it (organiser-only function).
  invite_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  tint public.exchange_tint not null,
  -- Filled by later slices (cancel 15, complete 16, reopen 10/13, draw 10); no client grant.
  cancelled_at timestamptz,
  completed_at timestamptz,
  reopened_join_by_at timestamptz,
  draw_blocked_reason text,
  draw_round integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- WHY strictly before (owner decision 8): joining must close before the gift moment.
  constraint exchanges_join_before_event check (join_by_at < event_at),
  -- WHY: an automatic draw has a draw time and a manual one has none; and the automatic draw runs
  -- exactly when joining closes (owner decision, planner round 2).
  constraint exchanges_draw_at_matches_mode check ((draw_mode = 'at_join_by') = (draw_at is not null)),
  constraint exchanges_auto_draw_at_join_by check (draw_mode <> 'at_join_by' or draw_at = join_by_at)
);

create table public.exchange_members (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges (id),
  user_id uuid not null references public.profiles (id),
  -- WHY: the organiser can organise without taking part (GCO-001); everyone else says yes at join.
  taking_part boolean not null,
  state public.exchange_member_state not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  -- WHY: a membership is active exactly when it has not ended.
  constraint exchange_members_left_at_matches_state check ((state = 'active') = (left_at is null))
);

-- WHY partial: a person who left may join again (plan §2), so only ACTIVE rows are unique.
create unique index exchange_members_one_active_idx on public.exchange_members (exchange_id, user_id)
  where state = 'active';
-- WHY: Exchanges list and the policies look up a person's live memberships.
create index exchange_members_user_active_idx on public.exchange_members (user_id) where state = 'active';
create index exchanges_organiser_idx on public.exchanges (organiser_id);

-- 3. Row Level Security and grants ----------------------------------------------------------------
alter table public.exchanges enable row level security;
alter table public.exchange_members enable row level security;

-- WHY revoke first: Supabase's default ACLs hand new tables to anon and authenticated (see
-- harden_defaults). Start from nothing, then grant exactly what the app reads. No write grant at all:
-- every change is a definer function.
revoke all on public.exchanges from public, anon, authenticated;
revoke all on public.exchange_members from public, anon, authenticated;

-- WHY column grants: invite_token is organiser-only (get_exchange_invite_token), so `select *` is
-- refused and the app lists its columns. left_at on a member row is not needed by any screen.
grant select (
  id, organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz,
  approval_required, tint, cancelled_at, completed_at, reopened_join_by_at, draw_blocked_reason,
  draw_round, created_at, updated_at
) on public.exchanges to authenticated;
grant select (id, exchange_id, user_id, taking_part, state, joined_at) on public.exchange_members to authenticated;

-- 4. Helpers and policies -------------------------------------------------------------------------
-- WHY SECURITY DEFINER: they read exchange_members and exchanges without RLS, so a policy on
-- exchange_members can ask "am I in this exchange?" without calling itself. They answer only about
-- the caller (auth.uid()), never about another person.
create function public.is_member(p_exchange uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exchange_members
    where exchange_id = p_exchange and user_id = auth.uid() and state = 'active'
  )
$$;

create function public.is_organiser(p_exchange uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exchanges
    where id = p_exchange and organiser_id = auth.uid()
  )
$$;

revoke execute on function public.is_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_organiser(uuid) from public, anon, authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_organiser(uuid) to authenticated;

-- WHY members and the organiser only: an outsider learns nothing, and a person who left or was
-- removed no longer reads the exchange (the route shows "You're no longer in it"). Non-members see a
-- preview only through get_invite_preview(token), slice 5.
create policy exchanges_select_members on public.exchanges
  for select to authenticated
  using (public.is_member(id) or organiser_id = (select auth.uid()));

-- WHY own row in any state, others only while active and only for co-members: the member list is
-- shown to the people in the exchange (plan §5), and a person who left can still learn that they left.
create policy exchange_members_select on public.exchange_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (state = 'active' and public.is_member(exchange_id)));

-- 5. Trigger function (in `private`, not executable by the API roles) ------------------------------
-- WHY a trigger and not only a column default: it overwrites whatever is sent, so a token is always
-- server-made even for inserts by the migration role or a future definer function.
create function private.set_exchange_invite_token() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.invite_token := encode(extensions.gen_random_bytes(16), 'hex');
  return new;
end $$;

revoke execute on function private.set_exchange_invite_token() from public, anon, authenticated;

create trigger exchanges_set_invite_token
  before insert on public.exchanges
  for each row execute function private.set_exchange_invite_token();

-- 6. Functions the app calls (SECURITY DEFINER, search_path empty, signed-in only) ----------------

-- GCO-001..003: start an exchange. The only write path.
--
-- WHY dates, times and the zone as arguments and not timestamps: the client sends what the person
-- picked; Postgres turns "date + time in this zone" into an instant, so the rules below hold exactly
-- and no client clock is trusted. The caller is auth.uid(); a user id is never an argument.
--
-- "At join-by time" (draw_mode at_join_by): join-by = draw = p_join_by_date + p_draw_time in the zone.
-- "When I choose" (organiser_chooses): joining closes at the end of the join-by day (the next local
-- midnight, exclusive), there is no draw time, p_draw_time is ignored, and the join-by DAY must be
-- before the gift DAY.
--
-- WHY errors are 22023 with the field as the hint (name, note, budget, join_by, event, time_zone):
-- the form puts the exact approved line under that field; the message itself carries no data. A join-by
-- that is not before the gift moment is reported on join_by (the field to move earlier). Order: the
-- gift moment is checked in the past before the join-by moment, so a gift date in the past is
-- reported on the gift field.
--
-- WHY tint is the colour least used among the caller's LIVE exchanges (not cancelled, not completed),
-- ties random (owner decision 7); it is stored and never changes.
--
-- WHY exchange first, member second, as separate statements: the policy helpers are STABLE and
-- cannot see a row written earlier in the same statement (CLAUDE.md "Database changes" trap 3).
create function public.create_exchange(
  p_name text,
  p_note text,
  p_budget public.exchange_budget_preset,
  p_join_by_date date,
  p_draw_mode public.exchange_draw_mode,
  p_draw_time time,
  p_event_date date,
  p_event_time time,
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
  v_event timestamptz;
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

  if p_event_date is null or p_event_time is null then
    raise exception 'invalid gift time' using errcode = '22023', hint = 'event';
  end if;
  v_event := (p_event_date + p_event_time) at time zone p_time_zone;
  if v_event <= now() then
    raise exception 'gift time in the past' using errcode = '22023', hint = 'event';
  end if;

  if p_join_by_date is null or p_draw_mode is null then
    raise exception 'invalid join-by' using errcode = '22023', hint = 'join_by';
  end if;
  if p_draw_mode = 'at_join_by' then
    if p_draw_time is null then
      raise exception 'invalid join-by' using errcode = '22023', hint = 'join_by';
    end if;
    v_join_by := (p_join_by_date + p_draw_time) at time zone p_time_zone;
    v_draw := v_join_by;
  else
    -- WHY the day rule on dates, not instants: "the day before the gift day" is what the person picked.
    if p_join_by_date >= p_event_date then
      raise exception 'join-by day not before gift day' using errcode = '22023', hint = 'join_by';
    end if;
    v_join_by := ((p_join_by_date + 1)::timestamp) at time zone p_time_zone;
    v_draw := null;
  end if;
  if v_join_by <= now() or v_join_by >= v_event then
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
    organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz,
    approval_required, tint
  ) values (
    v_uid, v_name, v_note, p_budget, v_join_by, p_draw_mode, v_draw, v_event, p_time_zone,
    coalesce(p_approval_required, false), v_tint
  )
  returning id into v_id;

  insert into public.exchange_members (exchange_id, user_id, taking_part, state)
  values (v_id, v_uid, coalesce(p_taking_part, true), 'active');

  return v_id;
end $$;

-- GC-013: the calculated status, for members only. Null for everyone else, so it never confirms an
-- exchange exists (same answer as "no such exchange"). Order: cancelled, complete, event passed, then
-- joining. A reopened join-by (GCO-006, slice 10) can only extend joining, hence greatest().
-- SLICE 10 REPLACES THIS to return 'drawn' once the caller's exchange has assignments; until then no
-- assignments exist, so 'drawn' is unreachable.
create function public.exchange_state(p_exchange uuid) returns public.exchange_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when e.cancelled_at is not null then 'cancelled'
    when e.completed_at is not null then 'complete'
    when now() >= e.event_at then 'event_passed'
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

-- GCO-004: the organiser's invite link needs the token, which no client can select. One answer,
-- P0002, for a member who is not the organiser, an outsider and an unknown id.
create function public.get_exchange_invite_token(p_exchange uuid) returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select e.invite_token into v_token
  from public.exchanges e
  where e.id = p_exchange and e.organiser_id = auth.uid();
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  return v_token;
end $$;

-- WHY explicit: harden_defaults already closes new functions; open each to signed-in people only.
revoke execute on function public.create_exchange(
  text, text, public.exchange_budget_preset, date, public.exchange_draw_mode, time, date, time, text, boolean, boolean
) from public, anon, authenticated;
revoke execute on function public.exchange_state(uuid) from public, anon, authenticated;
revoke execute on function public.get_exchange_invite_token(uuid) from public, anon, authenticated;

grant execute on function public.create_exchange(
  text, text, public.exchange_budget_preset, date, public.exchange_draw_mode, time, date, time, text, boolean, boolean
) to authenticated;
grant execute on function public.exchange_state(uuid) to authenticated;
grant execute on function public.get_exchange_invite_token(uuid) to authenticated;
