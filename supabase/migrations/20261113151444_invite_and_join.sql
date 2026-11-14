-- invite_and_join — slice 5 (GC-002, GC-003, GC-004, GC-009, GC-011, GC-012, GC-013, GCO-005; plan §3, §5, §6).
--
-- Tests written first: supabase/tests/security/170_invite_and_join.sql (and 030 for the anon allowlist).
-- Owner decisions 2026-11-13 (docs/tasks/slice-5.md): Q1 onboarded_at, Q2 approval refused, Q4 people
-- through a function, Q5 counting rules, Q6 reset link.
--
-- WHAT THIS ADDS
--   private.exchange_status     the status CASE, once, for any exchange (no caller check). exchange_state
--                               below now calls it, so the invite functions and the member view agree.
--   get_invite_preview(token)   the signed-out invite page (GC-002). One of the two functions anon may
--                               execute (test 030). Null for anything unknown.
--   get_join_details(token)     the join confirmation (GC-009), signed in.
--   join_exchange(token)        the only way to become a member (open joining). Token only, never an id.
--   get_exchange_people(id)     co-member names for the member list (Q4), members only.
--   reset_invite_token(id)      a new invite link for the organiser (Q6); the old link stops working.
--
-- NOT HERE: approval requests and "removed" requests (slice 6 turns those refusals into requests), the
-- draw (slice 10). SLICE 10 REPLACES private.exchange_status to add 'drawn'.

-- 1. The status, once -----------------------------------------------------------------------------
-- WHY private and no caller check: it is only called from definer functions that have already decided the
-- caller may know. The order is the one exchange_state always had: cancelled, complete, event passed (the
-- gift day ends in the organiser's zone), then joining. A reopened join-by only extends joining.
create function private.exchange_status(p_exchange uuid) returns public.exchange_status
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
$$;

revoke execute on function private.exchange_status(uuid) from public, anon, authenticated;

-- WHY create or replace with the same signature: owner and grants stay. Same answer as before for
-- members, null for everyone else.
create or replace function public.exchange_state(p_exchange uuid) returns public.exchange_status
language sql
stable
security definer
set search_path = ''
as $$
  select private.exchange_status(e.id)
  from public.exchanges e
  where e.id = p_exchange
    and exists (
      select 1 from public.exchange_members m
      where m.exchange_id = e.id and m.user_id = auth.uid() and m.state = 'active'
    )
$$;

-- 2. The signed-out preview (GC-002) --------------------------------------------------------------
-- WHY SECURITY DEFINER: anon has no grant on exchanges, members or profiles. This function is the whole
-- public read path for an invite.
--
-- WHY one answer, null, for a malformed, unknown or reset token: the caller can never tell which.
--
-- WHY exactly these keys, always all ten (null where they do not apply): status, exchange_name, tint,
-- inviter_name, budget_preset, join_by_at, gift_day, joined_count, closed_at, cancelled_at. Never an id,
-- the token, the note, another person's name, an email, the organiser's zone or an avatar (core security
-- rule; GC-002: "joined count only"). A PERSON'S NAME other than the organiser's never goes in here.
--
-- WHY status is one of open | closed | cancelled | full | approval:
--   cancelled  cancelled_at is set
--   closed     joining has closed, or the gift day has passed, or the exchange is complete
--   full       100 active member rows, the organiser included (owner decision Q5)
--   approval   otherwise open, but the organiser approves each person; the database refuses a direct join
--              (owner decision Q2, until slice 6 builds requests), so the app shows the unavailable state
-- joined_count is active members other than the organiser (Q5). closed_at is the moment joining closed.
create function public.get_invite_preview(p_token text) returns jsonb
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
    'cancelled_at', e.cancelled_at
  );
end $$;

-- 3. The join confirmation (GC-009) ----------------------------------------------------------------
-- Signed in only. Null for a malformed or unknown token (the page shows "This invite can't be used").
--
-- viewer: member (active, the organiser included), removed (the latest membership was a removal), or
-- can_join (never in, or left: a person who left may join again, plan §2).
-- exchange_id: only for an active member, who needs it to go to the exchange page. Everyone else gets null,
-- so a stranger holding a forwarded link never learns an id.
-- people: [{name, is_organiser}], active members only, organiser first, no ids, no emails, no list status.
-- WHY only when the person is a member, or the invite is open and they could join: GC-009 shows the faces to
-- someone about to say yes; a removed person or an invite that cannot be used shows no names.
-- The signed-in person's own name and email are read by the app from their own profile and session.
create function public.get_join_details(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_status text;
  v_viewer text;
  v_latest public.exchange_member_state;
  v_active integer;
  v_organiser text;
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

  v_status := case private.exchange_status(e.id)
    when 'cancelled' then 'cancelled'
    when 'open' then case
      when v_active >= 100 then 'full'
      when e.approval_required then 'approval'
      else 'open' end
    else 'closed'
  end;

  if exists (
    select 1 from public.exchange_members m
    where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active'
  ) then
    v_viewer := 'member';
  else
    select m.state into v_latest
      from public.exchange_members m
     where m.exchange_id = e.id and m.user_id = v_uid
     order by m.joined_at desc, m.left_at desc nulls first
     limit 1;
    v_viewer := case when v_latest = 'removed' then 'removed' else 'can_join' end;
  end if;

  select p.display_name into v_organiser from public.profiles p where p.id = e.organiser_id;

  if v_viewer = 'member' or (v_viewer = 'can_join' and v_status = 'open') then
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
    'people', v_people
  );
end $$;

-- 4. Join (open joining) --------------------------------------------------------------------------
-- WHY the token and never an exchange id (plan §6 invariant 8): knowing an id grants nothing. Malformed,
-- unknown, exchange-id-as-token and reset tokens are all P0002, one answer.
--
-- WHY the row is locked first: two people taking the 100th place cannot both pass the count, and a person
-- tapping Join twice is serialised. The partial unique index is the second guard (23505 is caught and
-- answered as "already in").
--
-- WHY an active member is answered before any status check: Join is idempotent (the person gets their
-- membership back, the organiser's row is untouched, a member of a full or closed exchange is not told it
-- is unavailable). It tells them nothing they did not already know.
--
-- Refusals are 22023 with the reason as the hint, in this order: closed | cancelled, full, removed,
-- approval (the page shows "This invite can't be used" with the matching line). Nothing is written.
--
-- WHY onboarded_at is set here (owner decision Q1): an invitee arriving from the link skips Profile setup
-- and keeps the name given at sign-up; the first join counts as having been through setup. coalesce keeps
-- an earlier value. Only the caller's own row is touched, and only on a successful join.
create function public.join_exchange(p_token text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_id uuid;
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
    exception when unique_violation then
      select m.id into v_id
        from public.exchange_members m
       where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active';
    end;
  end if;

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, clock_timestamp())
   where id = v_uid;

  return v_id;
end $$;

-- 5. The people in an exchange (Q4) ---------------------------------------------------------------
-- WHY a narrow function and not a policy on profiles: co-members need names and nothing else of a profile
-- (no avatar path, no anonymised flag, no ids). Active members only, organiser first, then in join order;
-- empty for anyone who is not an active member (an outsider, a person who left or was removed).
-- Nothing here says who has a list or who gives to whom.
create function public.get_exchange_people(p_exchange uuid)
returns table (display_name text, is_organiser boolean, is_me boolean, taking_part boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, (m.user_id = e.organiser_id), (m.user_id = auth.uid()), m.taking_part
  from public.exchange_members m
  join public.exchanges e on e.id = m.exchange_id
  join public.profiles p on p.id = m.user_id
  where m.exchange_id = p_exchange
    and m.state = 'active'
    and exists (
      select 1 from public.exchange_members me
      where me.exchange_id = p_exchange and me.user_id = auth.uid() and me.state = 'active'
    )
  order by (m.user_id = e.organiser_id) desc, m.joined_at, m.id
$$;

-- 6. Reset the invite link (Q6, GCO-005) ----------------------------------------------------------
-- Organiser only, one answer (P0002) for everyone else, like get_exchange_invite_token. A cancelled or
-- complete exchange has no link worth resetting: 22023 with the state as the hint. The old token stops
-- working at once (preview null, join P0002); members are unaffected.
create function public.reset_invite_token(p_exchange uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.exchanges%rowtype;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into e from public.exchanges where id = p_exchange and organiser_id = auth.uid() for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if e.cancelled_at is not null then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  end if;
  if e.completed_at is not null then
    raise exception 'exchange complete' using errcode = '22023', hint = 'complete';
  end if;
  update public.exchanges
     set invite_token = encode(extensions.gen_random_bytes(16), 'hex')
   where id = e.id
  returning invite_token into v_token;
  return v_token;
end $$;

-- 7. Grants ---------------------------------------------------------------------------------------
-- WHY revoke first, then grant by role: new functions start closed (harden_defaults) and PUBLIC would
-- otherwise reach anon. anon may execute get_invite_preview only; it joins get_shared_wishlist as the
-- second function on the allowlist (test 030).
revoke execute on function public.get_invite_preview(text) from public, anon, authenticated;
revoke execute on function public.get_join_details(text) from public, anon, authenticated;
revoke execute on function public.join_exchange(text) from public, anon, authenticated;
revoke execute on function public.get_exchange_people(uuid) from public, anon, authenticated;
revoke execute on function public.reset_invite_token(uuid) from public, anon, authenticated;

grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.get_join_details(text) to authenticated;
grant execute on function public.join_exchange(text) to authenticated;
grant execute on function public.get_exchange_people(uuid) to authenticated;
grant execute on function public.reset_invite_token(uuid) to authenticated;
