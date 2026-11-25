-- 200_activity_events — slice 6 (GCO-003, GC-006, GC-007; plan §3, §6; owner decisions 2026-11-14 Q1, Q2, Q11, Q12).
-- Covers AC-18, AC-19, AC-20, AC-21, AC-23, AC-30, AC-31: activity_events has RLS and no client grants (a direct
-- read or write is refused with 42501, not zero rows); events are written only by join_exchange and
-- request_to_join, only for the organiser, never for the joiner, a member, an idempotent repeat or a refusal;
-- get_my_activity returns the caller's own rows only, with exact columns, newest first, keyset pages,
-- limit 30 clamped to 1..50; unread count and Mark all as read touch the caller only; no function takes a user id.
-- Self-contained: creates its own users inside the transaction (needs the migrations through join_requests
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T200" because dev holds other data. now() is frozen inside a
-- transaction, so event times are moved by update, never relied on.
-- Written BEFORE the activity_events migration: until it is applied the first statement that names the new
-- table or functions fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok N", "1..N" (N is the plan below), no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(51);

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
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

-- own runs one statement as the migration role: 'ok' or 'err:<SQLSTATE>' (used for constraint checks).
create function pg_temp.own(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return 'err:' || sqlstate;
end $$;

-- val_as returns one value read as a persona (null = anon), or 'err:<SQLSTATE>'.
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

-- page_all walks the whole feed as a persona with keyset pages of `size`: 'rows/distinct rows'.
create function pg_temp.page_all(who uuid, size int) returns text
language plpgsql as $$
declare
  ids uuid[] := '{}';
  b_at timestamptz;
  b_id uuid;
  r record;
  n int;
  guard int := 0;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
  loop
    n := 0;
    for r in select * from public.get_my_activity(b_at, b_id, size) loop
      ids := ids || r.id;
      b_at := r.created_at;
      b_id := r.id;
      n := n + 1;
    end loop;
    guard := guard + 1;
    exit when n = 0 or guard > 100;
  end loop;
  reset role;
  return cardinality(ids) || '/' || (select count(distinct x) from unnest(ids) x);
end $$;

create function pg_temp.mk(
  p_name text,
  p_note text default null,
  mode text default 'at_join_by',
  taking text default 'true',
  approval text default 'false'
) returns text
language sql as $$
  select format('select public.create_exchange(%L, %L, %L, current_date + 10, %L, %L, current_date + 20, %L, %s, %s)',
    p_name, p_note, '10k_20k', mode, '18:00', 'Africa/Lagos', taking, approval)
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

-- u(n) is persona n: 1 Ada (organiser of A, B, C), 2 Bola, 3 Chi, 4 Dayo (left, rejoins), 5 Eze (organiser of
-- X), 6 Femi (member of A), 7 Gus (organiser of G, the paging feed), 8 Hana.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('20' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u200-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gus', 'Hana'])[i]))
  from generate_series(1, 8) i;
end $fx$;

-- Exchanges, made the way the app makes them: A open, B approval required, C joining closed (below), X Eze's,
-- G Gus's. Ada makes three (the limit is ten an hour).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T200 Open'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T200 Approval', mode => 'organiser_chooses', approval => 'true'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T200 Closed', mode => 'organiser_chooses'));
  perform pg_temp.try_as(pg_temp.u(5), pg_temp.mk('T200 Other'));
  perform pg_temp.try_as(pg_temp.u(7), pg_temp.mk('T200 Paging', mode => 'organiser_chooses'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_a', (select id::text from public.exchanges where name = 'T200 Open'), true);
  perform set_config('test.ex_b', (select id::text from public.exchanges where name = 'T200 Approval'), true);
  perform set_config('test.ex_c', (select id::text from public.exchanges where name = 'T200 Closed'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T200 Other'), true);
  perform set_config('test.ex_g', (select id::text from public.exchanges where name = 'T200 Paging'), true);
  perform set_config('test.tok_a', (select invite_token from public.exchanges where name = 'T200 Open'), true);
  perform set_config('test.tok_b', (select invite_token from public.exchanges where name = 'T200 Approval'), true);
  perform set_config('test.tok_c', (select invite_token from public.exchanges where name = 'T200 Closed'), true);
  perform set_config('test.tok_x', (select invite_token from public.exchanges where name = 'T200 Other'), true);
end $fx$;

-- States and members, written as the migration role (joining is what is under test, so the setup does not
-- use it and therefore writes no event). C: joining closed an hour ago. A: Femi is in; Dayo left.
do $fx$ begin
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_c')::uuid;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_a')::uuid, pg_temp.u(6), true, now() - interval '2 days');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_a')::uuid, pg_temp.u(4), true, 'left', now() - interval '3 days', now() - interval '1 day');
end $fx$;

-- 1. Shape: every function is SECURITY DEFINER with an empty search_path (040 also checks the schemas).
select ok(
  (select count(*) = 3 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('get_my_activity', 'get_unread_activity_count', 'mark_all_activity_read'))
  and (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
       where p.oid = 'private.add_activity_event(uuid, uuid, public.activity_kind, uuid)'::regprocedure),
  'every activity function, and private.add_activity_event, is SECURITY DEFINER with an empty search_path');

-- 2-3. Grants: anon can execute none of them; signed-in people can execute the three public ones; the writer
-- is closed to both API roles (AC-19, AC-30).
select ok(
  not has_function_privilege('anon', 'public.get_my_activity(timestamptz, uuid, integer)', 'execute')
  and not has_function_privilege('anon', 'public.get_unread_activity_count()', 'execute')
  and not has_function_privilege('anon', 'public.mark_all_activity_read()', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_activity(timestamptz, uuid, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.get_unread_activity_count()', 'execute')
  and has_function_privilege('authenticated', 'public.mark_all_activity_read()', 'execute'),
  'signed-in people can execute the three activity functions and anon can execute none');
select ok(
  not has_function_privilege('anon', 'private.add_activity_event(uuid, uuid, public.activity_kind, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.add_activity_event(uuid, uuid, public.activity_kind, uuid)', 'execute'),
  'private.add_activity_event is not executable by anon or signed-in people');

-- 4. The kinds, in order: the two people events (AC-20) and, from slice 10, names_drawn (no subject, GC-007).
-- WHY three more (slice 12, owner decision Q1 2026-11-24): join_by_reminder, event_reminder and exchange_completed, each with
-- no subject. Tests 390 and 400 prove who gets them.
select is(
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum where enumtypid = 'public.activity_kind'::regtype),
  'member_joined,join_requested,names_drawn,join_by_reminder,event_reminder,exchange_completed',
  'the only event kinds are member_joined, join_requested, names_drawn, join_by_reminder, event_reminder and exchange_completed');

-- 5-6. RLS is on and nobody has a grant, so a direct read or write is refused outright (AC-18, AC-19).
select ok(
  (select relrowsecurity from pg_class where oid = 'public.activity_events'::regclass)
  and not has_table_privilege('anon', 'public.activity_events', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.activity_events', 'select, insert, update, delete'),
  'activity_events has RLS on and no privilege for anon or signed-in people');
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from public.activity_events')
  || '/' || pg_temp.try_as(null, 'select * from public.activity_events')
  || '/' || pg_temp.try_as(pg_temp.u(1), format('insert into public.activity_events (user_id, exchange_id, kind, subject_user_id) values (%L, %L, %L, %L)',
      pg_temp.u(1)::text, current_setting('test.ex_a'), 'member_joined', pg_temp.u(2)::text))
  || '/' || pg_temp.try_as(pg_temp.u(1), 'update public.activity_events set read_at = now()')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'delete from public.activity_events'),
  'err:42501/err:42501/err:42501/err:42501/err:42501',
  'a direct read, insert, update or delete is refused with 42501, not zero rows');

-- 7. No cascade (never-do 8): every foreign key is NO ACTION.
select is(
  (select count(*)::text || '/' || bool_and(confdeltype = 'a')::text
   from pg_constraint where conrelid = 'public.activity_events'::regclass and contype = 'f'),
  '3/true', 'activity_events has three foreign keys and none cascades');

-- 8. The columns are exactly these: one reader and at most one subject, so no event can name a pair (AC-20).
select is(
  (select string_agg(attname, ',' order by attname collate "C") from pg_attribute
   where attrelid = 'public.activity_events'::regclass and attnum > 0 and not attisdropped),
  'created_at,exchange_id,id,kind,read_at,subject_user_id,user_id',
  'an event has one reader and one optional subject and nothing that could name a second person');

-- 9. The check: a people event must have a subject (AC-20).
select is(
  pg_temp.own(format('insert into public.activity_events (user_id, exchange_id, kind) values (%L, %L, %L)',
    pg_temp.u(1)::text, current_setting('test.ex_a'), 'member_joined')),
  'err:23514', 'an event of a people kind without a subject is refused by the check constraint');

-- 10. The fixtures wrote no event (they did not use join_exchange or request_to_join).
select is(
  (select count(*)::int from public.activity_events where exchange_id in
    (select id from public.exchanges where name like 'T200 %')),
  0, 'the setup left no activity events');

-- 11-14. join_exchange writes one member_joined event, for the organiser only (AC-21).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_a')));
end $fx$;
select is(
  (select format('%s/%s/%s/%s/%s/%s', count(*), min(kind::text), (min(user_id::text) = pg_temp.u(1)::text)::text,
     (min(subject_user_id::text) = pg_temp.u(2)::text)::text, (min(exchange_id::text) = current_setting('test.ex_a'))::text,
     bool_and(read_at is null)::text)
   from public.activity_events where exchange_id = current_setting('test.ex_a')::uuid),
  '1/member_joined/true/true/true/true',
  'joining writes one unread member_joined event for the organiser naming the joiner and the exchange');
select is(
  (select count(*)::int from public.activity_events where user_id in (pg_temp.u(2), pg_temp.u(3), pg_temp.u(6))),
  0, 'the joiner and the other members get no event (only the organiser does)');
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_a')));
  perform pg_temp.try_as(pg_temp.u(1), format('select public.join_exchange(%L)', current_setting('test.tok_a')));
end $fx$;
select is(
  (select count(*)::int from public.activity_events where exchange_id = current_setting('test.ex_a')::uuid),
  1, 'joining again, and the organiser joining their own exchange, write no second event');
select is(
  pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_c')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_b')))
  || '/' || pg_temp.try_as(pg_temp.u(3), $$select public.join_exchange('not-a-token')$$)
  || '/' || (select count(*)::text from public.activity_events where exchange_id = current_setting('test.ex_a')::uuid
               or exchange_id = current_setting('test.ex_b')::uuid or exchange_id = current_setting('test.ex_c')::uuid),
  'err:22023/err:22023/err:P0002/1', 'refused joins write no event');

-- 15. A person who left and joins again is a new join: a second event.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(4), format('select public.join_exchange(%L)', current_setting('test.tok_a')));
end $fx$;
select is(
  (select count(*)::int from public.activity_events where exchange_id = current_setting('test.ex_a')::uuid and kind = 'member_joined'),
  2, 'a person who left and joins again writes a new member_joined event');

-- 16-19. request_to_join writes one join_requested event for the organiser, once (AC-21).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_b')));
end $fx$;
select is(
  (select format('%s/%s/%s/%s/%s', count(*), (min(user_id::text) = pg_temp.u(1)::text)::text,
     (min(subject_user_id::text) = pg_temp.u(3)::text)::text, (min(exchange_id::text) = current_setting('test.ex_b'))::text,
     bool_and(read_at is null)::text)
   from public.activity_events where kind = 'join_requested' and exchange_id = current_setting('test.ex_b')::uuid),
  '1/true/true/true/true', 'asking to join writes one unread join_requested event for the organiser naming the asker');
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_b')));
end $fx$;
select is(
  (select count(*)::int from public.activity_events where kind = 'join_requested' and exchange_id = current_setting('test.ex_b')::uuid),
  1, 'asking again (idempotent) writes no second event');
select is(
  pg_temp.try_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_a')))
  || '/' || pg_temp.try_as(pg_temp.u(3), $$select public.request_to_join('not-a-token')$$)
  || '/' || (select count(*)::text from public.activity_events where kind = 'join_requested' and exchange_id = current_setting('test.ex_b')::uuid),
  'err:22023/err:P0002/1', 'a refused ask writes no event');
select is(
  (select count(*)::int from public.activity_events where exchange_id in
    (select id from public.exchanges where name in ('T200 Open', 'T200 Approval', 'T200 Closed')) and user_id <> pg_temp.u(1)),
  0, 'every event on these exchanges is for the organiser');

-- Move the three events apart in time (now() is frozen): Bola 3 hours ago, Dayo 2 hours ago, Chi 1 hour ago.
do $fx$ begin
  update public.activity_events set created_at = now() - interval '3 hours' where subject_user_id = pg_temp.u(2);
  update public.activity_events set created_at = now() - interval '2 hours' where subject_user_id = pg_temp.u(4);
  update public.activity_events set created_at = now() - interval '1 hour' where subject_user_id = pg_temp.u(3);
end $fx$;

-- 20-21. get_my_activity: exact columns (no person ids, no emails, nothing about the draw), then the rows.
select is(
  (select proargnames::text from pg_proc where oid = 'public.get_my_activity(timestamptz, uuid, integer)'::regprocedure),
  '{p_before_at,p_before_id,p_limit,id,kind,exchange_id,exchange_name,exchange_tint,subject_name,created_at,is_unread}',
  'get_my_activity takes a before-time, before-id and limit, and returns names and times only');
select is(
  pg_temp.val_as(pg_temp.u(1), $$(select string_agg(format('%s:%s:%s:%s', kind, exchange_name, subject_name, is_unread::text), '|')
    from public.get_my_activity())$$),
  'join_requested:T200 Approval:Chi:true|member_joined:T200 Open:Dayo:true|member_joined:T200 Open:Bola:true',
  'the organiser sees their events newest first, unread, with the exchange and the person');
select is(
  pg_temp.val_as(pg_temp.u(1), $$(select bool_and(exchange_tint = e.tint) from public.get_my_activity() a join public.exchanges e on e.id = a.exchange_id)$$),
  'true', 'each event carries its exchange tint');

-- 23-26. Own rows only: Eze's event is invisible to Ada, and a person with no events sees none (AC-19).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_x')));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(5), $$(select string_agg(format('%s:%s', exchange_name, subject_name), '|') from public.get_my_activity())$$),
  'T200 Other:Bola', 'Eze sees only the event on their own exchange');
select is(
  pg_temp.val_as(pg_temp.u(1), $$(select count(*) filter (where exchange_name = 'T200 Other') from public.get_my_activity())$$),
  '0', 'Ada does not see Eze''s event');
select is(
  pg_temp.try_as(pg_temp.u(2), 'select * from public.get_my_activity()')
  || '/' || pg_temp.val_as(pg_temp.u(2), 'public.get_unread_activity_count()'),
  'ok:0/0', 'a person with no events sees none and has no unread count');
select ok(
  (select r not like '%@%' and r not like '%b0000000-0000-4000-8000-%' and r not like '%secret%'
   from (select pg_temp.val_as(pg_temp.u(1), $$(select jsonb_agg(to_jsonb(a)) from public.get_my_activity() a)$$) as r) s),
  'the feed carries no email and no person id');

-- 27. A visitor cannot call any of the three (anon has no grant: 42501).
select is(
  pg_temp.try_as(null, 'select * from public.get_my_activity()')
  || '/' || pg_temp.try_as(null, 'select public.get_unread_activity_count()')
  || '/' || pg_temp.try_as(null, 'select public.mark_all_activity_read()'),
  'err:42501/err:42501/err:42501', 'a visitor cannot read, count or mark activity');

-- 28. No function takes a person id: the parameters are a time, an id of an event, and a number (AC-31).
select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('get_my_activity', 'get_unread_activity_count', 'mark_all_activity_read')
     and (p.proargnames::text ~ '(^|[{,])p_(user|person|reader|subject)')),
  0, 'no activity function takes a user id');

-- Paging fixtures: Gus's feed has 60 events in 12 groups of 5 that share one timestamp, so a page boundary
-- falls inside a tie. Written directly as the migration role.
do $fx$ begin
  insert into public.activity_events (user_id, exchange_id, kind, subject_user_id, created_at)
    select pg_temp.u(7), current_setting('test.ex_g')::uuid, 'member_joined', pg_temp.u(2),
           now() - ((i / 5) * interval '1 minute')
    from generate_series(0, 59) i;
end $fx$;

-- 29-33. The limit: 30 by default, below 1 is 1, above 50 is 50, null is 30.
select is(
  pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity()')
  || '/' || pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity(null, null, null)')
  || '/' || pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity(null, null, 0)')
  || '/' || pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity(null, null, -5)')
  || '/' || pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity(null, null, 1000)')
  || '/' || pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity(null, null, 50)')
  || '/' || pg_temp.val_as(pg_temp.u(7), 'select count(*) from public.get_my_activity(null, null, 7)'),
  '30/30/1/1/50/50/7', 'the page size is 30 by default and null, clamped to 1 at the bottom and 50 at the top');
select is(pg_temp.page_all(pg_temp.u(7), 7), '60/60',
  'paging by 7 through groups of 5 equal timestamps returns all 60 events once (no skips, no repeats)');
select is(pg_temp.page_all(pg_temp.u(7), 30), '60/60', 'paging by 30 returns all 60 events once');
select is(pg_temp.page_all(pg_temp.u(7), 1), '60/60', 'paging one at a time returns all 60 events once');
-- WHY a full page and zero rows at that instant (not a count of 55): the page size is capped at 50, so the
-- 55 earlier events fill one page; what this proves is that no event AT the before-time is returned.
select is(
  pg_temp.val_as(pg_temp.u(7), format($$select count(*)::text || '/' || count(*) filter (where created_at >= %L::timestamptz)::text from public.get_my_activity(%L, null, 50)$$,
    (select max(created_at)::text from public.activity_events where user_id = pg_temp.u(7)),
    (select max(created_at)::text from public.activity_events where user_id = pg_temp.u(7)))),
  '50/0', 'a before-time with no before-id pages before every event at that instant');

-- 34-37. The unread count and Mark all as read touch the caller only (AC-23).
select is(
  pg_temp.val_as(pg_temp.u(1), 'public.get_unread_activity_count()') || '/'
  || pg_temp.val_as(pg_temp.u(5), 'public.get_unread_activity_count()') || '/'
  || pg_temp.val_as(pg_temp.u(7), 'public.get_unread_activity_count()'),
  '3/1/60', 'each person''s unread count is their own');
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), 'select public.mark_all_activity_read()');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), 'public.get_unread_activity_count()') || '/'
  || pg_temp.val_as(pg_temp.u(5), 'public.get_unread_activity_count()') || '/'
  || pg_temp.val_as(pg_temp.u(7), 'public.get_unread_activity_count()'),
  '0/1/60', 'Mark all as read clears the caller''s count and nobody else''s');
select is(
  pg_temp.val_as(pg_temp.u(1), $$(select count(*) filter (where is_unread) from public.get_my_activity())$$) || '/'
  || pg_temp.val_as(pg_temp.u(1), $$(select count(*) from public.get_my_activity())$$),
  '0/3', 'the marked events stay in the feed, no longer unread');
-- WHY an old read_at: now() is frozen, so only a value in the past shows whether a second mark moves it.
do $fx$ begin
  update public.activity_events set read_at = '2020-01-01 00:00:00+00' where subject_user_id = pg_temp.u(2) and user_id = pg_temp.u(1);
  perform pg_temp.try_as(pg_temp.u(1), 'select public.mark_all_activity_read()');
end $fx$;
select is(
  (select read_at = '2020-01-01 00:00:00+00' from public.activity_events where subject_user_id = pg_temp.u(2) and user_id = pg_temp.u(1)),
  true, 'marking again keeps the moment an event was first read');

-- 38-39. A new event after marking is unread again, and only for its reader (Hana joins A).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(8), format('select public.join_exchange(%L)', current_setting('test.tok_a')));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), 'public.get_unread_activity_count()') || '/'
  || pg_temp.val_as(pg_temp.u(5), 'public.get_unread_activity_count()'),
  '1/1', 'a new event is unread for its reader only');
select is(
  pg_temp.val_as(pg_temp.u(1), $$(select subject_name || ':' || is_unread::text from public.get_my_activity() limit 1)$$),
  'Hana:true', 'the newest event is the new one');

-- 40-41. Nothing here writes outside the caller: marking read as a person with no events changes no row.
select is(pg_temp.try_as(pg_temp.u(2), 'select public.mark_all_activity_read()'), 'ok:1',
  'a person with no events can call Mark all as read');
select is(
  (select count(*)::int from public.activity_events where read_at is not null and user_id in (pg_temp.u(5), pg_temp.u(7))),
  0, 'Mark all as read changed nobody else''s events');

-- 42-43. Only functions write events: the anon and signed-in refusals above cover the table; the writer is
-- unreachable too, and a made-up kind is refused by the enum.
select is(
  pg_temp.try_as(pg_temp.u(1), format('select private.add_activity_event(%L, %L, %L, %L)',
    pg_temp.u(1)::text, current_setting('test.ex_a'), 'member_joined', pg_temp.u(2)::text)),
  'err:42501', 'a signed-in person cannot call the private writer (no schema usage)');
select is(
  pg_temp.own(format('insert into public.activity_events (user_id, exchange_id, kind, subject_user_id) values (%L, %L, %L, %L)',
    pg_temp.u(1)::text, current_setting('test.ex_a'), 'draw_done', pg_temp.u(2)::text)),
  'err:22P02', 'an event kind outside the enum (such as one about the draw) is refused');

-- 44-45. The indexes the feed and the unread count rely on exist.
select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and tablename = 'activity_events'
     and indexname in ('activity_events_feed_idx', 'activity_events_unread_idx')),
  2, 'the feed and unread indexes exist');
select is(
  (select indexdef like '%(user_id, created_at DESC, id DESC)%' from pg_indexes
     where schemaname = 'public' and indexname = 'activity_events_feed_idx'),
  true, 'the feed index is on (user_id, created_at desc, id desc)');

-- 46-48. Events are never removed by anything here: the exchange rows stay (no cascade), and deleting an
-- exchange that has events is refused rather than cascading.
select is(
  pg_temp.own(format('delete from public.exchanges where id = %L', current_setting('test.ex_a'))),
  'err:23503', 'an exchange with events cannot be deleted (no cascade)');
select is(
  pg_temp.own(format('delete from public.profiles where id = %L', pg_temp.u(2)::text)),
  'err:23503', 'a profile named by events or memberships cannot be deleted (no cascade)');
select is(
  (select count(*)::int from public.activity_events where user_id = pg_temp.u(1)),
  4, 'the deletes removed no events');

-- 49-51. The old function bodies still work: join_exchange still returns the membership id, still refuses
-- approval exchanges and still sets onboarded_at (the event call did not disturb them).
select is(
  (select (current_setting('test.ex_a')::uuid = exchange_id)::text from public.exchange_members
     where user_id = pg_temp.u(8) and state = 'active' limit 1),
  'true', 'Hana''s join created her membership');
select is(
  (select (onboarded_at is not null)::text from public.profiles where id = pg_temp.u(8)),
  'true', 'joining still sets onboarded_at');
select is(
  pg_temp.try_as(pg_temp.u(8), format('select public.join_exchange(%L)', current_setting('test.tok_b'))),
  'err:22023', 'join_exchange still refuses an approval-required exchange');

select * from finish();
rollback;
