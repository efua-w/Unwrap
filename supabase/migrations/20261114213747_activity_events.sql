-- activity_events — slice 6 (GCO-003, GC-006, GC-007; plan §3, §5, §6; owner decisions 2026-11-14 Q1, Q2, Q11, Q12).
--
-- Tests written first: supabase/tests/security/200_activity_events.sql (and 170 for join_exchange).
--
-- WHAT THIS ADDS
--   public.activity_kind          'member_joined' | 'join_requested'.
--   public.activity_events        one row per event per READER (the organiser). RLS on, no client grants.
--   private.add_activity_event    the only writer. No grants: called from other definer functions.
--   get_my_activity(...)          the caller's own events, newest first, keyset pages (limit 30, clamped 1..50).
--   get_unread_activity_count()   how many of the caller's events are unread.
--   mark_all_activity_read()      marks the caller's own events read.
--   join_exchange                 create or replace: writes one member_joined event for the organiser, on a
--                                 real insert only (not for the idempotent answer, not for the organiser).
--
-- WHY no pair data (core security rule; GC-007 "events never name a giver/recipient pair"): an event has one
-- reader and at most one subject. There is no column that could hold a second person, and no kind in v1 is
-- about the draw. The check below also stops a later kind from carrying a subject by accident.
-- WHY no cascades (never-do 8): foreign keys are NO ACTION.

-- 1. Kind and table --------------------------------------------------------------------------------
create type public.activity_kind as enum ('member_joined', 'join_requested');

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  -- WHY "reader", not "actor": the organiser reads these; the person who acted is subject_user_id.
  user_id uuid not null references public.profiles (id),
  exchange_id uuid not null references public.exchanges (id),
  kind public.activity_kind not null,
  subject_user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- WHY: a subject exists exactly for the two people events (join and ask), and for nothing else.
  constraint activity_events_subject_matches_kind
    check ((kind in ('member_joined', 'join_requested')) = (subject_user_id is not null))
);

-- WHY: the feed pages by (created_at, id) descending for one reader; the unread count reads a partial index.
create index activity_events_feed_idx on public.activity_events (user_id, created_at desc, id desc);
create index activity_events_unread_idx on public.activity_events (user_id) where read_at is null;

-- WHY RLS on and no grant at all: a direct read is refused with 42501 (tests 010 and 200); every read and
-- write is one of the functions below, which return names and times only.
alter table public.activity_events enable row level security;
revoke all on public.activity_events from public, anon, authenticated;

-- 2. The writer -------------------------------------------------------------------------------------
-- WHY private and no grants: only other definer functions (join_exchange, request_to_join) call it, so a
-- client can never write an event for someone else.
create function private.add_activity_event(
  p_user uuid,
  p_exchange uuid,
  p_kind public.activity_kind,
  p_subject uuid
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_events (user_id, exchange_id, kind, subject_user_id)
  values (p_user, p_exchange, p_kind, p_subject)
$$;

revoke execute on function private.add_activity_event(uuid, uuid, public.activity_kind, uuid) from public, anon, authenticated;

-- 3. Reading ----------------------------------------------------------------------------------------
-- WHY auth.uid() inside and no user id parameter (plan §6 invariant 8): a person reads only their own rows.
-- WHY keyset paging on (created_at, id): new events arriving while someone pages never shift a page, and
-- events with the same timestamp are neither skipped nor repeated. A before-time with no before-id pages
-- before every event of that instant.
-- WHY the limit is clamped here and not only in the app: 30 by default, never below 1, never above 50.
-- Names and times only: the exchange name and tint, and the subject's display name. No ids of people, no
-- emails, no list status, nothing about the draw.
create function public.get_my_activity(
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  kind public.activity_kind,
  exchange_id uuid,
  exchange_name text,
  exchange_tint public.exchange_tint,
  subject_name text,
  created_at timestamptz,
  is_unread boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select ae.id, ae.kind, ae.exchange_id, e.name, e.tint, p.display_name, ae.created_at, (ae.read_at is null)
  from public.activity_events ae
  join public.exchanges e on e.id = ae.exchange_id
  left join public.profiles p on p.id = ae.subject_user_id
  where ae.user_id = auth.uid()
    and (
      p_before_at is null
      or (ae.created_at, ae.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by ae.created_at desc, ae.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
$$;

create function public.get_unread_activity_count() returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.activity_events ae
  where ae.user_id = auth.uid() and ae.read_at is null
$$;

-- WHY only unread rows are touched: read_at keeps the moment it was first read.
create function public.mark_all_activity_read() returns void
language sql
security definer
set search_path = ''
as $$
  update public.activity_events
     set read_at = now()
   where user_id = auth.uid() and read_at is null
$$;

-- 4. join_exchange writes the member_joined event --------------------------------------------------
-- Same body as 20261113151444_invite_and_join, plus v_inserted and one private.add_activity_event call.
-- WHY on insert only: the idempotent answer and the unique_violation fallback are not a new person joining,
-- and the organiser joining their own exchange gets their existing row back.
create or replace function public.join_exchange(p_token text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_id uuid;
  v_inserted boolean := false;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  select * into e from public.exchanges where invite_token = p_token for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  select m.id into v_id
    from public.exchange_members m
   where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active';

  if v_id is null then
    v_state := private.exchange_status(e.id);
    if v_state = 'cancelled' then
      raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
    elsif v_state <> 'open' then
      raise exception 'joining closed' using errcode = '22023', hint = 'closed';
    end if;
    if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
      raise exception 'exchange full' using errcode = '22023', hint = 'full';
    end if;
    if (
      select m.state from public.exchange_members m
       where m.exchange_id = e.id and m.user_id = v_uid
       order by m.joined_at desc, m.left_at desc nulls first
       limit 1
    ) = 'removed' then
      raise exception 'removed from exchange' using errcode = '22023', hint = 'removed';
    end if;
    if e.approval_required then
      raise exception 'approval required' using errcode = '22023', hint = 'approval';
    end if;

    begin
      insert into public.exchange_members (exchange_id, user_id, taking_part, state)
      values (e.id, v_uid, true, 'active')
      returning id into v_id;
      v_inserted := true;
    exception when unique_violation then
      select m.id into v_id
        from public.exchange_members m
       where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active';
    end;
  end if;

  if v_inserted then
    perform private.add_activity_event(e.organiser_id, e.id, 'member_joined', v_uid);
  end if;

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, clock_timestamp())
   where id = v_uid;

  return v_id;
end $$;

-- 5. Grants -----------------------------------------------------------------------------------------
-- WHY revoke first, then grant to signed-in people only: new functions start closed (harden_defaults) and
-- PUBLIC would otherwise reach anon. The anon allowlist (test 030) is unchanged.
revoke execute on function public.get_my_activity(timestamptz, uuid, integer) from public, anon, authenticated;
revoke execute on function public.get_unread_activity_count() from public, anon, authenticated;
revoke execute on function public.mark_all_activity_read() from public, anon, authenticated;

grant execute on function public.get_my_activity(timestamptz, uuid, integer) to authenticated;
grant execute on function public.get_unread_activity_count() to authenticated;
grant execute on function public.mark_all_activity_read() to authenticated;
