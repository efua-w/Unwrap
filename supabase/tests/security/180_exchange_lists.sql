-- 180_exchange_lists — slice 5 (GC-010, GC-011, GC-013, GCO-004 S49; plan §5, §6 invariants 7 and 10;
-- closes open item 42).
-- Covers: exchange_members.attached_wishlist_id (no client grant), wishlists.exchange_id (check, partial
-- unique, no client write grant), attach_wishlist, use_exchange_ideas, get_my_exchange_list, the two
-- wishlist_items policies for ideas lists, and the replaced remove_wishlist_item / restore_wishlist_item.
-- Self-contained: creates its own users inside the transaction (needs the migrations through
-- exchange_lists applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under
-- `supabase test db`. Everything rolls back. Names are prefixed "T180" because dev holds other data.
-- Written BEFORE the exchange_lists migration: until it is applied the first statement that names the new
-- columns or functions fails and the run stops. That is the expected "red".
-- The personal-list paths are re-checked in 090 and 100, which must be re-run with this file (plan, tests).
-- Pass: "ok 1".."ok 59", "1..59", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(59);

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
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

create function pg_temp.hint_as(who uuid, stmt text) returns text
language plpgsql as $$
declare
  h text;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
  begin
    execute stmt;
    reset role;
    return 'ok';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    reset role;
    return 'err:' || sqlstate || '/' || coalesce(h, '');
  end;
end $$;

create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
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
    execute format('select (%s)::text', expr) into v;
    reset role;
    return v;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

-- ml reads one field of get_my_exchange_list as a persona (the text 'null' for a JSON or SQL null).
create function pg_temp.ml(who uuid, ex text, path text) returns text
language sql as $$
  select coalesce(pg_temp.val_as(who, format('public.get_my_exchange_list(%L)->>%L', ex, path)), 'null')
$$;

create function pg_temp.mk(p_name text, taking text default 'true') returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, null, current_date + 20, %L, %s, false)',
    p_name, '10k_20k', 'organiser_chooses', 'Africa/Lagos', taking)
$$;

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

-- u(n) is persona n: 1 Ada (organiser), 2 Bola, 3 Chi (members), 4 Dayo (outsider), 5 Eze (member who leaves),
-- 6 Femi (organises only). Only ever used as an argument, never inside a role-switched statement.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('18' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u180-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi'])[i]))
  from generate_series(1, 6) i;
end $fx$;

-- E1 open (Ada), E4 another (Ada), E2 where Femi only organises. Made the way the app makes them.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T180 Open'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T180 Other'));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T180 Just organising', 'false'));
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.e1', (select id::text from public.exchanges where name = 'T180 Open'), true);
  perform set_config('test.e4', (select id::text from public.exchanges where name = 'T180 Other'), true);
  perform set_config('test.e2', (select id::text from public.exchanges where name = 'T180 Just organising'), true);
  -- Members, written as the migration role (the join path is tested in 170): Bola, Chi and Eze are in E1;
  -- Bola is also in E4.
  insert into public.exchange_members (exchange_id, user_id, taking_part)
    select current_setting('test.e1')::uuid, pg_temp.u(i), true from generate_series(2, 3) i;
  insert into public.exchange_members (exchange_id, user_id, taking_part)
    values (current_setting('test.e1')::uuid, pg_temp.u(5), true), (current_setting('test.e4')::uuid, pg_temp.u(2), true);
end $fx$;

-- Personal lists, made as their owners: Bola L1 (private, two items), L2 (link), L3 (deleted); Chi LC;
-- Dayo LD; Eze LE; Femi LF.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), $$insert into public.wishlists (name) values ('T180 Bola list')$$);
  perform pg_temp.try_as(pg_temp.u(2), $$insert into public.wishlists (name, visibility) values ('T180 Bola link', 'link')$$);
  perform pg_temp.try_as(pg_temp.u(2), $$insert into public.wishlists (name) values ('T180 Bola gone')$$);
  perform pg_temp.try_as(pg_temp.u(3), $$insert into public.wishlists (name) values ('T180 Chi list')$$);
  perform pg_temp.try_as(pg_temp.u(4), $$insert into public.wishlists (name) values ('T180 Dayo list')$$);
  perform pg_temp.try_as(pg_temp.u(5), $$insert into public.wishlists (name) values ('T180 Eze list')$$);
  perform pg_temp.try_as(pg_temp.u(6), $$insert into public.wishlists (name) values ('T180 Femi list')$$);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.l1', (select id::text from public.wishlists where name = 'T180 Bola list'), true);
  perform set_config('test.l2', (select id::text from public.wishlists where name = 'T180 Bola link'), true);
  perform set_config('test.l3', (select id::text from public.wishlists where name = 'T180 Bola gone'), true);
  perform set_config('test.lc', (select id::text from public.wishlists where name = 'T180 Chi list'), true);
  perform set_config('test.ld', (select id::text from public.wishlists where name = 'T180 Dayo list'), true);
  perform set_config('test.le', (select id::text from public.wishlists where name = 'T180 Eze list'), true);
  perform set_config('test.lf', (select id::text from public.wishlists where name = 'T180 Femi list'), true);
  perform pg_temp.try_as(pg_temp.u(2), format('select public.delete_wishlist(%L)', current_setting('test.l3')));
  perform pg_temp.try_as(pg_temp.u(2), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Item one', 'nice_to_have')$$, current_setting('test.l1')));
  perform pg_temp.try_as(pg_temp.u(2), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Item two', 'most_wanted')$$, current_setting('test.l1')));
  perform set_config('request.jwt.claims', '', true);
end $fx$;

-- 1-3. Shape: both new foreign keys are no-action (no cascade, never-do 8); both columns are uuid.
select ok(
  (select count(*) = 1 and bool_and(confdeltype = 'a') from pg_constraint
   where contype = 'f' and conrelid = 'public.exchange_members'::regclass and confrelid = 'public.wishlists'::regclass)
  and (select count(*) = 1 and bool_and(confdeltype = 'a') from pg_constraint
   where contype = 'f' and conrelid = 'public.wishlists'::regclass and confrelid = 'public.exchanges'::regclass),
  'attached_wishlist_id and exchange_id are foreign keys with no cascade');
select col_type_is('public', 'exchange_members', 'attached_wishlist_id', 'uuid', 'exchange_members.attached_wishlist_id is a uuid');
select col_type_is('public', 'wishlists', 'exchange_id', 'uuid', 'wishlists.exchange_id is a uuid');

-- 4-7. Grants: attached_wishlist_id has no client grant at all (list status must not leak); exchange_id has
-- no client write grant; the reads are refused outright (42501), not empty.
select ok(
  not has_column_privilege('authenticated', 'public.exchange_members', 'attached_wishlist_id', 'select')
  and not has_column_privilege('authenticated', 'public.exchange_members', 'attached_wishlist_id', 'insert')
  and not has_column_privilege('authenticated', 'public.exchange_members', 'attached_wishlist_id', 'update')
  and not has_column_privilege('anon', 'public.exchange_members', 'attached_wishlist_id', 'select'),
  'no client role has any grant on exchange_members.attached_wishlist_id');
select ok(
  not has_column_privilege('authenticated', 'public.wishlists', 'exchange_id', 'insert')
  and not has_column_privilege('authenticated', 'public.wishlists', 'exchange_id', 'update')
  and not has_column_privilege('anon', 'public.wishlists', 'exchange_id', 'insert')
  and not has_column_privilege('anon', 'public.wishlists', 'exchange_id', 'update')
  and not has_column_privilege('authenticated', 'public.wishlists', 'kind', 'insert'),
  'no client role can write wishlists.exchange_id (or kind)');
select is(
  pg_temp.try_as(pg_temp.u(2), 'select attached_wishlist_id from public.exchange_members')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select attached_wishlist_id from public.exchange_members')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select * from public.exchange_members'),
  'err:42501/err:42501/err:42501',
  'a member and the organiser are refused when they read attached_wishlist_id, by name or with select *');
select is(
  pg_temp.try_as(pg_temp.u(2), format('insert into public.wishlists (name, exchange_id) values (%L, %L)', 'T180 Sneaky', current_setting('test.e1')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('update public.wishlists set exchange_id = %L where id = %L', current_setting('test.e1'), current_setting('test.l1')))
  || '/' || pg_temp.try_as(pg_temp.u(2), $$insert into public.wishlists (name, kind) values ('T180 Sneaky', 'exchange_ideas')$$),
  'err:42501/err:42501/err:42501',
  'a person cannot set exchange_id, or create an ideas list, directly');

-- 8-12. Table checks and the partial unique index, tried as the migration role (claims cleared first).
do $fx$ begin perform set_config('request.jwt.claims', '', true); end $fx$;
select throws_ok(
  format($$insert into public.wishlists (owner_id, kind, name) values (%L, 'exchange_ideas', 'T180 No exchange')$$, pg_temp.u(4)::text),
  '23514', null, 'an ideas list must have an exchange');
select throws_ok(
  format($$insert into public.wishlists (owner_id, name, exchange_id) values (%L, 'T180 Personal with exchange', %L)$$, pg_temp.u(4)::text, current_setting('test.e1')),
  '23514', null, 'a personal list cannot have an exchange');
select lives_ok(
  format($$insert into public.wishlists (owner_id, kind, name, exchange_id) values (%L, 'exchange_ideas', 'T180 Dayo ideas', %L)$$, pg_temp.u(4)::text, current_setting('test.e1')),
  'an ideas list for an exchange can be created');
select throws_ok(
  format($$insert into public.wishlists (owner_id, kind, name, exchange_id) values (%L, 'exchange_ideas', 'T180 Dayo ideas again', %L)$$, pg_temp.u(4)::text, current_setting('test.e1')),
  '23505', null, 'a person cannot have two ideas lists for one exchange');
select lives_ok(
  format($$insert into public.wishlists (owner_id, kind, name, exchange_id) values (%L, 'exchange_ideas', 'T180 Dayo ideas elsewhere', %L)$$, pg_temp.u(4)::text, current_setting('test.e4')),
  'the same person can have an ideas list for another exchange');

-- 13-16. Policies and functions.
select ok(
  (select count(*) = 2 from pg_policies
   where schemaname = 'public' and tablename = 'wishlist_items'
     and policyname in ('wishlist_items_insert_own_ideas', 'wishlist_items_update_own_ideas')),
  'the two ideas-item policies exist');
select ok(
  (select count(*) = 5 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('attach_wishlist', 'use_exchange_ideas', 'get_my_exchange_list', 'remove_wishlist_item', 'restore_wishlist_item')),
  'each new or replaced list function is SECURITY DEFINER with an empty search_path, one signature each');
select ok(
  not has_function_privilege('anon', 'public.attach_wishlist(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.use_exchange_ideas(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_exchange_list(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.remove_wishlist_item(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.restore_wishlist_item(uuid)', 'execute'),
  'anon cannot execute any list function');
select ok(
  has_function_privilege('authenticated', 'public.attach_wishlist(uuid,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.use_exchange_ideas(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_exchange_list(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.remove_wishlist_item(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.restore_wishlist_item(uuid)', 'execute'),
  'signed-in people can execute the list functions');

-- 17-19. get_my_exchange_list before anything is attached: none; the exact key set; null for a non-member, a
-- visitor refused.
select is(
  pg_temp.ml(pg_temp.u(3), current_setting('test.e1'), 'source') || '/' || pg_temp.ml(pg_temp.u(3), current_setting('test.e1'), 'wishlist_id')
  || '/' || pg_temp.ml(pg_temp.u(3), current_setting('test.e1'), 'name') || '/' || pg_temp.ml(pg_temp.u(3), current_setting('test.e1'), 'item_count'),
  'none/null/null/0', 'a member with nothing attached has source none');
select is(
  pg_temp.val_as(pg_temp.u(3), format($$(select string_agg(k, ',' order by k collate "C") from jsonb_object_keys(public.get_my_exchange_list(%L)) k)$$, current_setting('test.e1'))),
  'item_count,name,source,wishlist_id', 'get_my_exchange_list has exactly these keys');
select is(
  pg_temp.ml(pg_temp.u(4), current_setting('test.e1'), 'source') || '/' || pg_temp.try_as(null, format('select public.get_my_exchange_list(%L)', current_setting('test.e1'))),
  'null/err:42501', 'a non-member gets null; a visitor is refused outright');

-- 20-25. attach_wishlist as Bola on E1 (open): own personal lists, private or link, are allowed; someone
-- else's, a deleted one and an unknown one are "not found" and change nothing.
select is(pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l1'))),
  'ok:1', 'a member can attach their own personal list');
select is(
  (select attached_wishlist_id::text from public.exchange_members where exchange_id = current_setting('test.e1')::uuid and user_id = pg_temp.u(2)),
  current_setting('test.l1'), 'the list is attached to the member''s own row');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l2'))),
  'ok:1', 'a link-visible personal list can be attached too');
select is(
  pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.lc')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l3')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), 'c0000000-0000-4000-8000-0000000018ff')),
  'err:P0002/err:P0002/err:P0002', 'someone else''s list, a deleted list and an unknown list are all "not found"');
select is(
  (select attached_wishlist_id::text from public.exchange_members where exchange_id = current_setting('test.e1')::uuid and user_id = pg_temp.u(2)),
  current_setting('test.l2'), 'a refused attach leaves the attached list as it was');
select is(
  pg_temp.try_as(pg_temp.u(4), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.ld')))
  || '/' || pg_temp.try_as(null, format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l1'))),
  'err:P0002/err:42501', 'an outsider is "not found"; a visitor is refused outright');
select is(pg_temp.hint_as(pg_temp.u(6), format('select public.attach_wishlist(%L, %L)', current_setting('test.e2'), current_setting('test.lf'))),
  'err:22023/not_taking_part', 'an organiser who only organises cannot attach a list');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l1'))),
  'ok:1', 'a member can change the attached list');
select is(
  pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'source') || '/' || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'name')
  || '/' || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'item_count')
  || '/' || (pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'wishlist_id') = current_setting('test.l1'))::text,
  'wishlist/T180 Bola list/2/true', 'get_my_exchange_list reports an attached wishlist with its name and live item count');

-- 30-36. use_exchange_ideas: creates the ideas list on first use, attaches it, returns the same one every
-- time, and the ideas survive switching to a wishlist and back.
do $fx$ begin
  perform set_config('test.i1', pg_temp.val_as(pg_temp.u(2), format('public.use_exchange_ideas(%L)', current_setting('test.e1'))), true);
end $fx$;
select is(current_setting('test.i1'),
  (select id::text from public.wishlists where owner_id = pg_temp.u(2) and exchange_id = current_setting('test.e1')::uuid and kind = 'exchange_ideas'),
  'use_exchange_ideas returns the new ideas list');
select is(
  (select format('%s/%s/%s/%s',
     w.visibility, (w.exchange_id = current_setting('test.e1')::uuid)::text, (w.deleted_at is null)::text,
     (m.attached_wishlist_id = w.id)::text)
   from public.wishlists w
   join public.exchange_members m on m.exchange_id = w.exchange_id and m.user_id = w.owner_id
   where w.id = current_setting('test.i1')::uuid),
  'private/true/true/true', 'the ideas list is private, belongs to the exchange, and is now the attached list');
select is(
  pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'source') || '/'
  || (pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'wishlist_id') = current_setting('test.i1'))::text || '/'
  || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'item_count'),
  'none/true/0', 'an ideas list with no items is source none, and its id is still returned for the page to add to');
do $fx$ begin
  perform set_config('test.i1b', pg_temp.val_as(pg_temp.u(2), format('public.use_exchange_ideas(%L)', current_setting('test.e1'))), true);
end $fx$;
select is(
  current_setting('test.i1b') || '/' || (select count(*) from public.wishlists where owner_id = pg_temp.u(2) and exchange_id = current_setting('test.e1')::uuid),
  current_setting('test.i1') || '/1', 'use_exchange_ideas again returns the same list: one ideas list per person and exchange');
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l1')));
end $fx$;
select is(
  (select format('%s/%s/%s', (m.attached_wishlist_id = current_setting('test.l1')::uuid)::text,
     (select (w.deleted_at is null)::text from public.wishlists w where w.id = current_setting('test.i1')::uuid),
     (select count(*) from public.wishlists w where w.owner_id = pg_temp.u(2) and w.exchange_id = current_setting('test.e1')::uuid))
   from public.exchange_members m where m.exchange_id = current_setting('test.e1')::uuid and m.user_id = pg_temp.u(2)),
  'true/true/1', 'switching to a wishlist keeps the ideas list');
do $fx$ begin
  perform set_config('test.i1c', pg_temp.val_as(pg_temp.u(2), format('public.use_exchange_ideas(%L)', current_setting('test.e1'))), true);
end $fx$;
select is(
  current_setting('test.i1c') || '/' || (select (attached_wishlist_id = current_setting('test.i1')::uuid)::text
    from public.exchange_members where exchange_id = current_setting('test.e1')::uuid and user_id = pg_temp.u(2)),
  current_setting('test.i1') || '/true', 'switching back brings the same ideas list back');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.i1'))),
  'ok:1', 'a member can attach their own ideas list for this exchange');

-- 37-40. Other ideas lists cannot be attached: another exchange's, and someone else's. The rate limit counts a
-- new ideas list as a created wishlist.
do $fx$ begin
  perform set_config('test.i4', pg_temp.val_as(pg_temp.u(2), format('public.use_exchange_ideas(%L)', current_setting('test.e4'))), true);
  perform set_config('test.chi_hits_before',
    coalesce((select hits::text from private.rate_limits where key = 'create_wishlist:' || pg_temp.u(3)::text), '0'), true);
  perform set_config('test.ic', pg_temp.val_as(pg_temp.u(3), format('public.use_exchange_ideas(%L)', current_setting('test.e1'))), true);
end $fx$;
select is(
  pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.i4')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.ic'))),
  'err:P0002/err:P0002', 'an ideas list of another exchange, and someone else''s ideas list, cannot be attached');
select is(
  (select hits::text from private.rate_limits where key = 'create_wishlist:' || pg_temp.u(3)::text),
  (current_setting('test.chi_hits_before')::int + 1)::text, 'creating an ideas list counts against the wishlist rate limit');
select is(
  pg_temp.try_as(pg_temp.u(4), format('select public.use_exchange_ideas(%L)', current_setting('test.e1')))
  || '/' || pg_temp.try_as(null, format('select public.use_exchange_ideas(%L)', current_setting('test.e1'))),
  'err:P0002/err:42501', 'an outsider is "not found" for ideas; a visitor is refused outright');
select is(pg_temp.hint_as(pg_temp.u(6), format('select public.use_exchange_ideas(%L)', current_setting('test.e2'))),
  'err:22023/not_taking_part', 'an organiser who only organises cannot start an ideas list');

-- 41-47. Ideas items: the owner adds, edits, bins and restores while in the exchange; nobody else can.
select is(pg_temp.try_as(pg_temp.u(2), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Idea one', 'nice_to_have')$$, current_setting('test.i1'))),
  'ok:1', 'the owner can add an item to their ideas list');
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.idea_item', (select id::text from public.wishlist_items where name = 'T180 Idea one'), true);
end $fx$;
select is(
  pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'source') || '/' || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'name')
  || '/' || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'item_count'),
  'ideas/null/1', 'ideas with items is source ideas; the internal name is never returned');
select is(pg_temp.try_as(pg_temp.u(2), format($$update public.wishlist_items set name = 'T180 Idea one edited' where id = %L$$, current_setting('test.idea_item'))),
  'ok:1', 'the owner can edit an ideas item');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.remove_wishlist_item(%L)', current_setting('test.idea_item'))),
  'ok:1', 'the owner can bin an ideas item');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.restore_wishlist_item(%L)', current_setting('test.idea_item'))),
  'ok:1', 'the owner can undo that');
select is(
  pg_temp.try_as(pg_temp.u(3), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Intruder', 'nice_to_have')$$, current_setting('test.i1')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format($$update public.wishlist_items set name = 'T180 Hijack' where id = %L$$, current_setting('test.idea_item')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.remove_wishlist_item(%L)', current_setting('test.idea_item')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select public.remove_wishlist_item(%L)', current_setting('test.idea_item'))),
  'err:42501/ok:0/err:P0002/err:P0002',
  'a co-member and the organiser cannot add to, edit or bin someone else''s ideas items');
-- Eze starts an ideas list with two items (one binned) and then leaves the exchange.
do $fx$ begin
  perform set_config('test.ie', pg_temp.val_as(pg_temp.u(5), format('public.use_exchange_ideas(%L)', current_setting('test.e1'))), true);
  perform pg_temp.try_as(pg_temp.u(5), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Eze one', 'nice_to_have')$$, current_setting('test.ie')));
  perform pg_temp.try_as(pg_temp.u(5), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Eze two', 'nice_to_have')$$, current_setting('test.ie')));
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.eze_one', (select id::text from public.wishlist_items where name = 'T180 Eze one'), true);
  perform set_config('test.eze_two', (select id::text from public.wishlist_items where name = 'T180 Eze two'), true);
  perform pg_temp.try_as(pg_temp.u(5), format('select public.remove_wishlist_item(%L)', current_setting('test.eze_two')));
  perform set_config('request.jwt.claims', '', true);
  update public.exchange_members set state = 'left', left_at = now()
    where exchange_id = current_setting('test.e1')::uuid and user_id = pg_temp.u(5);
end $fx$;
select is(
  pg_temp.try_as(pg_temp.u(5), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Eze three', 'nice_to_have')$$, current_setting('test.ie')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format($$update public.wishlist_items set name = 'T180 Eze edited' where id = %L$$, current_setting('test.eze_one')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select public.remove_wishlist_item(%L)', current_setting('test.eze_one')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select public.restore_wishlist_item(%L)', current_setting('test.eze_two'))),
  'err:42501/ok:0/err:P0002/err:P0002',
  'a person who left cannot add to, edit, bin or restore items on their ideas list');
select is(
  pg_temp.try_as(pg_temp.u(5), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.le')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select public.use_exchange_ideas(%L)', current_setting('test.e1')))
  || '/' || pg_temp.ml(pg_temp.u(5), current_setting('test.e1'), 'source'),
  'err:P0002/err:P0002/null', 'a person who left cannot attach or start ideas, and has no list status');

-- 48-52. Nobody else learns what a member attached (AC-20, AC-21). Bola attaches her private list L1.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l1')));
end $fx$;
select is(
  pg_temp.try_as(pg_temp.u(3), format('select id from public.wishlists where id = %L', current_setting('test.l1')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select id from public.wishlist_items where wishlist_id = %L', current_setting('test.l1')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select id from public.wishlists where id = %L', current_setting('test.l1')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select id from public.wishlist_items where wishlist_id = %L', current_setting('test.l1'))),
  'ok:0/ok:0/ok:0/ok:0', 'a co-member and the organiser cannot read an attached Private list or its items');
select is(
  pg_temp.try_as(pg_temp.u(3), format('select id from public.wishlists where exchange_id = %L and owner_id <> %L', current_setting('test.e1'), pg_temp.u(3)::text))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select id from public.wishlists where exchange_id = %L', current_setting('test.e1')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select id from public.wishlist_items where wishlist_id = %L', current_setting('test.i1')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select id from public.wishlist_items where wishlist_id = %L', current_setting('test.i1'))),
  'ok:0/ok:0/ok:0/ok:0', 'nobody else can find or read ideas lists and their items by exchange or by list');
select is(
  coalesce(pg_temp.val_as(null, format('public.get_shared_wishlist(%L)', (select share_token from public.wishlists where id = current_setting('test.l1')::uuid))), 'null')
  || '/' || coalesce(pg_temp.val_as(null, format('public.get_shared_wishlist(%L)', (select share_token from public.wishlists where id = current_setting('test.i1')::uuid))), 'null'),
  'null/null', 'a visitor holding the token of a Private list or of an ideas list gets nothing');
select is(
  pg_temp.ml(pg_temp.u(3), current_setting('test.e1'), 'wishlist_id') || '/' || pg_temp.ml(pg_temp.u(1), current_setting('test.e1'), 'wishlist_id'),
  current_setting('test.ic') || '/null', 'get_my_exchange_list answers for the caller only: a co-member and the organiser see their own, not Bola''s');
select is(
  pg_temp.try_as(pg_temp.u(2), format($$update public.wishlists set visibility = 'link' where id = %L$$, current_setting('test.i1')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format($$update public.wishlists set name = 'T180 Renamed' where id = %L$$, current_setting('test.i1')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.delete_wishlist(%L)', current_setting('test.i1'))),
  'ok:0/ok:0/err:P0002', 'an ideas list cannot be shared, renamed or deleted from the wishlist paths');

-- 53-54. The check refuses a link ideas list even for the migration role; personal paths are unchanged.
select throws_ok(
  format($$update public.wishlists set visibility = 'link' where id = %L$$, current_setting('test.i1')),
  '23514', null, 'an ideas list can never be link-visible');
select is(
  pg_temp.try_as(pg_temp.u(2), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Item three', 'nice_to_have')$$, current_setting('test.l2')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T180 Elsewhere', 'nice_to_have')$$, current_setting('test.lc'))),
  'ok:1/err:42501', 'personal lists keep working: own list yes, someone else''s no');

-- 55-58. Status: joining closed still allows attaching; the gift day passed and a cancelled exchange do not.
update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.e1')::uuid;
select is(pg_temp.try_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.e1'))),
  'ok:1', 'use_exchange_ideas still works once joining has closed (before the draw)');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l1'))),
  'ok:1', 'attach_wishlist still works once joining has closed (before the draw)');
update public.exchanges set join_by_at = now() - interval '3 days',
  gift_day = (now() at time zone 'Africa/Lagos')::date - 1
  where id = current_setting('test.e1')::uuid;
update public.exchanges set cancelled_at = now() where id = current_setting('test.e4')::uuid;
select is(
  pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e1'), current_setting('test.l2')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.e1'))),
  'err:P0002/err:P0002', 'once the gift day has passed, neither attach nor ideas works');
select is(
  pg_temp.try_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.e4'), current_setting('test.l1')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.e4'))),
  'err:P0002/err:P0002', 'a cancelled exchange accepts neither');

-- 59. Kept: Bola deletes the attached list (slice 2 delete path, which slice 16 will change); the exchange
-- keeps its items for the giver. get_my_exchange_list says so.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.delete_wishlist(%L)', current_setting('test.l1')));
end $fx$;
select is(
  pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'source') || '/'
  || (pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'wishlist_id') = current_setting('test.l1'))::text || '/'
  || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'name') || '/'
  || pg_temp.ml(pg_temp.u(2), current_setting('test.e1'), 'item_count'),
  'kept/true/T180 Bola list/2', 'an attached list that was deleted is reported as kept, with its live items counted');

select * from finish();
rollback;
