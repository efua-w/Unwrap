-- 160_rate_limits — audit finding 5 (2026-11-13; GCO-001, GC-019, GC-021).
-- Per person, per hour (owner decision 2026-11-13, the earlier Unwrap numbers): 10 exchanges,
-- 30 wishlists, 300 items. Over the limit the database refuses with SQLSTATE P0429. Writes with no
-- signed-in person (the migration role, the service role in tests) are not limited.
-- Self-contained: creates its own users inside the transaction (needs the rate_limits migration
-- applied). Everything rolls back.
-- Pass: "ok 1".."ok 12", "1..12", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

-- Same helper as 060 (inline so the file runs on its own); nothing is left in `public`.
create function pg_temp.try_as(who uuid, stmt text) returns text
language plpgsql as $$
declare
  n bigint;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
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

-- Runs the same statement n times as one person: how many succeeded, then what the next one says.
create function pg_temp.burst(who uuid, stmt text, n int) returns text
language plpgsql as $$
declare
  good int := 0;
begin
  for i in 1 .. n loop
    if pg_temp.try_as(who, stmt) like 'ok:%' then good := good + 1; end if;
  end loop;
  return good || '/' || pg_temp.try_as(who, stmt);
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

select pg_temp.mk_user('b0000000-0000-4000-8000-000000001601', 'ada-160@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001602', 'bola-160@example.test', '{"first_name":"Bola"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001603', 'cleo-160@example.test', '{"first_name":"Cleo"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001604', 'dayo-160@example.test', '{"first_name":"Dayo"}');

-- 1-2. The counter lives in `private`, closed to the API roles like everything there (020 also checks).
select has_table('private', 'rate_limits', 'private.rate_limits exists');
select ok(not has_table_privilege('authenticated', 'private.rate_limits', 'select, insert, update, delete'),
  'signed-in people have no privilege on private.rate_limits');

-- 3. Wishlists: 30 an hour, the 31st is refused with P0429.
select is(pg_temp.burst('b0000000-0000-4000-8000-000000001601', $$insert into public.wishlists (name) values ('List')$$, 30),
  '30/err:P0429', '30 wishlists in an hour are allowed and the 31st is refused');

-- 4. Another person is not affected.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001604', $$insert into public.wishlists (name) values ('Dayo list')$$),
  'ok:1', 'one person''s limit does not stop another person');

-- 5. A write with no signed-in person is not limited (the migration role here; the service role in tests).
-- WHY clear the claims: try_as sets them with `set local`, which outlives its role switch, so the owner
-- would otherwise still look like the last persona to auth.uid().
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$insert into public.wishlists (owner_id, name) values ('b0000000-0000-4000-8000-000000001601', 'Seeded')$$,
  'a write with no signed-in person is not limited');

-- 6. The window ends: an hour later Ada can create again.
update private.rate_limits set window_start = now() - interval '61 minutes'
where key = 'create_wishlist:b0000000-0000-4000-8000-000000001601';
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001601', $$insert into public.wishlists (name) values ('Next hour')$$),
  'ok:1', 'once the hour has passed the person can create again');

-- 7-8. Items: 300 an hour, the 301st is refused. The list is a fixture, written with no signed-in person.
select set_config('request.jwt.claims', '', true);
insert into public.wishlists (owner_id, name) values ('b0000000-0000-4000-8000-000000001602', 'T160 Bola');
select set_config('test.bola_list', (select id::text from public.wishlists where name = 'T160 Bola'), true);
select is(pg_temp.burst('b0000000-0000-4000-8000-000000001602',
  format($$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'Thing', 'nice_to_have')$$, current_setting('test.bola_list')), 300),
  '300/err:P0429', '300 items in an hour are allowed and the 301st is refused');
select is((select count(*)::int from public.wishlist_items where wishlist_id = current_setting('test.bola_list')::uuid),
  300, 'the refused item was not stored');

-- 9-10. Exchanges: 10 an hour, the 11th is refused.
select is(pg_temp.burst('b0000000-0000-4000-8000-000000001603',
  $$select public.create_exchange('T160', null, '10k_20k', current_date + 10, 'at_join_by', '18:00', current_date + 20, 'Africa/Lagos', true, false)$$, 10),
  '10/err:P0429', '10 exchanges in an hour are allowed and the 11th is refused');
select is((select count(*)::int from public.exchanges where organiser_id = 'b0000000-0000-4000-8000-000000001603'),
  10, 'the refused exchange was not stored');

-- 11. A refused attempt does not count (it rolls back), and a failed validation does not use up the limit.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001604',
  $$select public.create_exchange('', null, '10k_20k', current_date + 10, 'at_join_by', '18:00', current_date + 20, 'Africa/Lagos', true, false)$$),
  'err:22023', 'a refused exchange (blank name) is refused for its own reason');
select is((select count(*)::int from private.rate_limits where key = 'create_exchange:b0000000-0000-4000-8000-000000001604'),
  0, 'a refused exchange leaves no count behind');

select * from finish();
rollback;
