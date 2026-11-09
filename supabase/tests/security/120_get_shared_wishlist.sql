-- 120_get_shared_wishlist — slice 3 (GC-023: the public, no-account view of a shared wishlist).
-- Self-contained: creates its own users and lists inside the transaction (needs the wishlists and
-- share_and_default_visibility migrations applied, not seed.sql). Everything rolls back.
-- Pass: "ok 1".."ok 19", "1..19", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

-- Same helpers as 060/090 (inline so the file runs on its own).
-- try_as runs one statement as a persona (null = anon): 'ok:<rows>' or 'err:<SQLSTATE>'.
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

-- shared_as calls the function as anon ('anon') or as a signed-in person ('authenticated').
-- WHY the token is a parameter read from current_setting by the caller: tokens are made by the
-- database, so the test reads them back instead of hard-coding any.
create function pg_temp.shared_as(who text, tok text) returns jsonb
language plpgsql as $$
declare
  v jsonb;
begin
  if who = 'anon' then
    set local role anon;
    set local request.jwt.claims = '{"role":"anon"}';
  else
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000001202","role":"authenticated"}';
  end if;
  begin
    execute 'select public.get_shared_wishlist($1)' into v using tok;
    reset role;
    -- WHY: the function answers SQL null for "no list"; the tests compare it with jsonb 'null'.
    return coalesce(v, 'null'::jsonb);
  exception when others then
    reset role;
    return jsonb_build_object('error', sqlstate);
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

-- Ada owns the lists; Bola is another signed-in person; Cleo's account gets anonymised.
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001201', 'ada-120@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001202', 'bola-120@example.test', '{"first_name":"Bola"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001203', 'cleo-120@example.test', '{"first_name":"Cleo"}');

-- Lists, written as the table owner. WHY owner_id is explicit: the client default is auth.uid().
insert into public.wishlists (owner_id, name, visibility) values
  ('b0000000-0000-4000-8000-000000001201', 'T120 Birthday', 'link'),
  ('b0000000-0000-4000-8000-000000001201', 'T120 Private', 'private'),
  ('b0000000-0000-4000-8000-000000001201', 'T120 Deleted', 'link'),
  ('b0000000-0000-4000-8000-000000001201', 'T120 Empty', 'link'),
  ('b0000000-0000-4000-8000-000000001201', 'T120 Toggle', 'link'),
  ('b0000000-0000-4000-8000-000000001203', 'T120 Anonymised', 'link');
insert into public.wishlists (owner_id, name, kind, visibility) values
  ('b0000000-0000-4000-8000-000000001201', 'T120 Ideas', 'exchange_ideas', 'private');
update public.wishlists set deleted_at = now() where name = 'T120 Deleted';
update public.profiles set anonymised_at = now() where id = 'b0000000-0000-4000-8000-000000001203';

-- Items on the Birthday list with explicit times, so the order is known: Kimono (newest), Hoops,
-- Plant (oldest). A fourth, Removed, is soft-deleted and must never appear.
insert into public.wishlist_items (wishlist_id, name, link, price_kobo, priority, note, updated_at, deleted_at)
select w.id, v.name, v.link, v.price, v.priority::public.wishlist_item_priority, v.note, v.at::timestamptz, v.gone::timestamptz
from public.wishlists w,
  (values
    ('Gold hoops', 'https://shop.example/hoops', 2500000, 'most_wanted', 'Small, not chunky.', '2026-11-02 10:00+00', null),
    ('Adire kimono', null, 3000000, 'most_wanted', null, '2026-11-03 10:00+00', null),
    ('Snake plant', null, null, 'nice_to_have', null, '2026-11-01 10:00+00', null),
    ('Removed thing', null, null, 'nice_to_have', null, '2026-11-04 10:00+00', '2026-11-05 10:00+00')
  ) as v(name, link, price, priority, note, at, gone)
where w.name = 'T120 Birthday';
insert into public.wishlist_items (wishlist_id, name, priority)
select id, 'Secret thing', 'nice_to_have' from public.wishlists where name = 'T120 Private';

select set_config('test.tok_birthday', (select share_token from public.wishlists where name = 'T120 Birthday'), true);
select set_config('test.tok_private', (select share_token from public.wishlists where name = 'T120 Private'), true);
select set_config('test.tok_deleted', (select share_token from public.wishlists where name = 'T120 Deleted'), true);
select set_config('test.tok_empty', (select share_token from public.wishlists where name = 'T120 Empty'), true);
select set_config('test.tok_toggle', (select share_token from public.wishlists where name = 'T120 Toggle'), true);
select set_config('test.tok_anon', (select share_token from public.wishlists where name = 'T120 Anonymised'), true);
select set_config('test.tok_ideas', (select share_token from public.wishlists where name = 'T120 Ideas'), true);

-- 1-2. Exactly these keys, nothing more (no ids, owner id, photo path or timestamps).
select is(
  (select string_agg(k, ',' order by k) from jsonb_object_keys(pg_temp.shared_as('anon', current_setting('test.tok_birthday'))) k),
  'items,name,owner_display_name', 'the payload has exactly the keys items, name and owner_display_name');
select is(
  (select string_agg(k, ',' order by k)
   from jsonb_object_keys(pg_temp.shared_as('anon', current_setting('test.tok_birthday')) -> 'items' -> 0) k),
  'link,name,note,price_kobo,priority', 'each item has exactly the keys link, name, note, price_kobo and priority');

-- 3. The list name and the owner's display name.
select is(
  (select format('%s/%s', p ->> 'name', p ->> 'owner_display_name')
   from (select pg_temp.shared_as('anon', current_setting('test.tok_birthday')) as p) s),
  'T120 Birthday/Ada', 'the payload carries the list name and the owner''s display name');

-- 4-5. Newest-changed first; the removed item is absent.
select is(
  (select string_agg(t.i ->> 'name', ' > ' order by t.ord)
   from jsonb_array_elements(pg_temp.shared_as('anon', current_setting('test.tok_birthday')) -> 'items') with ordinality as t(i, ord)),
  'Adire kimono > Gold hoops > Snake plant', 'items come newest-changed first');
select is(
  (select count(*)::int
   from jsonb_array_elements(pg_temp.shared_as('anon', current_setting('test.tok_birthday')) -> 'items') i
   where i ->> 'name' = 'Removed thing'),
  0, 'a removed item is not in the payload');

-- 6. A list with no items is an empty array, not null.
select is((pg_temp.shared_as('anon', current_setting('test.tok_empty')) -> 'items')::text,
  '[]', 'a list with no items has items = []');

-- 7-10. One answer, null, for private, deleted, anonymised-owner and unknown.
select is(pg_temp.shared_as('anon', current_setting('test.tok_private')), 'null'::jsonb, 'a private list is null');
select is(pg_temp.shared_as('anon', current_setting('test.tok_deleted')), 'null'::jsonb, 'a deleted list is null');
select is(pg_temp.shared_as('anon', current_setting('test.tok_anon')), 'null'::jsonb, 'a list whose owner is anonymised is null');
select is(pg_temp.shared_as('anon', repeat('0', 32)), 'null'::jsonb, 'an unknown well-formed token is null');

-- 11. Malformed tokens are null too (and never an error): null, empty, uppercase, 31 and 33 characters, SQL text.
select is(
  (select count(*)::int from (values
    (pg_temp.shared_as('anon', null)),
    (pg_temp.shared_as('anon', '')),
    (pg_temp.shared_as('anon', upper(current_setting('test.tok_birthday')))),
    (pg_temp.shared_as('anon', left(current_setting('test.tok_birthday'), 31))),
    (pg_temp.shared_as('anon', current_setting('test.tok_birthday') || '0')),
    (pg_temp.shared_as('anon', ' or 1=1 --'))
  ) as t(r) where r is not null and r <> 'null'::jsonb),
  0, 'malformed tokens all answer null');

-- 12. An exchange ideas list is never readable by link.
select is(pg_temp.shared_as('anon', current_setting('test.tok_ideas')), 'null'::jsonb, 'an ideas list is null');

-- 13-14. Switching a list from link to private takes it off the public view immediately.
select ok(pg_temp.shared_as('anon', current_setting('test.tok_toggle')) ->> 'name' = 'T120 Toggle',
  'a link list is readable before it is made private');
update public.wishlists set visibility = 'private' where name = 'T120 Toggle';
select is(pg_temp.shared_as('anon', current_setting('test.tok_toggle')), 'null'::jsonb,
  'the same token is null once the list is private');

-- 15-16. The tables stay closed to a visitor: refused, not empty.
select is(pg_temp.try_as(null, 'select 1 from public.wishlists'), 'err:42501', 'anon cannot read wishlists directly');
select is(pg_temp.try_as(null, 'select 1 from public.wishlist_items'), 'err:42501', 'anon cannot read wishlist items directly');

-- 17. A signed-in visitor (not the owner) gets the same view.
select is(pg_temp.shared_as('authenticated', current_setting('test.tok_birthday')) ->> 'name', 'T120 Birthday',
  'a signed-in visitor can read a shared list');

-- 18. Definer, stable, empty search_path.
select ok((select p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""']
           from pg_proc p where p.oid = 'public.get_shared_wishlist(text)'::regprocedure),
  'get_shared_wishlist is security definer, stable and sets search_path to empty');

-- 19. anon may execute it (it is the public read path).
select ok(has_function_privilege('anon', 'public.get_shared_wishlist(text)', 'execute'),
  'anon can execute get_shared_wishlist(text)');

select * from finish();
rollback;
