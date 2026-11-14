-- 100_wishlist_items — slice 2 (GC-020, GC-021; plan §5 "wishlist_items", §6 invariants 4 and 7).
-- Self-contained: creates its own users and lists inside the transaction (needs the profiles and
-- wishlists migrations applied, not seed.sql). Everything rolls back.
-- Pass: "ok 1".."ok 56", "1..56", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(56);

-- Helpers: same as 090 (pg_temp, so nothing is left in `public`).
create function pg_temp.try_as(who uuid, stmt text) returns text
language plpgsql as $$
declare
  n bigint;
begin
  if who is null then
    set local role anon;
    set local request.jwt.claims = '{"role":"anon"}';
  else
    set local role authenticated;
    execute format('set local request.jwt.claims = %L',
      json_build_object('sub', who, 'role', 'authenticated')::text);
  end if;
  begin
    execute stmt;
    get diagnostics n = row_count;
    reset role;
    return 'ok:' || n;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

create function pg_temp.mk_user(uid uuid, mail text, meta jsonb) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, meta, now(), now(), '', '', '', ''
  )
$$;

-- Ada (owner) and Bola (another signed-in person).
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001001', 'ada-100@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001002', 'bola-100@example.test', '{"first_name":"Bola"}');

-- Fixture lists, written as the migration role (each in its own statement, as the app does):
--   L1 Ada's live personal list · LD Ada's deleted list · LI Ada's ideas list · LB Bola's list.
insert into public.wishlists (id, owner_id, name)
values ('c0000000-0000-4000-8000-000000001001', 'b0000000-0000-4000-8000-000000001001', 'Birthday list');
insert into public.wishlists (id, owner_id, name, deleted_at)
values ('c0000000-0000-4000-8000-000000001002', 'b0000000-0000-4000-8000-000000001001', 'Old list', now());
-- Ideas lists belong to an exchange (exchange_lists migration). Its organiser is NOT the list's owner and
-- nobody is made a member, so the owner is outside the exchange, exactly as before that column existed.
do $fx$ begin
  insert into public.exchanges (id, organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, gift_day, organiser_tz, tint)
  values ('e0000000-0000-4000-8000-000000001001', 'b0000000-0000-4000-8000-000000001002', 'T100 Ada ideas exchange', '5k_10k', now() + interval '1 day', 'organiser_chooses', null, current_date + 3, 'Africa/Lagos', 'clay');
end $fx$;
insert into public.wishlists (id, owner_id, kind, name, exchange_id)
values ('c0000000-0000-4000-8000-000000001003', 'b0000000-0000-4000-8000-000000001001', 'exchange_ideas', 'Ideas', 'e0000000-0000-4000-8000-000000001001');
insert into public.wishlists (id, owner_id, name)
values ('c0000000-0000-4000-8000-000000001004', 'b0000000-0000-4000-8000-000000001002', 'Bola''s list');

-- A fixture item on L1 with a known id.
insert into public.wishlist_items (id, wishlist_id, name, price_kobo, priority, note)
values ('d0000000-0000-4000-8000-000000001001', 'c0000000-0000-4000-8000-000000001001',
        'Ankara tote bag', 850000, 'most_wanted', 'Any colour but brown.');

-- 1-3. Shape: RLS on; the list FK has no cascade; a visitor is refused outright.
select ok((select relrowsecurity from pg_class where oid = 'public.wishlist_items'::regclass),
  'wishlist_items has row level security enabled');
select is(
  (select confdeltype::text from pg_constraint
   where conrelid = 'public.wishlist_items'::regclass and contype = 'f'
     and confrelid = 'public.wishlists'::regclass),
  'a', 'wishlist_items.wishlist_id references wishlists with no action on delete (no cascade)');
select is(pg_temp.try_as(null, 'select 1 from public.wishlist_items'), 'err:42501', 'anon cannot read items');

-- 4-5. The owner adds an item (GC-021); photo, link, price and note are optional.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001001', 'Snake plant', 'nice_to_have')$$),
  'ok:1', 'the owner can add an item to their list');
select is(
  (select format('%s/%s/%s/%s/%s', (deleted_at is null)::text, (photo_path is null)::text, (link is null)::text, (price_kobo is null)::text, (note is null)::text)
   from public.wishlist_items where name = 'Snake plant'),
  'true/true/true/true/true', 'a new item is live with no photo, link, price or note');

-- 6-11. Only the owner, only a live personal list.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001002',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001001', 'Planted', 'most_wanted')$$),
  'err:42501', 'another user cannot add an item to someone else''s list');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001002',
  $$select 1 from public.wishlist_items where wishlist_id = 'c0000000-0000-4000-8000-000000001001'$$),
  'ok:0', 'another user cannot read someone else''s items');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001002',
  $$update public.wishlist_items set name = 'Hacked' where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'ok:0', 'another user cannot edit someone else''s item');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001002', 'Into a deleted list', 'most_wanted')$$),
  'err:42501', 'the owner cannot add an item to a deleted list');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001003', 'Into ideas', 'most_wanted')$$),
  'err:42501', 'items cannot be added to an exchange ideas list from the wishlist pages');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001004', 'Into Bola''s', 'most_wanted')$$),
  'err:42501', 'the owner cannot add an item to another person''s list');

-- 12-14. Item name: 1 to 120 code points, trimmed.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001001', '  ', 'most_wanted')$$),
  'err:23514', 'a blank item name is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001001', repeat('a', 121), 'most_wanted')$$),
  'err:23514', 'a 121-character item name is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001001', repeat(chr(127873), 120), 'most_wanted')$$),
  'ok:1', 'a 120-emoji item name is accepted (code points)');

-- 15-17. Note: up to 280 characters, never blank.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, note)
    values ('c0000000-0000-4000-8000-000000001001', 'Long note', 'most_wanted', repeat('a', 281))$$),
  'err:23514', 'a 281-character note is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, note)
    values ('c0000000-0000-4000-8000-000000001001', 'Blank note', 'most_wanted', '   ')$$),
  'err:23514', 'a blank note is refused (no note is stored as null)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, note)
    values ('c0000000-0000-4000-8000-000000001001', 'Full note', 'most_wanted', repeat('a', 280))$$),
  'ok:1', 'a 280-character note is accepted');

-- 18-23. Price in kobo: whole naira (multiple of 100), from ₦1 up to ₦1,000,000,000.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, price_kobo)
    values ('c0000000-0000-4000-8000-000000001001', 'Too dear', 'most_wanted', 100000000100)$$),
  'err:23514', 'a price over ₦1bn is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, price_kobo)
    values ('c0000000-0000-4000-8000-000000001001', 'Kobo price', 'most_wanted', 150)$$),
  'err:23514', 'a price with kobo (not whole naira) is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, price_kobo)
    values ('c0000000-0000-4000-8000-000000001001', 'Negative', 'most_wanted', -100)$$),
  'err:23514', 'a negative price is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, price_kobo)
    values ('c0000000-0000-4000-8000-000000001001', 'Free', 'most_wanted', 0)$$),
  'err:23514', 'a ₦0 price is refused (minimum ₦1, owner 2026-11-05)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, price_kobo)
    values ('c0000000-0000-4000-8000-000000001001', 'Top price', 'most_wanted', 100000000000)$$),
  'ok:1', 'exactly ₦1bn is accepted');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, price_kobo)
    values ('c0000000-0000-4000-8000-000000001001', 'One naira', 'most_wanted', 100)$$),
  'ok:1', 'exactly ₦1 is accepted');

-- 24-28. Link: stored only (never fetched in slice 2), http(s) only, no spaces, at most 2048.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, link)
    values ('c0000000-0000-4000-8000-000000001001', 'Script', 'most_wanted', 'javascript:alert(1)')$$),
  'err:23514', 'a javascript: link is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, link)
    values ('c0000000-0000-4000-8000-000000001001', 'Ftp', 'most_wanted', 'ftp://shop.example/x')$$),
  'err:23514', 'an ftp: link is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, link)
    values ('c0000000-0000-4000-8000-000000001001', 'Spaced', 'most_wanted', 'https://shop.example/a b')$$),
  'err:23514', 'a link with a space is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, link)
    values ('c0000000-0000-4000-8000-000000001001', 'Long link', 'most_wanted', 'https://shop.example/' || repeat('a', 2028))$$),
  'err:23514', 'a link over 2048 characters is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, link)
    values ('c0000000-0000-4000-8000-000000001001', 'Linked', 'most_wanted', 'https://www.jumia.com.ng/tote-bag')$$),
  'ok:1', 'an https link is accepted');

-- 29-30. Priority is one of two values and required.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority)
    values ('c0000000-0000-4000-8000-000000001001', 'Urgent', 'urgent')$$),
  'err:22P02', 'an unknown priority is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name)
    values ('c0000000-0000-4000-8000-000000001001', 'No priority')$$),
  'err:23502', 'an item without a priority is refused');

-- 31-36. Column grants: the photo path, deleted_at and the parent list are never client-written,
-- and there is no hard delete.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, photo_path)
    values ('c0000000-0000-4000-8000-000000001001', 'Photo', 'most_wanted', 'x.jpg')$$),
  'err:42501', 'a user cannot write photo_path (photos arrive in slice 17)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$insert into public.wishlist_items (wishlist_id, name, priority, deleted_at)
    values ('c0000000-0000-4000-8000-000000001001', 'Gone', 'most_wanted', now())$$),
  'err:42501', 'a user cannot write deleted_at on insert');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$update public.wishlist_items set wishlist_id = 'c0000000-0000-4000-8000-000000001004'
    where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'err:42501', 'a user cannot move an item to another list');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$update public.wishlist_items set photo_path = 'x.jpg' where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'err:42501', 'a user cannot update photo_path');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$update public.wishlist_items set deleted_at = now() where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'err:42501', 'a user cannot write deleted_at directly (remove goes through remove_wishlist_item)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$delete from public.wishlist_items where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'err:42501', 'a user cannot hard-delete an item (no DELETE grant)');

-- 37-39. Editing an item moves its updated_at, and touches the parent list (sort order, GC-018).
select set_config('test.item_updated', (select updated_at::text from public.wishlist_items where id = 'd0000000-0000-4000-8000-000000001001'), true);
select set_config('test.list_updated', (select updated_at::text from public.wishlists where id = 'c0000000-0000-4000-8000-000000001001'), true);
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$update public.wishlist_items set price_kobo = 900000, priority = 'nice_to_have'
    where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'ok:1', 'the owner can edit their item');
select ok(
  (select updated_at > current_setting('test.item_updated')::timestamptz
   from public.wishlist_items where id = 'd0000000-0000-4000-8000-000000001001'),
  'editing an item moves its updated_at');
select ok(
  (select updated_at > current_setting('test.list_updated')::timestamptz
   from public.wishlists where id = 'c0000000-0000-4000-8000-000000001001'),
  'editing an item touches the parent list''s updated_at');

-- 40-47. Remove with Undo (GC-020): owner only, soft, and the item's updated_at never moves, so
-- Undo puts it back in the same place.
select set_config('test.item_updated', (select updated_at::text from public.wishlist_items where id = 'd0000000-0000-4000-8000-000000001001'), true);
select set_config('test.list_updated', (select updated_at::text from public.wishlists where id = 'c0000000-0000-4000-8000-000000001001'), true);
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001002',
  $$select public.remove_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'err:P0002', 'another user cannot remove someone else''s item (reported as not found)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.remove_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'ok:1', 'the owner can remove their item');
-- R1-4: the item trigger fires on every update, so a remove (and its Undo) moves the parent list's
-- updated_at, and the list rises to the top of My wishlists. Accepted behaviour, pinned here.
select ok(
  (select updated_at > current_setting('test.list_updated')::timestamptz
   from public.wishlists where id = 'c0000000-0000-4000-8000-000000001001'),
  'removing an item moves the parent list''s updated_at');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select 1 from public.wishlist_items where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'ok:0', 'a removed item is hidden from its owner');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$update public.wishlist_items set name = 'Edited' where id = 'd0000000-0000-4000-8000-000000001001'$$),
  'ok:0', 'a removed item cannot be edited');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.remove_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'err:P0002', 'removing an already removed item is reported as not found');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001002',
  $$select public.restore_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'err:P0002', 'another user cannot restore someone else''s item');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.restore_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'ok:1', 'the owner can restore their removed item (Undo)');
select is(
  (select format('%s/%s/%s', (deleted_at is null)::text, name, (updated_at::text = current_setting('test.item_updated'))::text)
   from public.wishlist_items where id = 'd0000000-0000-4000-8000-000000001001'),
  'true/Ankara tote bag/true', 'restore brings the item back unchanged, with the same updated_at');

-- 48. Restoring a live item is not found.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.restore_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'err:P0002', 'restoring a live item is reported as not found');

-- 49-54. Deleting the list leaves its items untouched (never-do 8, GC-030); they are unreachable
-- while it is deleted and come back with it.
select set_config('test.live_items', (select count(*)::text from public.wishlist_items
  where wishlist_id = 'c0000000-0000-4000-8000-000000001001' and deleted_at is null), true);
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.delete_wishlist('c0000000-0000-4000-8000-000000001001')$$),
  'ok:1', 'the owner deletes the list');
select is(
  (select count(*)::text from public.wishlist_items
   where wishlist_id = 'c0000000-0000-4000-8000-000000001001' and deleted_at is null),
  current_setting('test.live_items'), 'deleting a list removes none of its items');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select 1 from public.wishlist_items where wishlist_id = 'c0000000-0000-4000-8000-000000001001'$$),
  'ok:0', 'items of a deleted list are hidden from the owner');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.remove_wishlist_item('d0000000-0000-4000-8000-000000001001')$$),
  'err:P0002', 'an item of a deleted list cannot be removed');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select public.restore_wishlist('c0000000-0000-4000-8000-000000001001')$$),
  'ok:1', 'the owner restores the list');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$select 1 from public.wishlist_items where wishlist_id = 'c0000000-0000-4000-8000-000000001001'$$),
  'ok:' || current_setting('test.live_items'), 'the items come back with the list');

-- 56. R1-5: an item on an exchange ideas list cannot be edited from the wishlist pages (the update
-- policy is for personal lists only), so the update matches no row.
insert into public.wishlist_items (id, wishlist_id, name, priority)
values ('d0000000-0000-4000-8000-000000001003', 'c0000000-0000-4000-8000-000000001003', 'Idea', 'most_wanted');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001001',
  $$update public.wishlist_items set name = 'Edited idea' where id = 'd0000000-0000-4000-8000-000000001003'$$),
  'ok:0', 'an item on an exchange ideas list cannot be edited from the wishlist pages');

select * from finish();
rollback;
