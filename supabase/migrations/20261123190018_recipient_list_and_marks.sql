-- recipient_list_and_marks — slice 11 (GC-015 the recipient's list and got-it marks, GC-010 the exchange list after the draw,
-- GC-013/GC-014 deferrals from slice 10; plan implementation-plan slice 11; owner decisions 2026-11-23 Q1-Q9 in
-- docs/tasks/slice-11.md; schema approved 2026-11-23; closes open item 110 for get_my_recipient).
--
-- Tests written first: supabase/tests/security/340_gift_marks.sql (the table), 350_recipient_list.sql (the giver's list, the
-- marks, the state rules), 360_list_after_draw.sql (attach, ideas and detach after the draw). Changed as approved with the
-- behaviour: 310 (attaching after the draw is no longer refused outright; assertion 15).
-- Needs 20261122215259_draw_and_reveal first (assignments, get_my_recipient) and 20261113151507_exchange_lists (the attach
-- functions replaced here).
--
-- WHAT THIS ADDS
--   private.gift_marks         which items a giver has marked as got, per assignment. RLS on, NO policy, NO grant to any role.
--   open_recipient_list        the giver's read of the person's list (items, Updated, got, taken off). Volatile: it stamps
--                              list_last_opened_at AFTER computing Updated from the previous value.
--   set_gift_mark              marks or unmarks one item by its reference. Idempotent.
--   detach_wishlist            Remove wishlist... after the draw: the member's personal list leaves the exchange.
--   get_my_recipient           create or replace: the same columns, plus the state check (item 110).
--   attach_wishlist,
--   use_exchange_ideas         create or replace: after the draw they work only when nothing is attached.
--
-- WHY marks are scoped by ASSIGNMENT (core rule, GC-015, GC-020): a mark belongs to the giver's row, never to the item or the
-- list. The owner, the organiser and every other giver have no path to it: the table has no grant, the two functions that touch
-- it filter on auth.uid() being the GIVER of a current, revealed row, and nothing in wishlists or wishlist_items changes when a
-- mark is written (no updated_at, no activity event, no email). The reference an item has in the answer is md5(row salt || item
-- id): a reference means nothing to anyone but the giver of that row and stops resolving when the row is replaced.
-- WHY no cascades (never-do 8): foreign keys are NO ACTION. A mark is removed only by its giver, through set_gift_mark.
-- WHY the state is checked in the database (item 110, GC-015): the list and the marks exist while the exchange is drawn or the
-- gift day has passed (event_passed). A complete or cancelled exchange reads nothing (owner decision Q5).

-- 1. The table --------------------------------------------------------------------------------------------------------
create table private.gift_marks (
  assignment_id uuid not null references private.assignments (id),
  item_id uuid not null references public.wishlist_items (id),
  created_at timestamptz not null default now(),
  -- WHY the pair as the key: one mark per giver row and item; marking twice is a no-op in set_gift_mark.
  primary key (assignment_id, item_id)
);

alter table private.gift_marks enable row level security;
-- WHY no grant to service_role either: nothing outside the two definer functions below may read what a giver has marked.
revoke all on private.gift_marks from public, anon, authenticated, service_role;

-- 2. The recipient, with the state check (item 110) --------------------------------------------------------------------
-- Same body, columns and grants as 20261122215259_draw_and_reveal plus the line marked NEW. WHY: slice 10 left the state to
-- the app; a complete or cancelled exchange must read nothing, whoever asks.
create or replace function public.get_my_recipient(p_exchange uuid)
returns table (display_name text, avatar_path text, list_state text, most_wanted jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select rp.display_name, rp.avatar_path,
         case
           when not private.member_has_list(rm.attached_wishlist_id) then 'none'
           when exists (select 1 from public.wishlist_items i where i.wishlist_id = rm.attached_wishlist_id and i.deleted_at is null) then 'items'
           else 'empty'
         end,
         coalesce((
           select jsonb_agg(jsonb_build_object('ref', md5(a.ref_salt || t.id::text), 'name', t.name, 'price_kobo', t.price_kobo)
                            order by t.updated_at desc, t.id)
             from (
               select i.id, i.name, i.price_kobo, i.updated_at
                 from public.wishlist_items i
                where i.wishlist_id = rm.attached_wishlist_id and i.priority = 'most_wanted' and i.deleted_at is null
                order by i.updated_at desc, i.id
                limit 3
             ) t
         ), '[]'::jsonb)
  from private.assignments a
  join public.exchange_members g on g.id = a.giver_member_id
  join public.exchange_members rm on rm.id = a.receiver_member_id
  join public.profiles rp on rp.id = rm.user_id
  where a.exchange_id = p_exchange and a.superseded_at is null
    and g.user_id = auth.uid() and g.state = 'active'
    -- NEW: drawn or after the gift day only.
    and private.exchange_status(p_exchange) in ('drawn', 'event_passed')
$$;

-- 3. The giver's list (GC-015) ------------------------------------------------------------------------------------------
-- The person the caller gives to and their list, for the giver's CURRENT, REVEALED row while the exchange is drawn or after the
-- gift day. Zero rows for everyone else: an organiser who only organises, an outsider, a giver who has not revealed, a replaced
-- row, a complete or cancelled exchange, an unknown exchange. Refusal: 42501 not signed in.
--   display_name, avatar_path  the person's own profile fields.
--   list_state  none (nothing attached, or an ideas list with no items), empty (a list with no live items), items.
--   items       every live item of the attached list, recently changed first, each exactly
--               {ref, name, priority, note, price_kobo, link, updated, got}. ref = md5(this row's salt || the item id).
--               updated: the item changed after the previous open (false on a first open). got: this giver marked it.
--               No item id, wishlist id, list name or source.
--   taken_off   items this giver marked that are no longer on the attached list: deleted, or on a list the person removed or
--               replaced (Q6). Each {ref, name}; the giver can unmark them.
-- WHY Updated is computed BEFORE the time is stamped (Q2): the badge answers "changed since you last looked". The stamp is the
-- moment of the open (clock_timestamp), so a second open straight after shows nothing, and a reload or a second tab clears it.
-- WHY the same function stamps: one call is one open; the page needs the answer and the stamp from the same instant.
-- WHY a row never opened shows no badges: there is no attached_at column to compare, and a list attached after the last open
-- must not light up every item.
create function public.open_recipient_list(p_exchange uuid)
returns table (display_name text, avatar_path text, list_state text, items jsonb, taken_off jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_status public.exchange_status;
  v_aid uuid;
  v_salt text;
  v_prev timestamptz;
  v_list uuid;
  v_name text;
  v_avatar text;
  v_state text;
  v_items jsonb;
  v_taken jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  v_status := private.exchange_status(p_exchange);
  if v_status is null or v_status not in ('drawn', 'event_passed') then
    return;
  end if;

  select a.id, a.ref_salt, a.list_last_opened_at, rm.attached_wishlist_id, rp.display_name, rp.avatar_path
    into v_aid, v_salt, v_prev, v_list, v_name, v_avatar
    from private.assignments a
    join public.exchange_members g on g.id = a.giver_member_id
    join public.exchange_members rm on rm.id = a.receiver_member_id
    join public.profiles rp on rp.id = rm.user_id
   where a.exchange_id = p_exchange and a.superseded_at is null and a.revealed_at is not null
     and g.user_id = v_uid and g.state = 'active';
  if not found then
    return;
  end if;

  v_state := case
    when not private.member_has_list(v_list) then 'none'
    when exists (select 1 from public.wishlist_items i where i.wishlist_id = v_list and i.deleted_at is null) then 'items'
    else 'empty'
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'ref', md5(v_salt || i.id::text),
           'name', i.name,
           'priority', i.priority::text,
           'note', i.note,
           'price_kobo', i.price_kobo,
           'link', i.link,
           'updated', (v_prev is not null and i.updated_at > v_prev),
           'got', exists (select 1 from private.gift_marks m where m.assignment_id = v_aid and m.item_id = i.id)
         ) order by i.updated_at desc, i.id), '[]'::jsonb)
    into v_items
    from public.wishlist_items i
   where i.wishlist_id = v_list and i.deleted_at is null;

  -- WHY the coalesce: with no attached list the comparison is null, which must read as "not on the list" (Q6).
  select coalesce(jsonb_agg(jsonb_build_object('ref', md5(v_salt || i.id::text), 'name', i.name)
                            order by m.created_at desc, i.id), '[]'::jsonb)
    into v_taken
    from private.gift_marks m
    join public.wishlist_items i on i.id = m.item_id
   where m.assignment_id = v_aid
     and not coalesce(i.wishlist_id = v_list and i.deleted_at is null, false);

  -- Stamp last: Updated above was computed from the previous value.
  update private.assignments set list_last_opened_at = clock_timestamp() where id = v_aid;

  display_name := v_name;
  avatar_path := v_avatar;
  list_state := v_state;
  items := v_items;
  taken_off := v_taken;
  return next;
end $$;

-- 4. Mark and unmark (GC-015) ----------------------------------------------------------------------------------------
-- Marks or unmarks one item as got, for the caller's CURRENT, REVEALED row while the exchange is drawn or after the gift day.
-- Refusals: 42501 not signed in; P0002 for everything the caller should not be able to tell apart (not a giver here, not
-- revealed, a closed exchange, an unknown exchange, a reference that is not theirs, an item no longer on the list that is not
-- marked); 22023 with the hint got when the value is null. Nothing is written on a refusal.
-- WHY the reference is resolved only among the items of the person's attached list and the items this row already marked: the
-- first lets a live item be marked; the second lets a taken-off item be unmarked. A reference of another giver, of a replaced
-- row, or an item id matches neither.
-- WHY marking needs a live item and unmarking does not: a giver can take back a mark on something the person removed.
-- WHY idempotent: a double tap or a second tab must not fail or write twice.
create function public.set_gift_mark(p_exchange uuid, p_ref text, p_got boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.exchange_status;
  v_aid uuid;
  v_salt text;
  v_list uuid;
  v_item uuid;
  v_live boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  v_status := private.exchange_status(p_exchange);
  if v_status is null or v_status not in ('drawn', 'event_passed') then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;

  select a.id, a.ref_salt, rm.attached_wishlist_id
    into v_aid, v_salt, v_list
    from private.assignments a
    join public.exchange_members g on g.id = a.giver_member_id
    join public.exchange_members rm on rm.id = a.receiver_member_id
   where a.exchange_id = p_exchange and a.superseded_at is null and a.revealed_at is not null
     and g.user_id = v_uid and g.state = 'active';
  if not found then
    raise exception 'no assignment' using errcode = 'P0002';
  end if;

  if p_got is null then
    raise exception 'a value is needed' using errcode = '22023', hint = 'got';
  end if;

  select t.id, t.live
    into v_item, v_live
    from (
      select i.id, true as live
        from public.wishlist_items i
       where i.wishlist_id = v_list and i.deleted_at is null
      union all
      select m.item_id, false
        from private.gift_marks m
       where m.assignment_id = v_aid
    ) t
   where md5(v_salt || t.id::text) = p_ref
   order by t.live desc
   limit 1;
  if v_item is null or (p_got and not v_live) then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  if p_got then
    insert into private.gift_marks (assignment_id, item_id) values (v_aid, v_item)
    on conflict (assignment_id, item_id) do nothing;
  else
    delete from private.gift_marks where assignment_id = v_aid and item_id = v_item;
  end if;
end $$;

-- 5. Attach and ideas after the draw (GC-010) ---------------------------------------------------------------------------------
-- Same bodies, signatures and grants as 20261113151507_exchange_lists plus the lines marked NEW. After the draw (drawn) and after
-- the gift day (event_passed) a member can attach a list or start ideas ONLY when nothing is attached. WHY "nothing" is
-- private.member_has_list = false: that is the rule the giver's list state uses, so the member can change exactly what the giver
-- would read as "none": no list, or an ideas list with no live items. A personal list, an ideas list with items and a kept list
-- (its list was deleted) all count as something. Refusal: P0002 with the hint attached (the caller knows what they attached).
-- Complete and cancelled are refused as before. Before the draw nothing changes.
-- WHY the member row is locked (for update): two taps must not both pass "nothing attached".
create or replace function public.attach_wishlist(p_exchange uuid, p_wishlist uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_taking boolean;
  v_attached uuid;
  v_status public.exchange_status;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select m.taking_part, m.attached_wishlist_id into v_taking, v_attached
    from public.exchange_members m
   where m.exchange_id = p_exchange and m.user_id = v_uid and m.state = 'active'
   for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if not v_taking then
    raise exception 'not taking part' using errcode = '22023', hint = 'not_taking_part';
  end if;
  v_status := private.exchange_status(p_exchange);
  -- NEW: after the draw, only when nothing is attached.
  if v_status in ('drawn', 'event_passed') then
    if private.member_has_list(v_attached) then
      raise exception 'a list is already attached' using errcode = 'P0002', hint = 'attached';
    end if;
  elsif v_status not in ('open', 'joining_closed') then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.wishlists w
    where w.id = p_wishlist and w.owner_id = v_uid and w.deleted_at is null
      and (w.kind = 'personal' or (w.kind = 'exchange_ideas' and w.exchange_id = p_exchange))
  ) then
    raise exception 'wishlist not found' using errcode = 'P0002';
  end if;

  update public.exchange_members
     set attached_wishlist_id = p_wishlist
   where exchange_id = p_exchange and user_id = v_uid and state = 'active';
end $$;

create or replace function public.use_exchange_ideas(p_exchange uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_taking boolean;
  v_attached uuid;
  v_status public.exchange_status;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select m.taking_part, m.attached_wishlist_id into v_taking, v_attached
    from public.exchange_members m
   where m.exchange_id = p_exchange and m.user_id = v_uid and m.state = 'active'
   for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if not v_taking then
    raise exception 'not taking part' using errcode = '22023', hint = 'not_taking_part';
  end if;
  v_status := private.exchange_status(p_exchange);
  -- NEW: after the draw, only when nothing is attached.
  if v_status in ('drawn', 'event_passed') then
    if private.member_has_list(v_attached) then
      raise exception 'a list is already attached' using errcode = 'P0002', hint = 'attached';
    end if;
  elsif v_status not in ('open', 'joining_closed') then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;

  select w.id into v_id
    from public.wishlists w
   where w.owner_id = v_uid and w.exchange_id = p_exchange and w.kind = 'exchange_ideas'
     and w.deleted_at is null;
  if v_id is null then
    begin
      insert into public.wishlists (owner_id, kind, name, visibility, exchange_id)
      values (v_uid, 'exchange_ideas', 'Exchange ideas', 'private', p_exchange)
      returning id into v_id;
    exception when unique_violation then
      select w.id into v_id
        from public.wishlists w
       where w.owner_id = v_uid and w.exchange_id = p_exchange and w.kind = 'exchange_ideas';
    end;
  end if;

  update public.exchange_members
     set attached_wishlist_id = v_id
   where exchange_id = p_exchange and user_id = v_uid and state = 'active';
  return v_id;
end $$;

-- 6. Remove wishlist... (GC-010, Q7) --------------------------------------------------------------------------------------------
-- The caller's PERSONAL list leaves the exchange: attached_wishlist_id becomes null. The list, its items and the giver's marks
-- are untouched, so attaching the same list again (Undo) puts everything back. Only after the draw (drawn) and after the gift day
-- (event_passed). Refusals: 42501 not signed in; P0002 not an active member, a state that is not drawn or event_passed, nothing
-- attached; 22023 with the hint not_taking_part (an organiser who only organises), kept (the attached list was deleted: its items
-- stay for the giver, GC-030), ideas (an ideas list is emptied item by item, Q7).
-- WHY only after the draw: before it the member switches with attach_wishlist; there is nothing to "remove" a list from yet.
create function public.detach_wishlist(p_exchange uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_taking boolean;
  v_attached uuid;
  v_status public.exchange_status;
  w public.wishlists%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select m.taking_part, m.attached_wishlist_id into v_taking, v_attached
    from public.exchange_members m
   where m.exchange_id = p_exchange and m.user_id = v_uid and m.state = 'active'
   for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if not v_taking then
    raise exception 'not taking part' using errcode = '22023', hint = 'not_taking_part';
  end if;
  v_status := private.exchange_status(p_exchange);
  if v_status is null or v_status not in ('drawn', 'event_passed') then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if v_attached is null then
    raise exception 'nothing attached' using errcode = 'P0002';
  end if;
  select * into w from public.wishlists x where x.id = v_attached and x.owner_id = v_uid;
  if not found then
    raise exception 'nothing attached' using errcode = 'P0002';
  end if;
  if w.deleted_at is not null then
    raise exception 'the list was deleted' using errcode = '22023', hint = 'kept';
  end if;
  if w.kind <> 'personal' then
    raise exception 'ideas are removed item by item' using errcode = '22023', hint = 'ideas';
  end if;

  update public.exchange_members
     set attached_wishlist_id = null
   where exchange_id = p_exchange and user_id = v_uid and state = 'active';
end $$;

-- 7. Grants ---------------------------------------------------------------------------------------------------------------------
-- WHY revoke first, then grant to signed-in people only: new functions start closed (harden_defaults) and PUBLIC would otherwise
-- reach anon. None of these is on the anon allowlist (test 030). The replaced functions keep their grants; they are repeated so
-- this file states the final state.
revoke execute on function public.open_recipient_list(uuid) from public, anon, authenticated;
revoke execute on function public.set_gift_mark(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.detach_wishlist(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_recipient(uuid) from public, anon, authenticated;
revoke execute on function public.attach_wishlist(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.use_exchange_ideas(uuid) from public, anon, authenticated;

grant execute on function public.open_recipient_list(uuid) to authenticated;
grant execute on function public.set_gift_mark(uuid, text, boolean) to authenticated;
grant execute on function public.detach_wishlist(uuid) to authenticated;
grant execute on function public.get_my_recipient(uuid) to authenticated;
grant execute on function public.attach_wishlist(uuid, uuid) to authenticated;
grant execute on function public.use_exchange_ideas(uuid) to authenticated;
