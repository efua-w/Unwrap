-- wishlists — slice 2 (GC-018, GC-019, GC-020, GC-021; plan §5 "wishlists" and "wishlist_items").
--
-- Tests written first: supabase/tests/security/090_wishlists.sql, 100_wishlist_items.sql.
--
-- WHAT THIS ADDS
--   public.wishlists        a person's lists. `kind` separates personal lists from the hidden
--                           per-exchange ideas lists (slice 5). Permanent share token for the public
--                           view (slice 3). Soft delete only (deleted_at).
--   public.wishlist_items   items: name, link (stored only, never fetched here), price in kobo,
--                           priority, note, photo path (slice 17). Soft delete only.
--   public.delete_wishlist / restore_wishlist / remove_wishlist_item / restore_wishlist_item /
--   has_deleted_wishlists   the only ways to soft-delete and undo (definer functions, owner only).
--
-- ACCESS (CLAUDE.md "Database rules", "Core security rule"): RLS on both tables, every grant
-- explicit, no DELETE grant at all. A person reads and changes only their own live lists and items.
-- Nobody else reads a list here: the public view (slice 3) and the giver's view (slice 11) arrive as
-- narrow definer functions. There is no reservation or mark data in these tables (GC-020: the
-- owner never sees purchase marks; marks live in private.gift_marks, slice 11).

-- WHY: share tokens are 128 random bits. On Supabase pgcrypto already lives in `extensions`; this
-- is a no-op there and makes a fresh local database match.
create extension if not exists pgcrypto with schema extensions;

-- 1. Types ----------------------------------------------------------------------------------------
create type public.wishlist_kind as enum ('personal', 'exchange_ideas');
create type public.wishlist_visibility as enum ('private', 'link');
create type public.wishlist_item_priority as enum ('most_wanted', 'nice_to_have');

-- 2. Tables ---------------------------------------------------------------------------------------

-- WHY no ON DELETE CASCADE anywhere (never-do 8): lists and items are only ever soft-deleted, and
-- an attached list's items must outlive the list (GC-030).
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  -- WHY default auth.uid() and no client grant on owner_id: a client can never create a list for
  -- someone else, and never sends a user id (Backend rules).
  owner_id uuid not null default auth.uid() references public.profiles (id),
  kind public.wishlist_kind not null default 'personal',
  -- WHY 60 code points (GC-019); char_length counts code points, so an emoji is one.
  name text not null
    constraint wishlists_name_length check (char_length(btrim(name)) between 1 and 60)
    constraint wishlists_name_trimmed check (name = btrim(name)),
  visibility public.wishlist_visibility not null default 'private',
  -- WHY both a default and the wishlists_set_share_token trigger: the default keeps the column
  -- optional on insert (and in the generated types); the trigger overwrites any value sent, so the
  -- token is always server-made. Clients have no grant on it either.
  share_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- WHY (plan §5, invariant 7): an exchange ideas list is never readable by link.
  constraint wishlists_ideas_never_link check (kind = 'personal' or visibility = 'private')
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id),
  -- WHY 120 code points (GC-021).
  name text not null
    constraint wishlist_items_name_length check (char_length(btrim(name)) between 1 and 120)
    constraint wishlist_items_name_trimmed check (name = btrim(name)),
  -- WHY: the link is stored and shown only (slice 2 never fetches it; link import is slice 17). Only
  -- http(s), no whitespace, so a stored link can never be a javascript: or data: URL.
  link text
    constraint wishlist_items_link_format check (char_length(link) <= 2048 and link ~* '^https?://\S+$'),
  -- WHY kobo, whole naira only, ₦1 to ₦1,000,000,000 (GC-021; owner 2026-11-05: minimum ₦1). Money
  -- is never a float (CLAUDE.md "Code rules").
  price_kobo bigint
    constraint wishlist_items_price_range check (price_kobo between 100 and 100000000000)
    constraint wishlist_items_price_whole_naira check (price_kobo % 100 = 0),
  priority public.wishlist_item_priority not null,
  -- WHY 280 (GC-021). No note is null, never an empty string.
  note text
    constraint wishlist_items_note_length check (char_length(note) <= 280 and btrim(note) <> ''),
  -- Item photos arrive in slice 17; no client grant until then.
  photo_path text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- WHY: My wishlists and the detail page both list live rows newest-changed first (GC-018, GC-020).
create index wishlists_owner_live_idx on public.wishlists (owner_id, updated_at desc) where deleted_at is null;
create index wishlist_items_list_live_idx on public.wishlist_items (wishlist_id, updated_at desc) where deleted_at is null;

-- 3. Row Level Security and grants ----------------------------------------------------------------
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

-- WHY revoke first: Supabase's default ACLs hand new tables to anon and authenticated (see
-- harden_defaults). Start from nothing, then grant exactly what the app uses. No DELETE grant: lists
-- and items are only soft-deleted, through the definer functions below.
revoke all on public.wishlists from public, anon, authenticated;
revoke all on public.wishlist_items from public, anon, authenticated;

grant select on public.wishlists to authenticated;
grant insert (name, visibility) on public.wishlists to authenticated;
grant update (name, visibility) on public.wishlists to authenticated;

grant select on public.wishlist_items to authenticated;
grant insert (wishlist_id, name, link, price_kobo, priority, note) on public.wishlist_items to authenticated;
grant update (name, link, price_kobo, priority, note) on public.wishlist_items to authenticated;

-- WHY (select auth.uid()): evaluated once per statement, not once per row.
create policy wishlists_select_own_live on public.wishlists
  for select to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null);

create policy wishlists_insert_own_personal on public.wishlists
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and kind = 'personal' and deleted_at is null);

-- WHY kind = 'personal': ideas lists belong to an exchange and are managed from there (slice 5),
-- never renamed from the wishlist pages.
create policy wishlists_update_own_personal_live on public.wishlists
  for update to authenticated
  using (owner_id = (select auth.uid()) and kind = 'personal' and deleted_at is null)
  with check (owner_id = (select auth.uid()) and kind = 'personal' and deleted_at is null);

-- WHY the parent check reads public.wishlists under the caller's own RLS: the subquery only ever
-- sees the caller's live lists, so an item is reachable exactly when its list is.
create policy wishlist_items_select_own_live on public.wishlist_items
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.deleted_at is null
    )
  );

create policy wishlist_items_insert_own_personal on public.wishlist_items
  for insert to authenticated
  with check (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.kind = 'personal'
        and w.deleted_at is null
    )
  );

create policy wishlist_items_update_own_personal on public.wishlist_items
  for update to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.kind = 'personal'
        and w.deleted_at is null
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = (select auth.uid()) and w.kind = 'personal'
        and w.deleted_at is null
    )
  );

-- 4. Trigger functions (in `private`, none executable by the API roles) ---------------------------

-- WHY a trigger and not a column default: it overwrites whatever is sent, so a token is always
-- server-made even for inserts by the migration role or a future definer function.
create function private.set_wishlist_share_token() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.share_token := encode(extensions.gen_random_bytes(16), 'hex');
  return new;
end $$;

-- WHY SECURITY DEFINER: the caller has no grant on wishlists.updated_at (only name and visibility),
-- yet a change to an item is a change to its list, which moves up My wishlists (GC-018). It only
-- touches the parent of the row the caller was already allowed to write.
create function private.touch_wishlist_from_item() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wishlists set updated_at = clock_timestamp() where id = new.wishlist_id;
  return null;
end $$;

revoke execute on function private.set_wishlist_share_token() from public, anon, authenticated;
revoke execute on function private.touch_wishlist_from_item() from public, anon, authenticated;

-- 5. Triggers -------------------------------------------------------------------------------------
create trigger wishlists_set_share_token
  before insert on public.wishlists
  for each row execute function private.set_wishlist_share_token();

-- WHY only the content columns: delete and restore must not move updated_at, so Undo puts a list or
-- an item back exactly where it was (GC-019, GC-020).
create trigger wishlists_set_updated_at
  before update of name, visibility on public.wishlists
  for each row execute function private.set_updated_at();

create trigger wishlist_items_set_updated_at
  before update of name, link, price_kobo, priority, note on public.wishlist_items
  for each row execute function private.set_updated_at();

create trigger wishlist_items_touch_wishlist
  after insert or update on public.wishlist_items
  for each row execute function private.touch_wishlist_from_item();

-- 6. Functions the app calls (SECURITY DEFINER, search_path empty, signed-in only) ----------------
-- WHY definer: deleted_at has no client grant, so soft delete and Undo can only happen here, with
-- the ownership rule written once. Every refusal is P0002 (no_data_found), whether the row is
-- someone else's, missing or already in that state, so the answer never says which (GC-018).

-- GC-019: soft-delete a personal list. Its items are untouched (never-do 8, GC-030).
-- Slice 16 replaces this for attached lists (GC-030).
create function public.delete_wishlist(p_wishlist_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wishlists
     set deleted_at = clock_timestamp()
   where id = p_wishlist_id
     and owner_id = auth.uid()
     and kind = 'personal'
     and deleted_at is null;
  if not found then
    raise exception 'wishlist not found' using errcode = 'P0002';
  end if;
end $$;

-- GC-019: Undo a delete.
create function public.restore_wishlist(p_wishlist_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wishlists
     set deleted_at = null
   where id = p_wishlist_id
     and owner_id = auth.uid()
     and kind = 'personal'
     and deleted_at is not null;
  if not found then
    raise exception 'wishlist not found' using errcode = 'P0002';
  end if;
end $$;

-- GC-020: the bin on an item row. Only on the caller's live personal list.
create function public.remove_wishlist_item(p_item_id uuid) returns void
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
     and w.kind = 'personal'
     and w.deleted_at is null;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end $$;

-- GC-020: Undo a remove.
create function public.restore_wishlist_item(p_item_id uuid) returns void
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
     and w.kind = 'personal'
     and w.deleted_at is null;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end $$;

-- GC-018: tells "first time" from "all my lists deleted" without exposing deleted rows.
create function public.has_deleted_wishlists() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wishlists
    where owner_id = auth.uid() and kind = 'personal' and deleted_at is not null
  )
$$;

-- WHY explicit: harden_defaults already closes new functions; open each to signed-in people only.
-- Visitors never call these (function allowlist, 030).
revoke execute on function public.delete_wishlist(uuid) from public, anon, authenticated;
revoke execute on function public.restore_wishlist(uuid) from public, anon, authenticated;
revoke execute on function public.remove_wishlist_item(uuid) from public, anon, authenticated;
revoke execute on function public.restore_wishlist_item(uuid) from public, anon, authenticated;
revoke execute on function public.has_deleted_wishlists() from public, anon, authenticated;

grant execute on function public.delete_wishlist(uuid) to authenticated;
grant execute on function public.restore_wishlist(uuid) to authenticated;
grant execute on function public.remove_wishlist_item(uuid) to authenticated;
grant execute on function public.restore_wishlist_item(uuid) to authenticated;
grant execute on function public.has_deleted_wishlists() to authenticated;
