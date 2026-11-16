-- join_requests — slice 6 (GCO-003, GCO-005, GCO-007 before the draw, GC-006, GC-008, GC-009, GC-012, GC-029;
-- plan §3, §5, §6 invariants 8-10; owner decisions 2026-11-14 Q1-Q18).
--
-- Tests written first: supabase/tests/security/190_join_requests.sql (and 170 for the can_ask key).
-- Needs 20261114205923_activity_events first (request_to_join writes the join_requested event).
--
-- WHAT THIS ADDS
--   public.join_request_status    'pending' | 'approved' | 'declined' | 'closed' ('closed' is written by the
--                                 draw in slice 10; nothing here sets it).
--   public.join_requests          one row per ask. RLS on, no client grants.
--   request_to_join(token)        the explicit Ask to join (Q3). Token only, never an exchange id.
--   get_join_requests(exchange)   the organiser's pending requests: name and time only.
--   approve_join_request(id), decline_join_request(id)
--   list_my_join_requests()       the asker's own pending rows (names and times only).
--   get_participants(exchange)    the organiser's list of active members (S30).
--   remove_member(member)         organiser removes a member before the draw (GCO-007).
--   get_removed_exchange_name(x)  "You're no longer in {exchange}" (Q15): the name, only for the removed person.
--   get_invite_preview / get_join_details   create or replace: gain can_ask; join details also gain the viewer
--                                 'requested' and show names to someone who could ask on an approval exchange.
--   private.enforce_rate_limit    create or replace: 'request_to_join' is 20 an hour per person (Q9).
--
-- WHY no email anywhere: the organiser never reads addresses (core rule). Every read here returns display
-- names and times, never an address, an avatar path, a user id or a list status.
-- WHY no cascades (never-do 8): foreign keys are NO ACTION.
-- WHY the status allow-list (open, joining_closed) and not "not cancelled": slice 10 adds 'drawn' to
-- private.exchange_status, and every function below then refuses it without being edited.

-- 1. Status and table ------------------------------------------------------------------------------
create type public.join_request_status as enum ('pending', 'approved', 'declined', 'closed');

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges (id),
  -- WHY no default of auth.uid() and no client grant: request_to_join is the only writer.
  user_id uuid not null references public.profiles (id),
  status public.join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  -- WHY: set by the asker's Dismiss (slice 10); a pending row is never dismissed.
  dismissed_at timestamptz,
  constraint join_requests_decided_matches_status check ((status = 'pending') = (decided_at is null)),
  constraint join_requests_dismiss_after_decision check (dismissed_at is null or status <> 'pending')
);

-- WHY partial: a person whose request was declined may ask again, so only PENDING rows are unique.
create unique index join_requests_one_pending_idx on public.join_requests (exchange_id, user_id)
  where status = 'pending';
-- WHY: the organiser's list and the asker's list.
create index join_requests_exchange_pending_idx on public.join_requests (exchange_id, created_at, id)
  where status = 'pending';
create index join_requests_user_pending_idx on public.join_requests (user_id, created_at desc)
  where status = 'pending';

alter table public.join_requests enable row level security;
revoke all on public.join_requests from public, anon, authenticated;

-- 2. Rate limit (Q9) -------------------------------------------------------------------------------
-- Same function as 20261113105806_rate_limits plus one action. WHY create or replace: owner and grants stay.
create or replace function private.enforce_rate_limit(p_action text) returns void
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
    when 'request_to_join' then 20
  end;
  if v_max is null then
    raise exception 'unknown rate limit action' using errcode = '22023';
  end if;
  if not private.hit_rate_limit(p_action || ':' || v_uid::text, v_max, interval '1 hour') then
    raise exception 'rate limited' using errcode = 'P0429';
  end if;
end $$;

-- 3. Ask to join -----------------------------------------------------------------------------------
-- Who may ask (Q4): on an open exchange that needs approval; a removed person on an open exchange or after
-- join-by; anyone after join-by until the draw. Never when full, cancelled, the gift day has passed or the
-- exchange is complete. An open exchange without approval says "join instead" (hint can_join), and an
-- active member is told so (hint member). Refusals are 22023 with the reason as the hint; nothing is written.
--
-- WHY the exchange row is locked first: two simultaneous asks, or an ask racing the 100th place, are
-- serialised; the partial unique index is the second guard.
-- WHY the pending answer comes before the status checks: asking again is idempotent and tells the person
-- nothing they did not already know.
-- WHY the rate limit is hit last: a refused ask never counts, and a P0429 rolls its count back with it.
-- WHY onboarded_at is set (Q10): like join, asking from an invite link counts as having been through setup.
create function public.request_to_join(p_token text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_removed boolean;
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

  if exists (
    select 1 from public.exchange_members m
    where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active'
  ) then
    raise exception 'already a member' using errcode = '22023', hint = 'member';
  end if;

  if exists (
    select 1 from public.join_requests r
    where r.exchange_id = e.id and r.user_id = v_uid and r.status = 'pending'
  ) then
    update public.profiles
       set onboarded_at = coalesce(onboarded_at, clock_timestamp())
     where id = v_uid;
    return 'pending';
  end if;

  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'joining closed' using errcode = '22023', hint = 'closed';
  end if;
  if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
    raise exception 'exchange full' using errcode = '22023', hint = 'full';
  end if;

  v_removed := coalesce((
    select m.state = 'removed' from public.exchange_members m
     where m.exchange_id = e.id and m.user_id = v_uid
     order by m.joined_at desc, m.left_at desc nulls first
     limit 1
  ), false);
  if v_state = 'open' and not e.approval_required and not v_removed then
    raise exception 'join directly' using errcode = '22023', hint = 'can_join';
  end if;

  perform private.enforce_rate_limit('request_to_join');

  insert into public.join_requests (exchange_id, user_id) values (e.id, v_uid);
  perform private.add_activity_event(e.organiser_id, e.id, 'join_requested', v_uid);

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, clock_timestamp())
   where id = v_uid;

  return 'pending';
end $$;

-- 4. The organiser's reads -------------------------------------------------------------------------
-- WHY empty (not an error) for anyone who is not the organiser: same as get_exchange_people, a member or
-- outsider learns nothing, not even that requests exist (AC-42). Name and time only, oldest first.
create function public.get_join_requests(p_exchange uuid)
returns table (request_id uuid, display_name text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.display_name, r.created_at
  from public.join_requests r
  join public.exchanges e on e.id = r.exchange_id
  join public.profiles p on p.id = r.user_id
  where r.exchange_id = p_exchange
    and r.status = 'pending'
    and e.organiser_id = auth.uid()
  order by r.created_at, r.id
$$;

-- WHY no list status and no email: the privacy line on S30 (AC-17). The organiser sees who is taking part
-- and nothing about wishlists or pairs.
create function public.get_participants(p_exchange uuid)
returns table (member_id uuid, display_name text, is_me boolean, is_organiser boolean, taking_part boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, p.display_name, (m.user_id = auth.uid()), (m.user_id = e.organiser_id), m.taking_part
  from public.exchange_members m
  join public.exchanges e on e.id = m.exchange_id
  join public.profiles p on p.id = m.user_id
  where m.exchange_id = p_exchange
    and m.state = 'active'
    and e.organiser_id = auth.uid()
  order by (m.user_id = e.organiser_id) desc, m.joined_at, m.id
$$;

-- 5. Approve, decline ------------------------------------------------------------------------------
-- WHY P0002 for a non-organiser, an unknown id and a request on someone else's exchange: one answer.
-- WHY the exchange is locked before the request: the same order as request_to_join and remove_member.
-- Refusals are 22023 with a hint: decided (already approved, declined or closed), cancelled, closed, full.
-- A requester who is somehow already an active member counts as approved (their membership is returned).
-- WHY no activity event (Q11): approving writes none; the organiser did it themselves.
create function public.approve_join_request(p_request uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  r public.join_requests%rowtype;
  v_state public.exchange_status;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select x.* into e
    from public.exchanges x
    join public.join_requests jr on jr.exchange_id = x.id
   where jr.id = p_request and x.organiser_id = v_uid
     for update of x;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  select * into r from public.join_requests where id = p_request for update;
  if r.status <> 'pending' then
    raise exception 'already decided' using errcode = '22023', hint = 'decided';
  end if;

  select m.id into v_id
    from public.exchange_members m
   where m.exchange_id = e.id and m.user_id = r.user_id and m.state = 'active';

  if v_id is null then
    v_state := private.exchange_status(e.id);
    if v_state = 'cancelled' then
      raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
    elsif v_state not in ('open', 'joining_closed') then
      raise exception 'joining closed' using errcode = '22023', hint = 'closed';
    end if;
    if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
      raise exception 'exchange full' using errcode = '22023', hint = 'full';
    end if;
    insert into public.exchange_members (exchange_id, user_id, taking_part, state)
    values (e.id, r.user_id, true, 'active')
    returning id into v_id;
  end if;

  update public.join_requests set status = 'approved', decided_at = now() where id = r.id;
  return v_id;
end $$;

-- WHY any exchange state is allowed: declining only closes the request; nothing is added.
create function public.decline_join_request(p_request uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select jr.* into r
    from public.join_requests jr
    join public.exchanges x on x.id = jr.exchange_id
   where jr.id = p_request and x.organiser_id = v_uid
     for update of jr;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'already decided' using errcode = '22023', hint = 'decided';
  end if;
  update public.join_requests set status = 'declined', decided_at = now() where id = r.id;
end $$;

-- 6. The asker's own pending rows ------------------------------------------------------------------
-- WHY pending only (Q8): a declined request disappears from the asker's list without a word.
create function public.list_my_join_requests()
returns table (
  request_id uuid,
  exchange_name text,
  exchange_tint public.exchange_tint,
  organiser_name text,
  status public.join_request_status,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, e.name, e.tint, o.display_name, r.status, r.created_at
  from public.join_requests r
  join public.exchanges e on e.id = r.exchange_id
  join public.profiles o on o.id = e.organiser_id
  where r.user_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc, r.id desc
$$;

-- 7. Remove a member (GCO-007 before the draw) -----------------------------------------------------
-- The row is kept (state removed, left_at set) so a later ask is recognised as a removed person's.
-- P0002 for a non-organiser or unknown member. Refusals are 22023: organiser (never the organiser's own
-- row), inactive (already left or removed), cancelled, closed. No activity event (Q11).
create function public.remove_member(p_member uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  m public.exchange_members%rowtype;
  v_state public.exchange_status;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select x.* into e
    from public.exchanges x
    join public.exchange_members mm on mm.exchange_id = x.id
   where mm.id = p_member and x.organiser_id = v_uid
     for update of x;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  select * into m from public.exchange_members where id = p_member for update;
  if m.user_id = e.organiser_id then
    raise exception 'cannot remove the organiser' using errcode = '22023', hint = 'organiser';
  end if;
  if m.state <> 'active' then
    raise exception 'not an active member' using errcode = '22023', hint = 'inactive';
  end if;
  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'removal closed' using errcode = '22023', hint = 'closed';
  end if;
  update public.exchange_members set state = 'removed', left_at = now() where id = m.id;
end $$;

-- WHY the name only, and only for the removed person (Q15): the page "You're no longer in {exchange}" needs
-- one name. The latest membership must be a removal and there must be no active one.
create function public.get_removed_exchange_name(p_exchange uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.name
  from public.exchanges e
  where e.id = p_exchange
    and not exists (
      select 1 from public.exchange_members a
      where a.exchange_id = e.id and a.user_id = auth.uid() and a.state = 'active'
    )
    and (
      select m.state from public.exchange_members m
       where m.exchange_id = e.id and m.user_id = auth.uid()
       order by m.joined_at desc, m.left_at desc nulls first
       limit 1
    ) = 'removed'
$$;

-- 8. The preview gains can_ask ---------------------------------------------------------------------
-- Same body as 20261114131116_invite_preview_draw, plus can_ask: whether the page offers Ask to join to a
-- visitor. WHY exchange rules only (a visitor has no membership to look at): an open exchange that needs
-- approval, or joining closed; never full, cancelled, event passed or complete. Status values are unchanged.
create or replace function public.get_invite_preview(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_active integer;
  v_joined integer;
  v_status text;
  v_inviter text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into e from public.exchanges where invite_token = p_token;
  if not found then
    return null;
  end if;

  v_state := private.exchange_status(e.id);
  select count(*), count(*) filter (where m.user_id <> e.organiser_id)
    into v_active, v_joined
    from public.exchange_members m
   where m.exchange_id = e.id and m.state = 'active';
  select p.display_name into v_inviter from public.profiles p where p.id = e.organiser_id;

  v_status := case
    when v_state = 'cancelled' then 'cancelled'
    when v_state <> 'open' then 'closed'
    when v_active >= 100 then 'full'
    when e.approval_required then 'approval'
    else 'open'
  end;

  return jsonb_build_object(
    'status', v_status,
    'exchange_name', e.name,
    'tint', e.tint,
    'inviter_name', v_inviter,
    'budget_preset', e.budget_preset,
    'join_by_at', e.join_by_at,
    'gift_day', e.gift_day,
    'joined_count', v_joined,
    'closed_at', case when v_status = 'closed'
      then greatest(e.join_by_at, coalesce(e.reopened_join_by_at, e.join_by_at)) end,
    'cancelled_at', e.cancelled_at,
    'draw_mode', e.draw_mode,
    'draw_at', e.draw_at,
    'can_ask', case
      when v_active >= 100 then false
      when v_state = 'open' then e.approval_required
      when v_state = 'joining_closed' then true
      else false
    end
  );
end $$;

-- 9. The join details gain can_ask and the viewer 'requested' ---------------------------------------
-- Same body as 20261113151444_invite_and_join, plus:
--   viewer 'requested'  the person has a pending request (after member, before removed and can_join).
--   can_ask             the same rules as request_to_join, for this person: not a member; open and either
--                       approval is required or they were removed; or joining closed; never full, cancelled,
--                       event passed or complete. A removed person on an open exchange can ask.
--   people              also shown to can_join when the status is approval (they are about to ask, GC-009).
--                       A removed or requested person still sees no names.
create or replace function public.get_join_details(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_status text;
  v_viewer text;
  v_latest public.exchange_member_state;
  v_active integer;
  v_organiser text;
  v_can_ask boolean;
  v_people jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into e from public.exchanges where invite_token = p_token;
  if not found then
    return null;
  end if;

  select count(*) into v_active
    from public.exchange_members m
   where m.exchange_id = e.id and m.state = 'active';

  v_state := private.exchange_status(e.id);
  v_status := case v_state
    when 'cancelled' then 'cancelled'
    when 'open' then case
      when v_active >= 100 then 'full'
      when e.approval_required then 'approval'
      else 'open' end
    else 'closed'
  end;

  select m.state into v_latest
    from public.exchange_members m
   where m.exchange_id = e.id and m.user_id = v_uid
   order by m.joined_at desc, m.left_at desc nulls first
   limit 1;

  if exists (
    select 1 from public.exchange_members m
    where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active'
  ) then
    v_viewer := 'member';
  elsif exists (
    select 1 from public.join_requests r
    where r.exchange_id = e.id and r.user_id = v_uid and r.status = 'pending'
  ) then
    v_viewer := 'requested';
  else
    v_viewer := case when v_latest = 'removed' then 'removed' else 'can_join' end;
  end if;

  v_can_ask := v_viewer <> 'member'
    and v_active < 100
    and (
      (v_state = 'open' and (e.approval_required or coalesce(v_latest = 'removed', false)))
      or v_state = 'joining_closed'
    );

  select p.display_name into v_organiser from public.profiles p where p.id = e.organiser_id;

  if v_viewer = 'member' or (v_viewer = 'can_join' and v_status in ('open', 'approval')) then
    select coalesce(jsonb_agg(
      jsonb_build_object('name', p.display_name, 'is_organiser', m.user_id = e.organiser_id)
      order by (m.user_id = e.organiser_id) desc, m.joined_at, m.id
    ), '[]'::jsonb)
      into v_people
      from public.exchange_members m
      join public.profiles p on p.id = m.user_id
     where m.exchange_id = e.id and m.state = 'active';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'viewer', v_viewer,
    'exchange_id', case when v_viewer = 'member' then e.id end,
    'exchange_name', e.name,
    'tint', e.tint,
    'organiser_name', v_organiser,
    'budget_preset', e.budget_preset,
    'join_by_at', e.join_by_at,
    'draw_mode', e.draw_mode,
    'draw_at', e.draw_at,
    'gift_day', e.gift_day,
    'note', e.note,
    'people', v_people,
    'can_ask', v_can_ask
  );
end $$;

-- 10. Grants ----------------------------------------------------------------------------------------
-- WHY revoke first, then grant to signed-in people only: new functions start closed (harden_defaults) and
-- PUBLIC would otherwise reach anon. The anon allowlist (test 030) is unchanged. get_invite_preview and
-- get_join_details keep their grants through create or replace.
revoke execute on function public.request_to_join(text) from public, anon, authenticated;
revoke execute on function public.get_join_requests(uuid) from public, anon, authenticated;
revoke execute on function public.get_participants(uuid) from public, anon, authenticated;
revoke execute on function public.approve_join_request(uuid) from public, anon, authenticated;
revoke execute on function public.decline_join_request(uuid) from public, anon, authenticated;
revoke execute on function public.list_my_join_requests() from public, anon, authenticated;
revoke execute on function public.remove_member(uuid) from public, anon, authenticated;
revoke execute on function public.get_removed_exchange_name(uuid) from public, anon, authenticated;

grant execute on function public.request_to_join(text) to authenticated;
grant execute on function public.get_join_requests(uuid) to authenticated;
grant execute on function public.get_participants(uuid) to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.decline_join_request(uuid) to authenticated;
grant execute on function public.list_my_join_requests() to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.get_removed_exchange_name(uuid) to authenticated;
