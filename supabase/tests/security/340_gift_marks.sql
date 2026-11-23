-- 340_gift_marks — slice 11 (GC-015 got-it marks; plan implementation-plan slice 11, §6 invariants 1, 4, 5; owner decision
-- 2026-11-23 Q1 in docs/tasks/slice-11.md).
-- Covers (AC-1, AC-2, AC-5 shape): private.gift_marks is closed to every API role (RLS on, no policy, no grant to anon,
-- authenticated or service_role: 42501 on select, insert, update and delete, not zero rows); the table holds exactly the
-- approved columns, all not null; one mark per (assignment, item) (23505); both foreign keys are real and none cascades
-- (23503, never-do 8); two assignments can each mark the same item (two givers); the only functions that mention the table
-- are the two giver functions, both SECURITY DEFINER; wishlist_items and wishlists have no column that could hold a mark,
-- so an item's owner has nothing to read.
-- Self-contained: creates its own users inside the transaction (needs the migrations through recipient_list_and_marks
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T340" because dev holds other data.
-- Written BEFORE the recipient_list_and_marks migration: until it is applied the first statement that names
-- private.gift_marks fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 12", "1..12", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

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

-- svc_try runs a statement as service_role (no claims needed) and returns 'ok:<rows>' or 'err:<SQLSTATE>'.
create function pg_temp.svc_try(stmt text) returns text
language plpgsql as $$
declare
  n bigint;
begin
  set local role service_role;
  set local request.jwt.claims = '{"role":"service_role"}';
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

-- owner_try runs a statement as the migration role (no role switch) and returns the SQLSTATE or 'ok'.
create function pg_temp.owner_try(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return sqlstate;
end $$;

create function pg_temp.mk(p_name text) returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, false)',
    p_name, '10k_20k', 'organiser_chooses', '18:00', 'Africa/Lagos')
$$;

-- No passwords, no real addresses: the .test TLD can never reach an inbox.
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

-- u(n) is persona n: 1 Ada (organiser, takes part), 2 Bola, 3 Chi (members).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('34' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.mid(nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = current_setting('test.ex_p')::uuid and p.display_name = nm and m.state = 'active'
$$;

-- The current assignment id of a giver, by first name.
create function pg_temp.aid(nm text) returns uuid
language sql as $$
  select a.id from private.assignments a where a.giver_member_id = pg_temp.mid(nm) and a.superseded_at is null
$$;

create function pg_temp.item(nm text) returns uuid
language sql as $$
  select i.id from public.wishlist_items i where i.name = nm
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u340-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi'])[i]))
  from generate_series(1, 3) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T340 Marks'));
  -- WHY a guard: try_as swallows errors, so a failed create would otherwise show only as a uuid error much later.
  if (select count(*) from public.exchanges where name = 'T340 Marks') <> 1 then
    raise exception 'T340 fixture: exchange not created';
  end if;
end $fx$;

-- Members and a ring of three assignments (Ada to Bola, Bola to Chi, Chi to Ada), written as the migration role.
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T340 Marks'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3]) n;
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Ada'), pg_temp.mid('Bola'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Bola'), pg_temp.mid('Chi'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Chi'), pg_temp.mid('Ada'), 1, 'full');
  if (select count(*) from private.assignments where exchange_id = current_setting('test.ex_p')::uuid) <> 3 then
    raise exception 'T340 fixture: three assignments expected';
  end if;
end $fx$;

-- Bola's list with two items (the thing Ada would mark), written as the migration role.
do $fx$
declare
  v_bola uuid;
begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T340 Bola list') returning id into v_bola;
  insert into public.wishlist_items (wishlist_id, name, priority) values
    (v_bola, 'T340 Item X', 'most_wanted'),
    (v_bola, 'T340 Item Y', 'nice_to_have');
  update public.exchange_members set attached_wishlist_id = v_bola where id = pg_temp.mid('Bola');
  if (select count(*) from public.wishlist_items where name like 'T340 Item %') <> 2 then
    raise exception 'T340 fixture: two items expected';
  end if;
end $fx$;

-- 1. The table exists with RLS on, NO policy and no grant to any API role: the only readers are the definer functions.
select ok(
  (select relrowsecurity from pg_class where oid = 'private.gift_marks'::regclass)
  and not exists (select 1 from pg_policy where polrelid = 'private.gift_marks'::regclass)
  and not has_table_privilege('anon', 'private.gift_marks', 'select, insert, update, delete, truncate, references, trigger')
  and not has_table_privilege('authenticated', 'private.gift_marks', 'select, insert, update, delete, truncate, references, trigger')
  and not has_table_privilege('service_role', 'private.gift_marks', 'select, insert, update, delete, truncate, references, trigger')
  and not has_any_column_privilege('anon', 'private.gift_marks', 'select, insert, update, references')
  and not has_any_column_privilege('authenticated', 'private.gift_marks', 'select, insert, update, references')
  and not has_any_column_privilege('service_role', 'private.gift_marks', 'select, insert, update, references'),
  'private.gift_marks has RLS on, no policy and no grant for anon, authenticated or service_role');

-- 2. WHY an exact column list: the pair of ids and a time, all required. No note, no price, no name, no person id.
select is(
  (select string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' order by ordinal_position)
   from information_schema.columns where table_schema = 'private' and table_name = 'gift_marks'),
  'assignment_id:uuid:NO,item_id:uuid:NO,created_at:timestamp with time zone:NO',
  'the table holds exactly an assignment id, an item id and a time, all required');

-- 3-5. AC-1: a signed-in person, a visitor and the service role are refused (42501) on every statement, not given zero rows.
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from private.gift_marks')
  || '/' || pg_temp.try_as(pg_temp.u(2), format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)',
      pg_temp.aid('Ada'), pg_temp.item('T340 Item Y')))
  || '/' || pg_temp.try_as(pg_temp.u(2), 'update private.gift_marks set created_at = now()')
  || '/' || pg_temp.try_as(pg_temp.u(2), 'delete from private.gift_marks'),
  'err:42501/err:42501/err:42501/err:42501',
  'a signed-in person (the organiser, then the item owner) is refused (42501) selecting, inserting, updating and deleting private.gift_marks');
select is(
  pg_temp.try_as(null, 'select * from private.gift_marks')
  || '/' || pg_temp.try_as(null, format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)',
      pg_temp.aid('Ada'), pg_temp.item('T340 Item Y')))
  || '/' || pg_temp.try_as(null, 'update private.gift_marks set created_at = now()')
  || '/' || pg_temp.try_as(null, 'delete from private.gift_marks'),
  'err:42501/err:42501/err:42501/err:42501',
  'a visitor is refused (42501) selecting, inserting, updating and deleting private.gift_marks');
select is(
  pg_temp.svc_try('select * from private.gift_marks')
  || '/' || pg_temp.svc_try(format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)',
      pg_temp.aid('Ada'), pg_temp.item('T340 Item Y')))
  || '/' || pg_temp.svc_try('update private.gift_marks set created_at = now()')
  || '/' || pg_temp.svc_try('delete from private.gift_marks'),
  'err:42501/err:42501/err:42501/err:42501',
  'the service role is refused (42501) selecting, inserting, updating and deleting private.gift_marks');

-- 6. One mark per (assignment, item): the primary key is exactly that pair. The first insert is its own statement (a count in
-- the same statement could not see it); the second is the same pair again (23505).
do $fx$ begin
  perform set_config('test.first_mark', pg_temp.owner_try(format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)',
    pg_temp.aid('Ada'), pg_temp.item('T340 Item X'))), true);
end $fx$;
select is(
  current_setting('test.first_mark')
  || '/' || pg_temp.owner_try(format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)',
    pg_temp.aid('Ada'), pg_temp.item('T340 Item X')))
  || '/' || (select count(*)::text from private.gift_marks gm where gm.assignment_id in (select a.id from private.assignments a where a.exchange_id = current_setting('test.ex_p')::uuid))
  || '/' || (select string_agg(a.attname, ',' order by a.attnum)
       from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
       where i.indrelid = 'private.gift_marks'::regclass and i.indisprimary),
  'ok/23505/1/assignment_id,item_id', 'a mark is one row per assignment and item: marking twice is a duplicate, not a second row');

-- 7. Foreign keys: a mark follows a real assignment (23503) and a real item (23503).
select is(
  pg_temp.owner_try(format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)', gen_random_uuid(), pg_temp.item('T340 Item X')))
  || '/' || pg_temp.owner_try(format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)', pg_temp.aid('Ada'), gen_random_uuid())),
  '23503/23503', 'a mark must name a real assignment and a real item');

-- 8. WHY no cascade (never-do 8): exactly two foreign keys, to assignments and to items, none of them cascading or nulling.
select is(
  (select count(*)::text || ':' || count(*) filter (where c.confdeltype <> 'a')::text || ':'
          || string_agg(c.confrelid::regclass::text, ',' order by c.confrelid::regclass::text)
   from pg_constraint c where c.conrelid = 'private.gift_marks'::regclass and c.contype = 'f'),
  '2:0:private.assignments,wishlist_items', 'both foreign keys are no-action: no delete cascades into or out of the marks');

-- 9. Two givers of the same person each have their own mark on the same item (a different assignment is a different pair).
do $fx$ begin
  perform set_config('test.second_mark', pg_temp.owner_try(format('insert into private.gift_marks (assignment_id, item_id) values (%L, %L)',
    pg_temp.aid('Chi'), pg_temp.item('T340 Item X'))), true);
end $fx$;
select is(
  current_setting('test.second_mark')
  || '/' || (select count(*)::text from private.gift_marks where item_id = pg_temp.item('T340 Item X')),
  'ok/2', 'two assignments can each hold a mark on the same item');

-- 10. WHY a source check: marks are reachable only through the two giver functions, and both are SECURITY DEFINER. Any other
-- function that starts to mention the table fails here.
select is(
  (select string_agg(p.proname || ':' || p.prosecdef::text, ',' order by p.proname)
   from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ilike '%gift_marks%'),
  'open_recipient_list:true,set_gift_mark:true',
  'only open_recipient_list and set_gift_mark read or write the marks, and both are SECURITY DEFINER');

-- 11. AC-2: the owner of a list has nothing to read: no column on wishlists or wishlist_items can hold a mark.
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name in ('wishlists', 'wishlist_items')
     and (column_name ilike '%mark%' or column_name ilike '%got%' or column_name ilike '%bought%' or column_name ilike '%reserv%')),
  0, 'wishlists and wishlist_items have no column for a mark, a purchase or a reservation');

-- 12. A giver cannot be told apart from the mark: the owner's own read of the item carries the same keys with and without a
-- mark (Item X is marked twice above, Item Y never).
select is(
  (select string_agg(distinct (select string_agg(k, ',' order by k collate "C") from jsonb_object_keys(to_jsonb(i)) k), '|')
   from public.wishlist_items i where i.name like 'T340 Item %'),
  (select string_agg(column_name::text, ',' order by column_name::text collate "C") from information_schema.columns
   where table_schema = 'public' and table_name = 'wishlist_items'),
  'a marked and an unmarked item have exactly the same columns');

select * from finish();
rollback;
