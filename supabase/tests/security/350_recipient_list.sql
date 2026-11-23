-- 350_recipient_list — slice 11 (GC-015 recipient list and got-it marks; plan implementation-plan slice 11, §6 invariants 1, 4,
-- 5, 12; owner decisions 2026-11-23 Q1, Q2, Q5, Q6 in docs/tasks/slice-11.md; closes open item 110 for get_my_recipient).
-- Covers: the three giver functions are SECURITY DEFINER with an empty search_path, closed to a visitor (42501) and open to
-- signed-in people; open_recipient_list returns the person's name and photo path, a list state and the items with EXACTLY
-- the keys ref, name, priority, note, price_kobo, link, updated and got, and nothing else (no item id, wishlist id, list name
-- or source), recently changed first, with the reference md5(row salt || item id); Updated is computed against the PREVIOUS
-- list_last_opened_at and then the time is stamped (a first open shows no badges, an immediate second open shows none, an
-- edit afterwards shows one); set_gift_mark marks and unmarks, is idempotent, and resolves a reference for the caller's own
-- current row only (a reference of another giver, an item id, an item that is not on the list, and a reference of a replaced
-- row are all P0002); two givers of one person see only their own marks; a marked item the owner removed, and a marked item
-- on a list the owner detached (Q6), come back as taken_off and can be unmarked; an unrevealed giver, a person who gives to
-- nobody here, an organiser who only organises, an outsider and a member of another exchange get no rows (open) and P0002
-- (mark); a null exchange, a null mark value and a null reference are refused; the list and the marks work while the state
-- is drawn and event_passed and are refused once complete or cancelled (Q5), and a refusal changes nothing; the OWNER of
-- the list (a member, and the organiser taking part) cannot tell whether anything is marked: their own reads, their items'
-- and lists' updated_at, the activity events and the email outbox are identical before and after marks; get_my_recipient
-- gains the same state check and returns the same references as the list.
-- Ring in P: Ada gives to Bola, Bola to Chi, Chi to Dayo, Dayo to Ada, and Eze to Chi (a second giver of Chi).
-- Self-contained: creates its own users inside the transaction (needs the migrations through recipient_list_and_marks
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T350" because dev holds other data.
-- Written BEFORE the recipient_list_and_marks migration: until it is applied the first statement that names a new function
-- fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 41", "1..41", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(41);

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

-- val_as returns one value read as a persona (null = anon), or 'err:<SQLSTATE>:<hint>'.
create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
  h text;
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
    get stacked diagnostics h = pg_exception_hint;
    reset role;
    return 'err:' || sqlstate || ':' || coalesce(h, '');
  end;
end $$;

-- run_as runs a statement that returns no useful value (a void function) as a persona: '1' or 'err:<SQLSTATE>:<hint>'.
create function pg_temp.run_as(who uuid, stmt text) returns text
language sql as $$
  select pg_temp.val_as(who, format('(select count(*) from (%s) s)', stmt))
$$;

create function pg_temp.mk(p_name text, taking text default 'true') returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, %s, false)',
    p_name, '10k_20k', 'organiser_chooses', '18:00', 'Africa/Lagos', taking)
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

-- u(n) is persona n: 1 Ada (organiser of P, takes part), 2 Bola, 3 Chi, 4 Dayo, 5 Eze (members of P), 6 Mo (outsider),
-- 7 Femi (organiser of Q, only organising), 8 Gbemi, 9 Hana, 10 Ife (members of Q).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('35' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.mid(ex text, nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = ex::uuid and p.display_name = nm and m.state = 'active'
$$;

-- The current assignment id of a giver in P, by first name.
create function pg_temp.aid(nm text) returns uuid
language sql as $$
  select a.id from private.assignments a
  where a.giver_member_id = pg_temp.mid(current_setting('test.ex_p'), nm) and a.superseded_at is null
$$;

create function pg_temp.item(nm text) returns uuid
language sql as $$
  select i.id from public.wishlist_items i where i.name = nm
$$;

-- refof: the reference of an item for one giver's CURRENT row, made the way the database makes it.
create function pg_temp.refof(giver text, nm text) returns text
language sql as $$
  select md5(a.ref_salt || i.id::text) from private.assignments a, public.wishlist_items i
  where a.id = pg_temp.aid(giver) and i.name = nm
$$;

-- open_to opens the list as a persona and keeps the whole answer as json text in a transaction setting ('none' for no rows).
-- WHY a setting: opening writes (it stamps the time), and a read in the same statement cannot see a write (snapshot).
create function pg_temp.open_to(slot text, who uuid) returns void
language plpgsql as $$
begin
  perform set_config(slot, coalesce(pg_temp.val_as(who,
    format($q$(select to_jsonb(r) from public.open_recipient_list(%L) r)$q$, current_setting('test.ex_p'))), 'none'), true);
end $$;

-- mark_to marks or unmarks as a persona and keeps '1' or 'err:<SQLSTATE>:<hint>' in a transaction setting.
create function pg_temp.mark_to(slot text, who uuid, ref text, got boolean) returns void
language plpgsql as $$
begin
  perform set_config(slot, pg_temp.run_as(who,
    format('select public.set_gift_mark(%L, %L, %s)', current_setting('test.ex_p'), ref, got::text)), true);
end $$;

-- flags: "<name>:<value of key k>" for each item of a stored answer, in the order returned.
create function pg_temp.flags(slot text, k text) returns text
language sql as $$
  select coalesce(string_agg((x ->> 'name') || ':' || (x ->> k), '|' order by t.o), '-')
  from jsonb_array_elements(current_setting(slot)::jsonb -> 'items') with ordinality t(x, o)
$$;

-- taken: the names of the taken-off items of a stored answer, in the order returned.
create function pg_temp.taken(slot text) returns text
language sql as $$
  select coalesce(string_agg(x ->> 'name', '|' order by t.o), '-')
  from jsonb_array_elements(current_setting(slot)::jsonb -> 'taken_off') with ordinality t(x, o)
$$;

-- fp: a fingerprint of everything an owner or an organiser could notice: every item (with its updated_at and deleted_at) and
-- every list (with its updated_at) of this file, and the number of activity events and queued emails. Read as the migration
-- role, in its own statement.
create function pg_temp.fp() returns text
language sql as $$
  select (select md5(coalesce(string_agg(i.id::text || '/' || i.updated_at::text || '/' || coalesce(i.deleted_at::text, '-') || '/'
                                       || i.name || '/' || coalesce(i.note, '-') || '/' || coalesce(i.link, '-') || '/'
                                       || coalesce(i.price_kobo::text, '-'), '|' order by i.id), ''))
          from public.wishlist_items i join public.wishlists w on w.id = i.wishlist_id where w.name like 'T350%')
    || ':' || (select md5(coalesce(string_agg(w.id::text || '/' || w.updated_at::text, '|' order by w.id), ''))
               from public.wishlists w where w.name like 'T350%')
    || ':' || (select count(*)::text from public.activity_events)
    || ':' || (select count(*)::text from private.email_outbox)
$$;

-- owner_view: everything the owner of a list can read about it, as that owner: the items, all their lists, and their own
-- exchange list status.
create function pg_temp.owner_view(who uuid, lst text) returns text
language sql as $$
  select pg_temp.val_as(who, format($q$(select coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from public.wishlist_items i where i.wishlist_id = %L), '[]'::jsonb)::text
    || coalesce((select jsonb_agg(to_jsonb(w))::text from public.wishlists w), '')
    || coalesce(public.get_my_exchange_list(%L)::text, ''))$q$, lst, current_setting('test.ex_p')))
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u350-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Mo', 'Femi', 'Gbemi', 'Hana', 'Ife'])[i]))
  from generate_series(1, 10) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T350 Ring'));
  perform pg_temp.try_as(pg_temp.u(7), pg_temp.mk('T350 Just organising', 'false'));
  -- WHY a guard: try_as swallows errors, so a failed create would otherwise show only as a uuid error much later.
  if (select count(*) from public.exchanges where name in ('T350 Ring', 'T350 Just organising')) <> 2 then
    raise exception 'T350 fixture: exchanges not created';
  end if;
end $fx$;

-- Members and assignments, written as the migration role (the join path and the draw are covered by 170 and 310).
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T350 Ring'), true);
  perform set_config('test.ex_q', (select id::text from public.exchanges where name = 'T350 Just organising'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3, 4, 5]) n;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_q')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[8, 9, 10]) n;

  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Ada'), pg_temp.mid(current_setting('test.ex_p'), 'Bola'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Bola'), pg_temp.mid(current_setting('test.ex_p'), 'Chi'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Chi'), pg_temp.mid(current_setting('test.ex_p'), 'Dayo'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Dayo'), pg_temp.mid(current_setting('test.ex_p'), 'Ada'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Eze'), pg_temp.mid(current_setting('test.ex_p'), 'Chi'), 1, 'assignment');
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values
    (current_setting('test.ex_q')::uuid, pg_temp.mid(current_setting('test.ex_q'), 'Gbemi'), pg_temp.mid(current_setting('test.ex_q'), 'Hana'), 1, 'full'),
    (current_setting('test.ex_q')::uuid, pg_temp.mid(current_setting('test.ex_q'), 'Hana'), pg_temp.mid(current_setting('test.ex_q'), 'Ife'), 1, 'full'),
    (current_setting('test.ex_q')::uuid, pg_temp.mid(current_setting('test.ex_q'), 'Ife'), pg_temp.mid(current_setting('test.ex_q'), 'Gbemi'), 1, 'full');
  if (select count(*) from private.assignments where exchange_id in (current_setting('test.ex_p')::uuid, current_setting('test.ex_q')::uuid)) <> 8 then
    raise exception 'T350 fixture: eight assignments expected';
  end if;
  if private.exchange_status(current_setting('test.ex_p')::uuid) <> 'drawn' or private.exchange_status(current_setting('test.ex_q')::uuid) <> 'drawn' then
    raise exception 'T350 fixture: both exchanges must read drawn';
  end if;

  -- Ada, Bola, Chi and Eze have revealed. Dayo has not (the unrevealed giver). Ada last opened the list 60 hours ago.
  update private.assignments set revealed_at = now()
    where id in (pg_temp.aid('Ada'), pg_temp.aid('Bola'), pg_temp.aid('Chi'), pg_temp.aid('Eze'));
  update private.assignments set list_last_opened_at = now() - interval '60 hours' where id = pg_temp.aid('Ada');
  update public.profiles set avatar_path = 'T350/bola.jpg' where id = pg_temp.u(2);
end $fx$;

-- Lists. Bola (Ada's person): B1 Most wanted with a price, link and note, 72 hours old; B2 Nice to have with nothing else,
-- 48 hours old. Chi (Bola's and Eze's person): C1 five days, C2 one day, C3 four days, C4 deleted. Ada (Dayo's person): A1.
-- Dayo (Chi's person) has no list.
do $fx$
declare
  v_lb uuid;
  v_lc uuid;
  v_la uuid;
begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T350 Bola secret list name') returning id into v_lb;
  insert into public.wishlists (owner_id, name) values (pg_temp.u(3), 'T350 Chi list') returning id into v_lc;
  insert into public.wishlists (owner_id, name) values (pg_temp.u(1), 'T350 Ada list') returning id into v_la;
  insert into public.wishlist_items (wishlist_id, name, price_kobo, priority, link, note, updated_at, deleted_at) values
    (v_lb, 'T350 B1', 2000000, 'most_wanted', 'https://example.test/b1', 'note b1', now() - interval '72 hours', null),
    (v_lb, 'T350 B2', null, 'nice_to_have', null, null, now() - interval '48 hours', null),
    (v_lc, 'T350 C1', 1000000, 'most_wanted', null, null, now() - interval '5 days', null),
    (v_lc, 'T350 C2', 2000000, 'nice_to_have', null, null, now() - interval '1 day', null),
    (v_lc, 'T350 C3', 3000000, 'most_wanted', null, null, now() - interval '4 days', null),
    (v_lc, 'T350 C4 gone', 4000000, 'most_wanted', null, null, now(), now()),
    (v_la, 'T350 A1', 500000, 'most_wanted', null, null, now() - interval '1 day', null);
  update public.exchange_members set attached_wishlist_id = v_lb where id = pg_temp.mid(current_setting('test.ex_p'), 'Bola');
  update public.exchange_members set attached_wishlist_id = v_lc where id = pg_temp.mid(current_setting('test.ex_p'), 'Chi');
  update public.exchange_members set attached_wishlist_id = v_la where id = pg_temp.mid(current_setting('test.ex_p'), 'Ada');
  perform set_config('test.lb', v_lb::text, true);
  perform set_config('test.lc', v_lc::text, true);
  perform set_config('test.la', v_la::text, true);
  if (select count(*) from public.wishlist_items where name like 'T350 %') <> 7 then
    raise exception 'T350 fixture: seven items expected';
  end if;
end $fx$;

-- 1. The three giver functions are SECURITY DEFINER with an empty search_path, one signature each.
select ok(
  (select count(*) = 3 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('open_recipient_list', 'set_gift_mark', 'get_my_recipient')),
  'open_recipient_list, set_gift_mark and get_my_recipient are SECURITY DEFINER with an empty search_path, one signature each');

-- 2. Closed to anon, open to signed-in people.
select ok(
  not has_function_privilege('anon', 'public.open_recipient_list(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.set_gift_mark(uuid,text,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_recipient(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.open_recipient_list(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.set_gift_mark(uuid,text,boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_recipient(uuid)', 'execute'),
  'anon cannot execute the giver functions and signed-in people can');

-- 3. Names and results: the argument is never a person, a member, an item or a list id; the list carries a name, a photo path,
-- a list state, the items and the taken-off items; opening is volatile because it stamps the time; get_my_recipient keeps
-- its columns.
select is(
  (select proargnames::text from pg_proc where oid = 'public.open_recipient_list(uuid)'::regprocedure)
  || '/' || (select proargnames::text from pg_proc where oid = 'public.set_gift_mark(uuid,text,boolean)'::regprocedure)
  || '/' || pg_get_function_result('public.set_gift_mark(uuid,text,boolean)'::regprocedure)
  || '/' || (select provolatile::text from pg_proc where oid = 'public.open_recipient_list(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.get_my_recipient(uuid)'::regprocedure),
  '{p_exchange,display_name,avatar_path,list_state,items,taken_off}/{p_exchange,p_ref,p_got}/void/v/TABLE(display_name text, avatar_path text, list_state text, most_wanted jsonb)',
  'the function shapes are the approved ones');

-- 4. A visitor is refused outright.
select is(
  pg_temp.try_as(null, format('select * from public.open_recipient_list(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_p'), 'x')),
  'err:42501/err:42501', 'a visitor is refused (42501) opening a list or marking an item');

-- 5-14. Ada (Bola's giver, revealed, last opened 60 hours ago) opens Bola's list. The open is its own statement: it writes.
do $fx$ begin
  perform pg_temp.open_to('test.o1', pg_temp.u(1));
end $fx$;

-- 5. The person: name, photo path and a list with items.
select is(
  (current_setting('test.o1')::jsonb ->> 'display_name') || ':' || coalesce(current_setting('test.o1')::jsonb ->> 'avatar_path', '-')
  || ':' || (current_setting('test.o1')::jsonb ->> 'list_state'),
  'Bola:T350/bola.jpg:items', 'the giver reads the name, the photo path and the list state of the person they give to');

-- 6. AC-6: recently changed first, and Updated is computed against the PREVIOUS open (60 hours ago): B2 changed 48 hours ago,
-- B1 72 hours ago. Nothing is marked yet.
select is(
  pg_temp.flags('test.o1', 'updated') || '/' || pg_temp.flags('test.o1', 'got'),
  'T350 B2:true|T350 B1:false/T350 B2:false|T350 B1:false',
  'items come recently changed first; only the one changed since the previous open is Updated; none is got');

-- 7. AC-4: exactly the approved keys on every item and on the answer.
select is(
  (select string_agg(distinct k, ',' order by k)
     from jsonb_array_elements(current_setting('test.o1')::jsonb -> 'items') x, jsonb_object_keys(x) k)
  || '/' || (select string_agg(k, ',' order by k) from jsonb_object_keys(current_setting('test.o1')::jsonb) k),
  'got,link,name,note,price_kobo,priority,ref,updated/avatar_path,display_name,items,list_state,taken_off',
  'each item is exactly ref, name, priority, note, price_kobo, link, updated and got');

-- 8. AC-4: nothing else leaves: no list name, list id, item id, member id, person id, address or source.
select ok(
  current_setting('test.o1') not like 'err:%' and current_setting('test.o1') <> 'none'
  and current_setting('test.o1') not ilike '%secret list name%'
  and current_setting('test.o1') not like '%' || current_setting('test.lb') || '%'
  and current_setting('test.o1') not like '%@%'
  and current_setting('test.o1') not like '%wishlist_id%'
  and current_setting('test.o1') not like '%"source"%'
  and not exists (select 1 from public.wishlist_items i where current_setting('test.o1') like '%' || i.id::text || '%')
  and not exists (select 1 from public.exchange_members m where current_setting('test.o1') like '%' || m.id::text || '%')
  and not exists (select 1 from auth.users u where current_setting('test.o1') like '%' || u.id::text || '%'),
  'the list answer holds no list name, list id, item id, member id, person id, address or source');

-- 9. The values: price in kobo, priority, link and note as stored; a missing price, link and note stay missing.
select is(
  (select string_agg((x ->> 'name') || '=' || coalesce(x ->> 'price_kobo', '-') || '/' || (x ->> 'priority') || '/'
                     || coalesce(x ->> 'link', '-') || '/' || coalesce(x ->> 'note', '-'), '|' order by x ->> 'name')
   from jsonb_array_elements(current_setting('test.o1')::jsonb -> 'items') x),
  'T350 B1=2000000/most_wanted/https://example.test/b1/note b1|T350 B2=-/nice_to_have/-/-',
  'each item carries its price in kobo, priority, link and note, and a missing one stays missing');

-- 10. The reference is md5(this row's salt || the item id), in the order returned.
select is(
  (select string_agg(x ->> 'ref', '|' order by t.o) from jsonb_array_elements(current_setting('test.o1')::jsonb -> 'items') with ordinality t(x, o)),
  (select string_agg(md5(a.ref_salt || i.id::text), '|' order by i.updated_at desc, i.id)
     from private.assignments a, public.wishlist_items i
    where a.id = pg_temp.aid('Ada') and i.wishlist_id = current_setting('test.lb')::uuid and i.deleted_at is null),
  'each reference is made from the row''s salt and the item id');

-- 11. AC-6: the open stamped the time ONLY on the caller's row.
select is(
  (select (a.list_last_opened_at >= now() and a.list_last_opened_at <= clock_timestamp())::text
     || '/' || (select count(*)::text from private.assignments x
                 where x.exchange_id = current_setting('test.ex_p')::uuid and x.list_last_opened_at is not null)
   from private.assignments a where a.id = pg_temp.aid('Ada')),
  'true/1', 'opening the list stamped the time on the caller''s own row and no other');

-- 12. AC-6: opened again straight away, nothing is Updated.
do $fx$ begin
  perform pg_temp.open_to('test.o2', pg_temp.u(1));
end $fx$;
select is(pg_temp.flags('test.o2', 'updated'), 'T350 B2:false|T350 B1:false',
  'an immediate second open shows no Updated item');

-- 13. AC-6: an edit after that open shows up: B1 changes, so it is first and Updated.
do $fx$ begin
  perform pg_sleep(0.02);
  update public.wishlist_items set note = 'note b1 edited' where name = 'T350 B1';
  perform pg_temp.open_to('test.o3', pg_temp.u(1));
end $fx$;
select is(pg_temp.flags('test.o3', 'updated'), 'T350 B1:true|T350 B2:false',
  'an item edited after the previous open is Updated and moves to the top');

-- 14. A row never opened before shows no Updated item (the list may have been attached after). Eze opens Chi's list: three live
-- items (the deleted one is not there), recently changed first.
do $fx$ begin
  perform pg_temp.open_to('test.o_eze', pg_temp.u(5));
end $fx$;
select is(pg_temp.flags('test.o_eze', 'updated'), 'T350 C2:false|T350 C3:false|T350 C1:false',
  'a first open shows no Updated item, and a deleted item is not listed');

-- Before any mark: the fingerprint of everything an owner could notice, and what Bola (owner of a list Ada will mark) reads.
do $fx$ begin
  perform set_config('test.fp', pg_temp.fp(), true);
  perform set_config('test.ov', coalesce(pg_temp.owner_view(pg_temp.u(2), current_setting('test.lb')), 'null'), true);
end $fx$;

-- 15. Ada marks B1 as got: one row, for her row and that item.
do $fx$ begin
  perform pg_temp.mark_to('test.m_a', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B1'), true);
end $fx$;
select is(
  current_setting('test.m_a') || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Ada'))
  || '/' || (select (m.item_id = pg_temp.item('T350 B1'))::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Ada')),
  '1/1/true', 'marking an item as got writes one mark for the caller''s row and that item');

-- 16. Marking again changes nothing (idempotent).
do $fx$ begin
  perform pg_temp.mark_to('test.m_b', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B1'), true);
end $fx$;
select is(
  current_setting('test.m_b') || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Ada')),
  '1/1', 'marking an item that is already marked is harmless and writes no second row');

-- 17. The list now says got for B1 and nothing is taken off.
do $fx$ begin
  perform pg_temp.open_to('test.o4', pg_temp.u(1));
end $fx$;
select is(pg_temp.flags('test.o4', 'got') || '/' || pg_temp.taken('test.o4'), 'T350 B1:true|T350 B2:false/-',
  'a marked item reads got on the list and nothing is taken off');

-- 18. Unmarking works and is idempotent: mark B2, unmark it, unmark it again.
do $fx$ begin
  perform pg_temp.mark_to('test.m_b2a', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B2'), true);
  perform pg_temp.mark_to('test.m_b2b', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B2'), false);
  perform pg_temp.mark_to('test.m_b2c', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B2'), false);
end $fx$;
select is(
  current_setting('test.m_b2a') || '/' || current_setting('test.m_b2b') || '/' || current_setting('test.m_b2c')
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Ada')),
  '1/1/1/1', 'a mark can be taken back, and taking it back again is harmless');

-- 19. AC-2: Bola owns the marked list. Marking changed nothing she (or anyone) could notice: her items and lists and her own
-- list status read exactly as before, their updated_at are unchanged, and no activity event or email was written.
select ok(
  pg_temp.fp() = current_setting('test.fp')
  and current_setting('test.ov') not like 'err:%'
  and pg_temp.owner_view(pg_temp.u(2), current_setting('test.lb')) = current_setting('test.ov'),
  'marking changes no item or list (updated_at included), writes no activity and queues no email, and the owner reads the same');

-- 20. AC-2: the owner cannot use the giver functions to find a mark: Bola's own reference or Ada's reference for B1 resolves to
-- nothing for Bola.
select is(
  pg_temp.run_as(pg_temp.u(2), format('select public.set_gift_mark(%L, %L, false)', current_setting('test.ex_p'), pg_temp.refof('Bola', 'T350 B1')))
  || '/' || pg_temp.run_as(pg_temp.u(2), format('select public.set_gift_mark(%L, %L, false)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1'))),
  'err:P0002:/err:P0002:', 'the owner of a list cannot resolve any reference to their own items');

-- 21. AC-3: an unrevealed giver (Dayo) gets no list and cannot mark, nothing is stamped or written; the person is still readable
-- before the reveal (slice 10), so the state check did not break that.
select is(
  coalesce(pg_temp.val_as(pg_temp.u(4), format('(select to_jsonb(r) from public.open_recipient_list(%L) r)', current_setting('test.ex_p'))), 'none')
  || '/' || pg_temp.run_as(pg_temp.u(4), format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_p'), pg_temp.refof('Dayo', 'T350 A1')))
  || '/' || pg_temp.val_as(pg_temp.u(4), format('(select display_name from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || (select (a.list_last_opened_at is null)::text from private.assignments a where a.id = pg_temp.aid('Dayo'))
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Dayo')),
  'none/err:P0002:/Ada/true/0', 'an unrevealed giver gets no list and no mark, and nothing is stamped');

-- 22. Once Dayo reveals, the list and the marks work; the references match those of get_my_recipient. Ada is the organiser AND
-- the owner of this list: her own reads are taken first so assertion 23 can compare them.
do $fx$ begin
  update private.assignments set revealed_at = now() where id = pg_temp.aid('Dayo');
  perform set_config('test.ov_ada', coalesce(pg_temp.owner_view(pg_temp.u(1), current_setting('test.la')), 'null'), true);
  perform pg_temp.mark_to('test.m_d', pg_temp.u(4), pg_temp.refof('Dayo', 'T350 A1'), true);
  perform pg_temp.open_to('test.o_dayo', pg_temp.u(4));
end $fx$;
select is(
  current_setting('test.m_d') || '/' || (current_setting('test.o_dayo')::jsonb ->> 'display_name') || '/' || pg_temp.flags('test.o_dayo', 'got')
  || '/' || (pg_temp.val_as(pg_temp.u(4), format($q$(select r.most_wanted -> 0 ->> 'ref' from public.get_my_recipient(%L) r)$q$, current_setting('test.ex_p')))
             = (current_setting('test.o_dayo')::jsonb -> 'items' -> 0 ->> 'ref'))::text,
  '1/Ada/T350 A1:true/true', 'after the reveal the giver lists and marks, and the references equal those of get_my_recipient');

-- 23. AC-2: the organiser who takes part owns the list Dayo marked: their reads, their items' updated_at, the activity events and
-- the outbox are the same as before every mark.
select ok(
  pg_temp.fp() = current_setting('test.fp')
  and current_setting('test.ov_ada') not like 'err:%'
  and pg_temp.owner_view(pg_temp.u(1), current_setting('test.la')) = current_setting('test.ov_ada'),
  'the organiser who owns a marked list cannot tell: nothing about the list, its items, the feed or the outbox changed');

-- 24. Two givers of one person (Bola and Eze both give to Chi) mark different items and each sees only their own marks.
do $fx$ begin
  perform pg_temp.mark_to('test.m_bc1', pg_temp.u(2), pg_temp.refof('Bola', 'T350 C1'), true);
  perform pg_temp.mark_to('test.m_ec2', pg_temp.u(5), pg_temp.refof('Eze', 'T350 C2'), true);
  perform pg_temp.open_to('test.o_bola', pg_temp.u(2));
  perform pg_temp.open_to('test.o_eze2', pg_temp.u(5));
end $fx$;
select is(
  current_setting('test.m_bc1') || '/' || current_setting('test.m_ec2')
  || '/' || pg_temp.flags('test.o_bola', 'got') || '/' || pg_temp.flags('test.o_eze2', 'got'),
  '1/1/T350 C2:false|T350 C3:false|T350 C1:true/T350 C2:true|T350 C3:false|T350 C1:false',
  'two givers of one person each see only their own marks');

-- 25. AC-5: the same item has a different reference for each giver, and a reference is not the item id.
select ok(
  pg_temp.refof('Bola', 'T350 C1') <> pg_temp.refof('Eze', 'T350 C1')
  and pg_temp.refof('Bola', 'T350 C1') <> pg_temp.item('T350 C1')::text
  and pg_temp.refof('Eze', 'T350 C1') <> pg_temp.item('T350 C1')::text,
  'one item has a different reference for each giver, and none is the item id');

-- 26. AC-5: a foreign reference, an item id, an item that is not on the person's list and a reference of a person who gives
-- to nobody on that list are all "not found", and no mark changed (Eze and Bola have one each).
do $fx$ begin
  perform pg_temp.mark_to('test.x1', pg_temp.u(5), pg_temp.refof('Bola', 'T350 C1'), true);
  perform pg_temp.mark_to('test.x2', pg_temp.u(5), pg_temp.refof('Bola', 'T350 C1'), false);
  perform pg_temp.mark_to('test.x3', pg_temp.u(5), pg_temp.item('T350 C1')::text, true);
  perform pg_temp.mark_to('test.x4', pg_temp.u(1), pg_temp.refof('Ada', 'T350 C1'), true);
  perform pg_temp.mark_to('test.x5', pg_temp.u(3), pg_temp.refof('Ada', 'T350 B1'), true);
  perform pg_temp.mark_to('test.x6', pg_temp.u(2), pg_temp.refof('Eze', 'T350 C2'), false);
end $fx$;
select is(
  current_setting('test.x1') || '/' || current_setting('test.x2') || '/' || current_setting('test.x3') || '/'
  || current_setting('test.x4') || '/' || current_setting('test.x5') || '/' || current_setting('test.x6')
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Eze'))
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Bola')),
  'err:P0002:/err:P0002:/err:P0002:/err:P0002:/err:P0002:/err:P0002:/1/1',
  'a foreign reference, an item id and an item off the list are refused, and no mark changed');

-- 27. AC-5: a replaced row. Eze's row is superseded and a new one written (a re-match, slice 14): the old reference resolves to
-- nothing, the new reference works, and the old mark stays with the old row only.
do $fx$ begin
  perform set_config('test.old_eze', pg_temp.aid('Eze')::text, true);
  perform set_config('test.old_ref', pg_temp.refof('Eze', 'T350 C2'), true);
  update private.assignments set superseded_at = now() where id = current_setting('test.old_eze')::uuid;
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind)
    values (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Eze'), pg_temp.mid(current_setting('test.ex_p'), 'Chi'), 2, 'rematch');
  update private.assignments set revealed_at = now() where id = pg_temp.aid('Eze');
  perform pg_temp.mark_to('test.r_old', pg_temp.u(5), current_setting('test.old_ref'), true);
  perform pg_temp.mark_to('test.r_new', pg_temp.u(5), pg_temp.refof('Eze', 'T350 C2'), true);
end $fx$;
select is(
  current_setting('test.r_old') || '/' || current_setting('test.r_new')
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = current_setting('test.old_eze')::uuid)
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Eze'))
  || '/' || (pg_temp.refof('Eze', 'T350 C2') <> current_setting('test.old_ref'))::text,
  'err:P0002:/1/1/1/true', 'a reference from a replaced row is refused; the new row has its own reference and its own mark');

-- 28. AC-7: Ada marks B2 as well, then Bola (the owner) removes B1. B1 leaves the items and comes back as taken off, with a
-- reference and a name and nothing else.
do $fx$ begin
  perform pg_temp.mark_to('test.m_t0', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B2'), true);
  perform pg_temp.try_as(pg_temp.u(2), format('select public.remove_wishlist_item(%L)', pg_temp.item('T350 B1')));
  if (select deleted_at is null from public.wishlist_items where name = 'T350 B1') then
    raise exception 'T350 fixture: B1 was not removed';
  end if;
  perform pg_temp.open_to('test.o_t1', pg_temp.u(1));
end $fx$;
select is(
  pg_temp.flags('test.o_t1', 'got') || '/' || pg_temp.taken('test.o_t1')
  || '/' || ((current_setting('test.o_t1')::jsonb -> 'taken_off' -> 0 ->> 'ref') = pg_temp.refof('Ada', 'T350 B1'))::text
  || '/' || (select string_agg(k, ',' order by k) from jsonb_object_keys(current_setting('test.o_t1')::jsonb -> 'taken_off' -> 0) k),
  'T350 B2:true/T350 B1/true/name,ref', 'a marked item the owner removed is listed as taken off, with a reference and a name only');

-- 29. AC-7: it can be unmarked from there, and the note goes away.
do $fx$ begin
  perform pg_temp.mark_to('test.m_t2', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B1'), false);
  perform pg_temp.open_to('test.o_t2', pg_temp.u(1));
end $fx$;
select is(
  current_setting('test.m_t2') || '/' || pg_temp.taken('test.o_t2')
  || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Ada')),
  '1/-/1', 'a taken-off item can be unmarked and then leaves the note');

-- 30. A removed item that is not marked cannot be marked.
do $fx$ begin
  perform pg_temp.mark_to('test.m_t3', pg_temp.u(1), pg_temp.refof('Ada', 'T350 B1'), true);
end $fx$;
select is(
  current_setting('test.m_t3') || '/' || (select count(*)::text from private.gift_marks m where m.assignment_id = pg_temp.aid('Ada')),
  'err:P0002:/1', 'an item that is no longer on the list cannot be marked');

-- 31. The owner puts B1 back (Undo): it is on the list again, unmarked, and B2 is still marked.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.restore_wishlist_item(%L)', pg_temp.item('T350 B1')));
  perform pg_temp.open_to('test.o_t4', pg_temp.u(1));
end $fx$;
select is(pg_temp.flags('test.o_t4', 'got') || '/' || pg_temp.taken('test.o_t4'), 'T350 B1:false|T350 B2:true/-',
  'an item put back reads on the list again and the other mark is kept');

-- 32. Q6: Bola removes her wishlist from the exchange (detach). Ada's mark on B2 is kept and the list reads as taken off.
do $fx$ begin
  perform set_config('test.d1', pg_temp.run_as(pg_temp.u(2), format('select public.detach_wishlist(%L)', current_setting('test.ex_p'))), true);
  perform pg_temp.open_to('test.o_t5', pg_temp.u(1));
end $fx$;
select is(
  current_setting('test.d1') || '/' || (current_setting('test.o_t5')::jsonb ->> 'list_state')
  || '/' || jsonb_array_length(current_setting('test.o_t5')::jsonb -> 'items')::text || '/' || pg_temp.taken('test.o_t5'),
  '1/none/0/T350 B2', 'marked items on a list the person removed read as taken off');

-- 33. Q6: and when the person attaches the list again, the items and the mark are back and nothing is taken off.
do $fx$ begin
  perform set_config('test.a1', pg_temp.run_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_p'), current_setting('test.lb'))), true);
  perform pg_temp.open_to('test.o_t6', pg_temp.u(1));
end $fx$;
select is(
  current_setting('test.a1') || '/' || pg_temp.flags('test.o_t6', 'got') || '/' || jsonb_array_length(current_setting('test.o_t6')::jsonb -> 'taken_off')::text,
  '1/T350 B1:false|T350 B2:true/0', 'attaching the list again brings the items and the mark back');

-- 34-36. AC-3: people who give to nobody here read nothing: an outsider (Mo), an organiser who only organises (Femi, on Q and
-- on P) and a member of another exchange (Gbemi on P).
select is(
  pg_temp.val_as(pg_temp.u(6), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(7), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(7), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_q')))
  || '/' || pg_temp.val_as(pg_temp.u(8), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_p'))),
  '0/0/0/0', 'an outsider, an organiser who only organises and a member of another exchange open no list');
select is(
  pg_temp.run_as(pg_temp.u(6), format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.run_as(pg_temp.u(7), format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.run_as(pg_temp.u(7), format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_q'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.run_as(pg_temp.u(8), format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1'))),
  'err:P0002:/err:P0002:/err:P0002:/err:P0002:', 'the same people cannot mark anything');
select is(
  pg_temp.val_as(pg_temp.u(6), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(7), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(7), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_q')))
  || '/' || pg_temp.val_as(pg_temp.u(8), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p'))),
  '0/0/0/0', 'and read no recipient either');

-- 37. A null or unknown exchange is "no rows" for the list and "not found" for a mark.
select is(
  pg_temp.val_as(pg_temp.u(1), 'select count(*) from public.open_recipient_list(null)')
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(null, %L, true)', pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.open_recipient_list(%L))', gen_random_uuid()))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(%L, %L, true)', gen_random_uuid(), pg_temp.refof('Ada', 'T350 B1'))),
  '0/err:P0002:/0/err:P0002:', 'a null or unknown exchange opens no list and marks nothing');

-- 38. Bad input: a null value is refused (22023, hint got); a null reference finds nothing (P0002).
select is(
  pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(%L, %L, null)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(%L, null, true)', current_setting('test.ex_p'))),
  'err:22023:got/err:P0002:', 'a null mark value is refused and a null reference finds nothing');

-- 39. Q5: after the gift day (event_passed) the list, the marks and the recipient still work.
do $fx$ begin
  update public.exchanges set join_by_at = now() - interval '3 days',
    gift_day = (now() at time zone 'Africa/Lagos')::date - 1
    where id = current_setting('test.ex_p')::uuid;
  if private.exchange_status(current_setting('test.ex_p')::uuid) <> 'event_passed' then
    raise exception 'T350 fixture: P should read event_passed';
  end if;
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(%L, %L, true)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select display_name from public.get_my_recipient(%L))', current_setting('test.ex_p'))),
  '1/1/Bola', 'once the gift day has passed the list, the marks and the recipient still work');

-- 40. Q5: once the exchange is complete they are refused, and a refusal changes nothing (no stamp, no mark).
do $fx$ begin
  perform set_config('test.stamp_before', (select a.list_last_opened_at::text from private.assignments a where a.id = pg_temp.aid('Ada')), true);
  perform set_config('test.marks_before', (select count(*)::text from private.gift_marks), true);
  update public.exchanges set completed_at = now() where id = current_setting('test.ex_p')::uuid;
  if private.exchange_status(current_setting('test.ex_p')::uuid) <> 'complete' then
    raise exception 'T350 fixture: P should read complete';
  end if;
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(%L, %L, false)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || (select (a.list_last_opened_at::text = current_setting('test.stamp_before'))::text from private.assignments a where a.id = pg_temp.aid('Ada'))
  || '/' || ((select count(*)::text from private.gift_marks) = current_setting('test.marks_before'))::text,
  '0/err:P0002:/0/true/true', 'a complete exchange opens no list, marks nothing and reads no recipient, and nothing changes');

-- 41. Q5: the same for a cancelled exchange.
do $fx$ begin
  update public.exchanges set completed_at = null, cancelled_at = now() where id = current_setting('test.ex_p')::uuid;
  if private.exchange_status(current_setting('test.ex_p')::uuid) <> 'cancelled' then
    raise exception 'T350 fixture: P should read cancelled';
  end if;
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.set_gift_mark(%L, %L, false)', current_setting('test.ex_p'), pg_temp.refof('Ada', 'T350 B1')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || (select (a.list_last_opened_at::text = current_setting('test.stamp_before'))::text from private.assignments a where a.id = pg_temp.aid('Ada'))
  || '/' || ((select count(*)::text from private.gift_marks) = current_setting('test.marks_before'))::text,
  '0/err:P0002:/0/true/true', 'a cancelled exchange opens no list, marks nothing and reads no recipient, and nothing changes');

select * from finish();
rollback;
