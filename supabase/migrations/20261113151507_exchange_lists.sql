-- exchange_lists — slice 5 (GC-010, GC-011, GC-013, GCO-004 S49; plan §3, §5, §6 invariants 7 and 10; closes open item 42).
--
-- Tests written first: supabase/tests/security/180_exchange_lists.sql. Owner decision 2026-11-13 (Q3):
-- the schema below is approved.
--
-- WHAT THIS ADDS
--   exchange_members.attached_wishlist_id   the list a member offers their giver. NO client grant: a
--                                           member's list status must not leak to co-members or the
--                                           organiser (GC-013: faces without list status).
--   wishlists.exchange_id                   marks the hidden per-exchange "ideas" list (kind
--                                           exchange_ideas). One ideas list per person per exchange.
--                                           No client write grant; the column is readable only as part
--                                           of the owner's own row (the table-level select grant and the
--                                           owner-only policy, unchanged).
--   attach_wishlist / use_exchange_ideas / get_my_exchange_list
--                                           the only ways to attach, switch and read the member's own
--                                           list status.
--   two policies on wishlist_items          let the owner add and edit items on their own ideas list
--                                           while they are in that exchange.
--   remove_wishlist_item / restore_wishlist_item replaced (same signatures) to accept the same ideas items.
--
-- RATE LIMIT: creating an ideas list inserts into public.wishlists, so the existing BEFORE INSERT trigger
-- wishlists_rate_limit (private.enforce_rate_limit, 30 an hour) counts it. Ideas items go through
-- wishlist_items_rate_limit the same way. No new counter.

-- 1. Columns ---------------------------------------------------------------------------------------
-- WHY no ON DELETE CASCADE (never-do 8): an attached list's items must outlive the list (GC-030).
-- WHY no new grant: exchange_members has column grants only (130), so a new column starts unreadable.
alter table public.exchange_members
  add column attached_wishlist_id uuid references public.wishlists (id);

alter table public.wishlists
  add column exchange_id uuid references public.exchanges (id);

-- WHY: an ideas list always belongs to an exchange, and a personal list never does.
alter table public.wishlists
  add constraint wishlists_ideas_have_exchange check ((kind = 'exchange_ideas') = (exchange_id is not null));

-- WHY partial unique: one ideas list per person and exchange; personal lists are unaffected.
create unique index wishlists_one_ideas_per_exchange_idx on public.wishlists (owner_id, exchange_id)
  where kind = 'exchange_ideas';

-- 2. Policies: items on the owner's own ideas list ---------------------------------------------------
-- WHY is_member(w.exchange_id) beside ownership: a person who left an exchange can no longer change what
-- they offered there. The select policy (own live list) already covers reading these items. The parent
-- subquery reads public.wishlists under the caller's own RLS, exactly as the personal policies do.
create policy wishlist_items_insert_own_ideas on public.wishlist_items
  for insert to authenticated
  with check (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.kind = 'exchange_ideas'
        and w.deleted_at is null and public.is_member(w.exchange_id)
    )
  );

create policy wishlist_items_update_own_ideas on public.wishlist_items
  for update to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.kind = 'exchange_ideas'
        and w.deleted_at is null and public.is_member(w.exchange_id)
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.kind = 'exchange_ideas'
        and w.deleted_at is null and public.is_member(w.exchange_id)
    )
  );

-- 3. remove / restore an item: personal lists, and the caller's own ideas lists ----------------------
-- Same signatures, same P0002 for every refusal (GC-020). Replaces the slice-2 versions, which accepted
-- personal lists only. Only the list condition changes.
create or replace function public.remove_wishlist_item(p_item_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wishlist_items i
     set deleted_at = clock_timestamp()
    from public.wishlists w
   where i.id = p_item_id
     and i.deleted_at is null
     and w.id = i.wishlist_id
     and w.owner_id = auth.uid()
     and w.deleted_at is null
     and (w.kind = 'personal' or (w.kind = 'exchange_ideas' and public.is_member(w.exchange_id)));
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.restore_wishlist_item(p_item_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wishlist_items i
     set deleted_at = null
    from public.wishlists w
   where i.id = p_item_id
     and i.deleted_at is not null
     and w.id = i.wishlist_id
     and w.owner_id = auth.uid()
     and w.deleted_at is null
     and (w.kind = 'personal' or (w.kind = 'exchange_ideas' and public.is_member(w.exchange_id)));
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end $$;

-- 4. Attach, ideas, and the member's own status ------------------------------------------------------
-- All three answer about the caller only (auth.uid()); no user id is ever an argument.

-- GC-010 / S49: attach one of the caller's lists to their place in the exchange.
-- Allowed: an active member who takes part, while the exchange is open or joining has closed (before the
-- draw; slice 11 widens this), attaching their own live personal list or their own ideas list for THIS
-- exchange. Refusals: P0002 for everything the caller should not be able to tell apart (not a member, a
-- person who left, wrong state, someone else's list, a deleted list, an ideas list of another exchange);
-- 22023 with hint not_taking_part for an organiser who is only organising.
create function public.attach_wishlist(p_exchange uuid, p_wishlist uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_taking boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select m.taking_part into v_taking
    from public.exchange_members m
   where m.exchange_id = p_exchange and m.user_id = v_uid and m.state = 'active';
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if not v_taking then
    raise exception 'not taking part' using errcode = '22023', hint = 'not_taking_part';
  end if;
  if private.exchange_status(p_exchange) not in ('open', 'joining_closed') then
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

-- GC-010 "Add items instead": the caller's ideas list for this exchange, created on first use, attached,
-- and returned. Calling it again returns the same list (one per person and exchange), so switching to a
-- wishlist and back brings the ideas back. Same rules and refusals as attach_wishlist.
-- WHY a fixed internal name: the list is never shown by name and never appears in My wishlists.
-- WHY the unique violation is caught: two quick taps cannot create two lists.
create function public.use_exchange_ideas(p_exchange uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_taking boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select m.taking_part into v_taking
    from public.exchange_members m
   where m.exchange_id = p_exchange and m.user_id = v_uid and m.state = 'active';
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if not v_taking then
    raise exception 'not taking part' using errcode = '22023', hint = 'not_taking_part';
  end if;
  if private.exchange_status(p_exchange) not in ('open', 'joining_closed') then
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

-- GC-010 / GC-011 / GC-013 / S49: what the caller has offered, for the caller only. Null for anyone who is
-- not an active member of the exchange. Keys always present:
--   source       none | wishlist | ideas | kept
--   wishlist_id  the attached list (for ideas with no items yet, the ideas list: the page adds to it)
--   name         the personal list's name, or the name it had when it was deleted; null otherwise
--   item_count   live items on the attached list
-- none: nothing attached, or the ideas list has no items. kept: the attached list was soft-deleted, its
-- items are kept for the giver (GC-030). The ideas list's internal name is never returned.
create function public.get_my_exchange_list(p_exchange uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attached uuid;
  w public.wishlists%rowtype;
  v_items integer := 0;
  v_source text;
begin
  select m.attached_wishlist_id into v_attached
    from public.exchange_members m
   where m.exchange_id = p_exchange and m.user_id = auth.uid() and m.state = 'active';
  if not found then
    return null;
  end if;
  if v_attached is null then
    return jsonb_build_object('source', 'none', 'wishlist_id', null, 'name', null, 'item_count', 0);
  end if;

  select * into w from public.wishlists where id = v_attached and owner_id = auth.uid();
  if not found then
    return jsonb_build_object('source', 'none', 'wishlist_id', null, 'name', null, 'item_count', 0);
  end if;
  select count(*) into v_items from public.wishlist_items i where i.wishlist_id = w.id and i.deleted_at is null;

  v_source := case
    when w.deleted_at is not null then 'kept'
    when w.kind = 'exchange_ideas' and v_items = 0 then 'none'
    when w.kind = 'exchange_ideas' then 'ideas'
    else 'wishlist'
  end;
  return jsonb_build_object(
    'source', v_source,
    'wishlist_id', w.id,
    'name', case when v_source in ('wishlist', 'kept') then w.name end,
    'item_count', v_items
  );
end $$;

-- 5. Grants ---------------------------------------------------------------------------------------
-- WHY explicit: harden_defaults closes new functions; open each to signed-in people only. The replaced
-- remove/restore functions keep their grants; they are repeated so this file states the final state.
revoke execute on function public.attach_wishlist(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.use_exchange_ideas(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_exchange_list(uuid) from public, anon, authenticated;
revoke execute on function public.remove_wishlist_item(uuid) from public, anon, authenticated;
revoke execute on function public.restore_wishlist_item(uuid) from public, anon, authenticated;

grant execute on function public.attach_wishlist(uuid, uuid) to authenticated;
grant execute on function public.use_exchange_ideas(uuid) to authenticated;
grant execute on function public.get_my_exchange_list(uuid) to authenticated;
grant execute on function public.remove_wishlist_item(uuid) to authenticated;
grant execute on function public.restore_wishlist_item(uuid) to authenticated;
