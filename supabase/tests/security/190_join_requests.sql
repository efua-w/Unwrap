-- 190_join_requests — slice 6 (GCO-003, GCO-005, GCO-007 before the draw, GC-006, GC-008, GC-009, GC-012, GC-029;
-- plan §3, §5, §6 invariants 8-10; owner decisions 2026-11-14 Q1-Q18).
-- Covers AC-2, 4, 5, 6, 12-21, 26-31, 41, 42: join_requests has RLS and no client grants (a direct read or write is
-- refused with 42501, not zero rows); request_to_join takes a token only and obeys the "who may ask" rules (hints
-- member, cancelled, closed, full, can_join; idempotent 'pending'; 20 an hour per person; sets onboarded_at);
-- the organiser alone reads requests and participants (names and times, no email, no ids of people) and alone
-- approves, declines and removes; approve and decline are final; removal keeps the row and cuts every read;
-- previews and join details gain can_ask (and 'requested'); nothing here writes an event for approve, decline or
-- remove (Q11); no function takes a user id.
-- Self-contained: creates its own users inside the transaction (needs the migrations through join_requests
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T190" because dev holds other data. now() is frozen inside a
-- transaction, so times are moved by update, never relied on.
-- Written BEFORE the join_requests migration: until it is applied the first statement that names the new table
-- or functions fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok N", "1..N" (N is the plan below), no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(97);

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

-- hint_as is try_as for signed-in people that also reports the error hint: 'ok' or 'err:<SQLSTATE>/<hint>'.
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

-- own runs one statement as the migration role: 'ok' or 'err:<SQLSTATE>' (constraint checks).
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

-- pv / jd read one field of the preview / join details as a persona; pn lists the join details' people.
create function pg_temp.pv(who uuid, tok text, path text) returns text
language sql as $$
  select pg_temp.val_as(who, format('public.get_invite_preview(%L)->>%L', tok, path))
$$;
create function pg_temp.jd(who uuid, tok text, path text) returns text
language sql as $$
  select pg_temp.val_as(who, format('public.get_join_details(%L)->>%L', tok, path))
$$;
create function pg_temp.pn(who uuid, tok text) returns text
language sql as $$
  select pg_temp.val_as(who, format($q$coalesce((select string_agg(e->>'name' || ':' || (e->>'is_organiser'), ',')
    from jsonb_array_elements(public.get_join_details(%L)->'people') e), '')$q$, tok))
$$;

-- ask_burst asks n times as one person on one exchange; after each success the organiser's decision is
-- simulated (declined, as the migration role) so the next ask is a new request, not the idempotent answer.
-- Returns 'successes/what the next ask says'.
create function pg_temp.ask_burst(who uuid, tok text, ex uuid, n int) returns text
language plpgsql as $$
declare
  good int := 0;
begin
  for i in 1 .. n loop
    if pg_temp.try_as(who, format('select public.request_to_join(%L)', tok)) like 'ok:%' then
      good := good + 1;
    end if;
    update public.join_requests set status = 'declined', decided_at = now()
      where user_id = who and exchange_id = ex and status = 'pending';
  end loop;
  return good || '/' || pg_temp.try_as(who, format('select public.request_to_join(%L)', tok));
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

-- u(n) is persona n: 1 Ada (organiser of P, A, C, K, F, E), 2 Bola, 3 Chi, 4 Dayo (removed earlier), 5 Eze
-- (member of P), 6 Femi (organiser of X, member of K and E), 7 Gbemi (outsider), 8 Hana (rate limit), 9 Ife.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('19' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u190-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana', 'Ife'])[i]))
  from generate_series(1, 9) i;
  -- 99 more people so F is full at 100 active rows; the auth trigger creates their profiles.
  perform pg_temp.mk_user(('b0000000-0000-4000-8000-1900' || lpad(g::text, 8, '0'))::uuid,
    'bulk190-' || g || '@example.test', '{"first_name":"Bulk"}')
  from generate_series(1, 99) g;
end $fx$;

-- Ada's exchanges, made the way the app makes them. P approval required (the main one), A open without
-- approval, C joining closed (below), K cancelled, F full, E event passed. Femi's own X.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T190 Approval', mode => 'organiser_chooses', approval => 'true'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T190 Open'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T190 Closed', mode => 'organiser_chooses'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T190 Cancelled', mode => 'organiser_chooses', approval => 'true'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T190 Full', mode => 'organiser_chooses', approval => 'true'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T190 Passed', mode => 'organiser_chooses', approval => 'true'));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T190 Other', approval => 'true'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T190 Approval'), true);
  perform set_config('test.ex_a', (select id::text from public.exchanges where name = 'T190 Open'), true);
  perform set_config('test.ex_c', (select id::text from public.exchanges where name = 'T190 Closed'), true);
  perform set_config('test.ex_k', (select id::text from public.exchanges where name = 'T190 Cancelled'), true);
  perform set_config('test.ex_f', (select id::text from public.exchanges where name = 'T190 Full'), true);
  perform set_config('test.ex_e', (select id::text from public.exchanges where name = 'T190 Passed'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T190 Other'), true);
  perform set_config('test.tok_p', (select invite_token from public.exchanges where name = 'T190 Approval'), true);
  perform set_config('test.tok_a', (select invite_token from public.exchanges where name = 'T190 Open'), true);
  perform set_config('test.tok_c', (select invite_token from public.exchanges where name = 'T190 Closed'), true);
  perform set_config('test.tok_k', (select invite_token from public.exchanges where name = 'T190 Cancelled'), true);
  perform set_config('test.tok_f', (select invite_token from public.exchanges where name = 'T190 Full'), true);
  perform set_config('test.tok_e', (select invite_token from public.exchanges where name = 'T190 Passed'), true);
  perform set_config('test.tok_x', (select invite_token from public.exchanges where name = 'T190 Other'), true);
end $fx$;

-- States and members, written as the migration role (so the setup writes no request and no event). now() is
-- frozen, so the moves are by update. C: joining closed an hour ago. K: cancelled. E: the gift day has passed.
do $fx$ begin
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_c')::uuid;
  update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_k')::uuid;
  -- P: Eze is a member. Dayo was removed from P, A and C earlier.
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(5), true, now() - interval '2 days');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    select ex::uuid, pg_temp.u(4), true, 'removed', now() - interval '3 days', now() - interval '1 day'
    from unnest(array[current_setting('test.ex_p'), current_setting('test.ex_a'), current_setting('test.ex_c')]) ex;
  -- K and E: Femi is a member (for the remove refusals).
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select ex::uuid, pg_temp.u(6), true, now() - interval '2 days'
    from unnest(array[current_setting('test.ex_k'), current_setting('test.ex_e')]) ex;
  -- F: the organiser plus 99 people = 100 active rows.
  insert into public.exchange_members (exchange_id, user_id, taking_part)
    select current_setting('test.ex_f')::uuid, ('b0000000-0000-4000-8000-1900' || lpad(g::text, 8, '0'))::uuid, true
    from generate_series(1, 99) g;
  -- Dayo has been through Profile setup already: asking must not move that.
  update public.profiles set onboarded_at = '2020-01-01 00:00:00+00' where id = pg_temp.u(4);
end $fx$;

-- 1. Shape: every function is SECURITY DEFINER with an empty search_path (040 also checks the schemas).
select ok(
  (select count(*) = 8 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('request_to_join', 'get_join_requests', 'approve_join_request', 'decline_join_request',
                       'list_my_join_requests', 'get_participants', 'remove_member', 'get_removed_exchange_name'))
  and (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
       where p.oid = 'private.enforce_rate_limit(text)'::regprocedure),
  'every join-request function, and private.enforce_rate_limit, is SECURITY DEFINER with an empty search_path');

-- 2-3. Grants: anon can execute none of them (030 stays at two functions); signed-in people can execute all eight.
select ok(
  not has_function_privilege('anon', 'public.request_to_join(text)', 'execute')
  and not has_function_privilege('anon', 'public.get_join_requests(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.approve_join_request(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.decline_join_request(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_my_join_requests()', 'execute')
  and not has_function_privilege('anon', 'public.get_participants(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.remove_member(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_removed_exchange_name(uuid)', 'execute'),
  'anon can execute none of the join-request functions');
select ok(
  has_function_privilege('authenticated', 'public.request_to_join(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_join_requests(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.approve_join_request(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.decline_join_request(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.list_my_join_requests()', 'execute')
  and has_function_privilege('authenticated', 'public.get_participants(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.remove_member(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_removed_exchange_name(uuid)', 'execute'),
  'signed-in people can execute the join-request functions');

-- 4. No function takes a user id (plan §6 invariant 8, AC-31): the parameters are a token or an object id.
select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('request_to_join', 'get_join_requests', 'approve_join_request', 'decline_join_request',
                       'list_my_join_requests', 'get_participants', 'remove_member', 'get_removed_exchange_name')
     and (p.proargnames::text ~ '(^|[{,])p_(user|person|requester|asker)')),
  0, 'no join-request function takes a user id');

-- 5-7. The table: RLS on and no grant, so a direct read or write is refused outright (AC-18).
select ok(
  (select relrowsecurity from pg_class where oid = 'public.join_requests'::regclass)
  and not has_table_privilege('anon', 'public.join_requests', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.join_requests', 'select, insert, update, delete'),
  'join_requests has RLS on and no privilege for anon or signed-in people');
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from public.join_requests')
  || '/' || pg_temp.try_as(null, 'select * from public.join_requests')
  || '/' || pg_temp.try_as(pg_temp.u(3), format('insert into public.join_requests (exchange_id, user_id) values (%L, %L)',
      current_setting('test.ex_p'), pg_temp.u(3)::text))
  || '/' || pg_temp.try_as(pg_temp.u(1), 'update public.join_requests set status = ''approved'', decided_at = now()')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'delete from public.join_requests'),
  'err:42501/err:42501/err:42501/err:42501/err:42501',
  'a direct read, insert, update or delete is refused with 42501, not zero rows');
select is(
  (select count(*)::text || '/' || bool_and(confdeltype = 'a')::text
   from pg_constraint where conrelid = 'public.join_requests'::regclass and contype = 'f'),
  '2/true', 'join_requests has two foreign keys and none cascades');
select is(
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum where enumtypid = 'public.join_request_status'::regtype),
  'pending,approved,declined,closed', 'the request statuses are pending, approved, declined and closed');

-- 8-12. Columns and checks: no email or name is stored; the row says when it was decided; one pending row per person
-- per exchange.
select is(
  (select string_agg(attname, ',' order by attname collate "C") from pg_attribute
   where attrelid = 'public.join_requests'::regclass and attnum > 0 and not attisdropped),
  'created_at,decided_at,dismissed_at,exchange_id,id,status,user_id',
  'a request stores the exchange, the person, the status and three times, nothing else');
select is(
  pg_temp.own(format('insert into public.join_requests (exchange_id, user_id, decided_at) values (%L, %L, now())',
    current_setting('test.ex_p'), pg_temp.u(9)::text)),
  'err:23514', 'a pending request with a decision time is refused');
select is(
  pg_temp.own(format('insert into public.join_requests (exchange_id, user_id, status) values (%L, %L, %L)',
    current_setting('test.ex_p'), pg_temp.u(9)::text, 'approved')),
  'err:23514', 'a decided request without a decision time is refused');
select is(
  pg_temp.own(format('insert into public.join_requests (exchange_id, user_id, dismissed_at) values (%L, %L, now())',
    current_setting('test.ex_p'), pg_temp.u(9)::text)),
  'err:23514', 'a pending request cannot be dismissed');
select is(
  pg_temp.own(format('insert into public.join_requests (exchange_id, user_id) values (%L, %L), (%L, %L)',
    current_setting('test.ex_p'), pg_temp.u(9)::text, current_setting('test.ex_p'), pg_temp.u(9)::text)),
  'err:23505', 'two pending requests from one person for one exchange are refused');

-- 13-15. request_to_join: a visitor cannot; bad tokens are all "not found" and write nothing (AC-5).
select is(pg_temp.try_as(null, format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'err:42501', 'a visitor cannot ask to join');
select is(
  pg_temp.try_as(pg_temp.u(2), 'select public.request_to_join(null)')
  || '/' || pg_temp.try_as(pg_temp.u(2), $$select public.request_to_join('')$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.request_to_join(%L)', upper(current_setting('test.tok_p'))))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.request_to_join(%L)', left(current_setting('test.tok_p'), 31)))
  || '/' || pg_temp.try_as(pg_temp.u(2), $$select public.request_to_join('x'' or 1=1 --')$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), $$select public.request_to_join('ffffffffffffffffffffffffffffffff')$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.request_to_join(%L)', current_setting('test.ex_p'))),
  'err:P0002/err:P0002/err:P0002/err:P0002/err:P0002/err:P0002/err:P0002',
  'a null, empty, uppercase, short, injected or unknown token, and an exchange id used as a token, are all "not found"');
select is(
  (select count(*)::int from public.join_requests where exchange_id in (select id from public.exchanges where name like 'T190 %'))
  + (select count(*)::int from public.activity_events where exchange_id in (select id from public.exchanges where name like 'T190 %')),
  0, 'those refusals wrote no request and no event');

-- 16-19. A person asks to join an approval exchange (AC-6): one pending row, the answer is 'pending', onboarded_at
-- is set for the asker only (Q10), and asking again is idempotent.
select is(pg_temp.val_as(pg_temp.u(2), format('public.request_to_join(%L)', current_setting('test.tok_p'))),
  'pending', 'an outsider can ask to join an approval-required exchange and is told it is pending');
select is(
  (select format('%s/%s/%s/%s', count(*), min(status::text), bool_and(decided_at is null)::text, bool_and(dismissed_at is null)::text)
   from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2)),
  '1/pending/true/true', 'asking adds exactly one pending request');
select is(
  pg_temp.val_as(pg_temp.u(2), format('public.request_to_join(%L)', current_setting('test.tok_p')))
  || '/' || (select count(*) from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2))
  || '/' || (select count(*) from public.activity_events where exchange_id = current_setting('test.ex_p')::uuid),
  'pending/1/1', 'asking again is idempotent: still one request, still one event');
select is(
  (select format('%s/%s',
     (select onboarded_at is not null from public.profiles where id = pg_temp.u(2))::text,
     (select onboarded_at is null from public.profiles where id = pg_temp.u(3))::text)),
  'true/true', 'asking sets onboarded_at for the asker and for nobody else');

-- 20-25. The refusals, each with its reason as the hint (AC-2, AC-4). Nothing is written.
select is(
  pg_temp.hint_as(pg_temp.u(1), format('select public.request_to_join(%L)', current_setting('test.tok_p')))
  || '/' || pg_temp.hint_as(pg_temp.u(5), format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'err:22023/member/err:22023/member', 'the organiser and a member are told they are already in (hint member)');
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_k'))),
  'err:22023/cancelled', 'a cancelled exchange takes no requests');
update public.exchanges set join_by_at = now() - interval '3 days',
  gift_day = (now() at time zone 'Africa/Lagos')::date - 1
  where id = current_setting('test.ex_e')::uuid;
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_e'))),
  'err:22023/closed', 'once the gift day has passed no one can ask');
update public.exchanges set completed_at = now() where id = current_setting('test.ex_e')::uuid;
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_e'))),
  'err:22023/closed', 'a complete exchange takes no requests');
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_f'))),
  'err:22023/full', 'a full exchange (100 active rows) takes no requests');
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_a'))),
  'err:22023/can_join', 'an open exchange that does not need approval says to join instead (hint can_join)');

-- 26-27. Those refusals wrote nothing and set no onboarded_at; join_exchange still refuses and creates no request.
select is(
  pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_p')))
  || '/' || (select count(*) from public.join_requests where user_id = pg_temp.u(3))
  || '/' || (select count(*) from public.activity_events where subject_user_id = pg_temp.u(3))
  || '/' || (select (onboarded_at is null)::text from public.profiles where id = pg_temp.u(3)),
  'err:22023/approval/0/0/true', 'refused asks wrote nothing, and join_exchange still refuses an approval exchange without creating a request');
select is(
  pg_temp.hint_as(pg_temp.u(4), format('select public.join_exchange(%L)', current_setting('test.tok_a')))
  || '/' || pg_temp.hint_as(pg_temp.u(4), format('select public.join_exchange(%L)', current_setting('test.tok_p'))),
  'err:22023/removed/err:22023/removed', 'a removed person still cannot join directly (AC-2)');

-- 28-31. A removed person may ask, on an open exchange and after join-by; after join-by anyone may ask; the asker's
-- earlier onboarded_at is kept.
select is(pg_temp.val_as(pg_temp.u(4), format('public.request_to_join(%L)', current_setting('test.tok_a'))),
  'pending', 'a removed person can ask to join an open exchange');
select is(pg_temp.val_as(pg_temp.u(4), format('public.request_to_join(%L)', current_setting('test.tok_c'))),
  'pending', 'a removed person can ask after join-by');
select is(pg_temp.val_as(pg_temp.u(3), format('public.request_to_join(%L)', current_setting('test.tok_c'))),
  'pending', 'anyone can ask after join-by until the draw (joining closed)');
select is(
  (select (onboarded_at = '2020-01-01 00:00:00+00')::text || '/' || (select (onboarded_at is not null)::text from public.profiles where id = pg_temp.u(3))
   from public.profiles where id = pg_temp.u(4)),
  'true/true', 'asking never moves an earlier onboarded_at and sets it for a person who has none');

-- Chi asks P too. Move the requests apart in time (now() is frozen): Bola P 3 hours ago, Chi P 2 hours ago, Chi C 1 hour ago.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_p')));
  update public.join_requests set created_at = now() - interval '3 hours' where user_id = pg_temp.u(2) and exchange_id = current_setting('test.ex_p')::uuid;
  update public.join_requests set created_at = now() - interval '2 hours' where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid;
  update public.join_requests set created_at = now() - interval '1 hour' where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_c')::uuid;
  perform set_config('test.rq_bola_p', (select id::text from public.join_requests where user_id = pg_temp.u(2) and exchange_id = current_setting('test.ex_p')::uuid), true);
  perform set_config('test.rq_chi_p', (select id::text from public.join_requests where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid), true);
  perform set_config('test.rq_chi_c', (select id::text from public.join_requests where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_c')::uuid), true);
  perform set_config('test.rq_dayo_a', (select id::text from public.join_requests where user_id = pg_temp.u(4) and exchange_id = current_setting('test.ex_a')::uuid), true);
end $fx$;

-- 32-35. get_join_requests: names and times only, pending, oldest first, for the organiser only (AC-12, AC-42).
select is(
  (select proargnames::text from pg_proc where oid = 'public.get_join_requests(uuid)'::regprocedure),
  '{p_exchange,request_id,display_name,requested_at}', 'get_join_requests returns the request id, a name and a time only');
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name, '|' order by requested_at) from public.get_join_requests(%L))$$, current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name, '|') from public.get_join_requests(%L))$$, current_setting('test.ex_a')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name, '|' order by requested_at) from public.get_join_requests(%L))$$, current_setting('test.ex_c'))),
  'Bola|Chi/Dayo/Chi|Dayo', 'the organiser sees each exchange''s pending requests by name, oldest first');
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name, '|') from public.get_join_requests(%L))$$, current_setting('test.ex_p'))),
  'Bola|Chi', 'the order of the list is oldest request first');
select ok(
  (select r not like '%@%' and r not like '%b0000000-0000-4000-8000-%' and r not like '%onboarded%'
   from (select pg_temp.val_as(pg_temp.u(1), format($$(select jsonb_agg(to_jsonb(g)) from public.get_join_requests(%L) g)$$, current_setting('test.ex_p'))) as r) s),
  'the request list carries no email and no person id (AC-41)');
select is(
  pg_temp.try_as(pg_temp.u(5), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.get_join_requests(%L)', current_setting('test.ex_p'))),
  'ok:0/ok:0/ok:0/ok:0/err:42501',
  'a member, another exchange''s organiser, an outsider and the asker see no requests; a visitor is refused');

-- 37-38. list_my_join_requests: the asker's own pending rows, newest first, names only.
select is(
  (select proargnames::text from pg_proc where oid = 'public.list_my_join_requests()'::regprocedure),
  '{request_id,exchange_name,exchange_tint,organiser_name,status,requested_at}',
  'list_my_join_requests returns the exchange name and tint, the organiser''s name, the status and a time only');
select is(
  pg_temp.val_as(pg_temp.u(3), $$(select string_agg(format('%s:%s:%s', exchange_name, organiser_name, status::text), '|') from public.list_my_join_requests())$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select * from public.list_my_join_requests()')
  || '/' || pg_temp.try_as(pg_temp.u(7), 'select * from public.list_my_join_requests()')
  || '/' || pg_temp.try_as(null, 'select * from public.list_my_join_requests()'),
  'T190 Closed:Ada:pending|T190 Approval:Ada:pending/ok:0/ok:0/err:42501',
  'an asker sees their own pending requests newest first; nobody else sees them; a visitor is refused');

-- 39-48. The preview and join details gain can_ask; the join details gain 'requested' (AC-26, AC-27).
select is(
  pg_temp.pv(null, current_setting('test.tok_p'), 'can_ask') || '/' || pg_temp.pv(null, current_setting('test.tok_a'), 'can_ask')
  || '/' || pg_temp.pv(null, current_setting('test.tok_c'), 'can_ask') || '/' || pg_temp.pv(null, current_setting('test.tok_k'), 'can_ask')
  || '/' || pg_temp.pv(null, current_setting('test.tok_e'), 'can_ask') || '/' || pg_temp.pv(null, current_setting('test.tok_f'), 'can_ask'),
  'true/false/true/false/false/false',
  'the preview offers asking for an open approval exchange and after join-by, never otherwise (full, cancelled, passed, complete, or plain open)');
select is(
  pg_temp.pv(null, current_setting('test.tok_p'), 'status') || '/' || pg_temp.pv(null, current_setting('test.tok_c'), 'status'),
  'approval/closed', 'the preview statuses are unchanged: an approval exchange is approval, joining closed is closed');
select is(
  pg_temp.jd(pg_temp.u(3), current_setting('test.tok_p'), 'viewer') || '/'
  || coalesce(pg_temp.jd(pg_temp.u(3), current_setting('test.tok_p'), 'exchange_id'), 'none') || '/'
  || pg_temp.val_as(pg_temp.u(3), format('jsonb_array_length(public.get_join_details(%L)->''people'')', current_setting('test.tok_p')))
  || '/' || pg_temp.jd(pg_temp.u(3), current_setting('test.tok_p'), 'can_ask'),
  'requested/none/0/true', 'a person with a pending request is "requested", gets no exchange id and sees no names');
select is(
  pg_temp.jd(pg_temp.u(7), current_setting('test.tok_p'), 'viewer') || '/' || pg_temp.jd(pg_temp.u(7), current_setting('test.tok_p'), 'can_ask')
  || '/' || pg_temp.pn(pg_temp.u(7), current_setting('test.tok_p')),
  'can_join/true/Ada:true,Eze:false', 'an outsider on an approval exchange can ask and sees the names (GC-009), and another person''s request does not change that');
select is(
  pg_temp.jd(pg_temp.u(7), current_setting('test.tok_a'), 'can_ask') || '/' || pg_temp.pn(pg_temp.u(7), current_setting('test.tok_a')),
  'false/Ada:true', 'an outsider on a plain open exchange is told to join, not ask, and sees its names');
select is(
  pg_temp.jd(pg_temp.u(7), current_setting('test.tok_c'), 'status') || '/' || pg_temp.jd(pg_temp.u(7), current_setting('test.tok_c'), 'can_ask')
  || '/' || pg_temp.val_as(pg_temp.u(7), format('jsonb_array_length(public.get_join_details(%L)->''people'')', current_setting('test.tok_c'))),
  'closed/true/0', 'after join-by an outsider can ask and sees no names');
select is(
  pg_temp.jd(pg_temp.u(7), current_setting('test.tok_k'), 'can_ask') || '/' || pg_temp.jd(pg_temp.u(7), current_setting('test.tok_e'), 'can_ask')
  || '/' || pg_temp.jd(pg_temp.u(7), current_setting('test.tok_f'), 'can_ask'),
  'false/false/false', 'cancelled, complete and full exchanges offer no asking');
select is(
  pg_temp.jd(pg_temp.u(5), current_setting('test.tok_p'), 'viewer') || '/' || pg_temp.jd(pg_temp.u(5), current_setting('test.tok_p'), 'can_ask'),
  'member/false', 'a member is a member and cannot ask');
select is(
  pg_temp.val_as(pg_temp.u(4), format($$(select jsonb_build_object('v', public.get_join_details(%L)->>'viewer', 'a', public.get_join_details(%L)->>'can_ask',
     'n', jsonb_array_length(public.get_join_details(%L)->'people'), 'x', public.get_join_details(%L)->'exchange_id'))$$,
     current_setting('test.tok_a'), current_setting('test.tok_a'), current_setting('test.tok_a'), current_setting('test.tok_a'))),
  '{"a": "true", "n": 0, "v": "requested", "x": null}',
  'a removed person who has asked is "requested", sees no names and gets no exchange id');
do $fx$ begin
  update public.join_requests set status = 'declined', decided_at = now() where id = current_setting('test.rq_dayo_a')::uuid;
end $fx$;
select is(
  pg_temp.jd(pg_temp.u(4), current_setting('test.tok_a'), 'viewer') || '/' || pg_temp.jd(pg_temp.u(4), current_setting('test.tok_a'), 'can_ask')
  || '/' || pg_temp.val_as(pg_temp.u(4), format('jsonb_array_length(public.get_join_details(%L)->''people'')', current_setting('test.tok_a')))
  || '/' || coalesce(pg_temp.jd(pg_temp.u(4), current_setting('test.tok_a'), 'exchange_id'), 'none'),
  'removed/true/0/none', 'a removed person on an open exchange can ask, still sees no names and gets no exchange id');

-- Direct pending rows for the approve and decline guards (asking is refused for these exchanges). Written as the
-- migration role, before the decisions below. Eze is already a member of P; Gbemi is outsider to K, F, E.
do $fx$ begin
  insert into public.join_requests (exchange_id, user_id)
    values (current_setting('test.ex_k')::uuid, pg_temp.u(7)),
           (current_setting('test.ex_f')::uuid, pg_temp.u(7)),
           (current_setting('test.ex_e')::uuid, pg_temp.u(7)),
           (current_setting('test.ex_p')::uuid, pg_temp.u(5));
  perform set_config('test.rq_gbemi_k', (select id::text from public.join_requests where user_id = pg_temp.u(7) and exchange_id = current_setting('test.ex_k')::uuid), true);
  perform set_config('test.rq_gbemi_f', (select id::text from public.join_requests where user_id = pg_temp.u(7) and exchange_id = current_setting('test.ex_f')::uuid), true);
  perform set_config('test.rq_gbemi_e', (select id::text from public.join_requests where user_id = pg_temp.u(7) and exchange_id = current_setting('test.ex_e')::uuid), true);
  perform set_config('test.rq_eze_p', (select id::text from public.join_requests where user_id = pg_temp.u(5) and exchange_id = current_setting('test.ex_p')::uuid), true);
end $fx$;

-- 49-51. Approve and decline: only the organiser. One answer (P0002) for everyone else, an unknown id and null.
select is(
  pg_temp.try_as(pg_temp.u(5), format('select public.approve_join_request(%L)', current_setting('test.rq_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select public.approve_join_request(%L)', current_setting('test.rq_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.approve_join_request(%L)', current_setting('test.rq_chi_p')))
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select public.approve_join_request('c0000000-0000-4000-8000-0000000019ff')$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select public.approve_join_request(null)')
  || '/' || pg_temp.try_as(null, format('select public.approve_join_request(%L)', current_setting('test.rq_bola_p'))),
  'err:P0002/err:P0002/err:P0002/err:P0002/err:P0002/err:42501',
  'a member, another organiser, the asker, an unknown id and null cannot approve; a visitor is refused');
select is(
  pg_temp.try_as(pg_temp.u(5), format('select public.decline_join_request(%L)', current_setting('test.rq_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select public.decline_join_request(%L)', current_setting('test.rq_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.decline_join_request(%L)', current_setting('test.rq_chi_p')))
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select public.decline_join_request('c0000000-0000-4000-8000-0000000019ff')$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select public.decline_join_request(null)')
  || '/' || pg_temp.try_as(null, format('select public.decline_join_request(%L)', current_setting('test.rq_bola_p'))),
  'err:P0002/err:P0002/err:P0002/err:P0002/err:P0002/err:42501',
  'a member, another organiser, the asker, an unknown id and null cannot decline; a visitor is refused');
select is(
  (select count(*) from public.join_requests where id in (current_setting('test.rq_bola_p')::uuid, current_setting('test.rq_chi_p')::uuid) and status = 'pending')::text
  || '/' || (select count(*) from public.exchange_members where user_id in (pg_temp.u(2), pg_temp.u(3)) and exchange_id = current_setting('test.ex_p')::uuid),
  '2/0', 'those refusals changed nothing');

select is(pg_temp.try_as(pg_temp.u(1), format('select public.decline_join_request(%L)', current_setting('test.rq_chi_p'))),
  'ok:1', 'the organiser can decline a request');
select is(
  (select format('%s/%s/%s', status, (decided_at is not null)::text, (select count(*) from public.exchange_members where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid))
   from public.join_requests where id = current_setting('test.rq_chi_p')::uuid),
  'declined/true/0', 'declining records the decision and adds nobody');
select is(
  pg_temp.val_as(pg_temp.u(3), $$(select string_agg(exchange_name, '|') from public.list_my_join_requests())$$),
  'T190 Closed', 'a declined request disappears from the asker''s list');
select is(
  pg_temp.hint_as(pg_temp.u(1), format('select public.decline_join_request(%L)', current_setting('test.rq_chi_p')))
  || '/' || pg_temp.hint_as(pg_temp.u(1), format('select public.approve_join_request(%L)', current_setting('test.rq_chi_p'))),
  'err:22023/decided/err:22023/decided', 'a decided request cannot be declined or approved again');

-- 56. After a decline the person can ask again: a new pending row beside the declined one (Q8).
-- WHY the call is its own statement: a read in the same statement uses a snapshot from before the call.
do $fx$ begin
  perform set_config('test.ask_again', pg_temp.val_as(pg_temp.u(3), format('public.request_to_join(%L)', current_setting('test.tok_p'))), true);
end $fx$;
select is(
  current_setting('test.ask_again')
  || '/' || (select count(*) filter (where status = 'pending') || ':' || count(*) filter (where status = 'declined')
             from public.join_requests where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid),
  'pending/1:1', 'after a decline the person can ask again');

-- 57-60. Approve: the person becomes an active, taking-part member; the membership id is returned; no event (Q11).
do $fx$ begin
  perform set_config('test.mem_bola', pg_temp.val_as(pg_temp.u(1), format('public.approve_join_request(%L)', current_setting('test.rq_bola_p'))), true);
end $fx$;
select is(
  current_setting('test.mem_bola'),
  (select id::text from public.exchange_members where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2) and state = 'active'),
  'approving returns the new membership id');
select is(
  (select format('%s/%s/%s', count(*), bool_and(taking_part)::text, bool_and(state = 'active')::text)
   from public.exchange_members where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2)),
  '1/true/true', 'the approved person is one active member taking part');
select is(
  (select format('%s/%s', status, (decided_at is not null)::text) from public.join_requests where id = current_setting('test.rq_bola_p')::uuid),
  'approved/true', 'the request is marked approved with a decision time');
select is(
  pg_temp.jd(pg_temp.u(2), current_setting('test.tok_p'), 'viewer') || '/' || pg_temp.jd(pg_temp.u(2), current_setting('test.tok_p'), 'exchange_id'),
  'member/' || current_setting('test.ex_p'), 'the approved person is now a member and gets the exchange id');

-- 61-63. Approve guards: already active counts as approved; cancelled, full and closed are refused; a request
-- after join-by can be approved; a removed person's request creates a new active row (the removed row stays).
do $fx$ begin
  perform set_config('test.approve_eze', pg_temp.val_as(pg_temp.u(1), format('public.approve_join_request(%L)', current_setting('test.rq_eze_p'))), true);
end $fx$;
select is(
  current_setting('test.approve_eze')
  || '/' || (select count(*) from public.exchange_members where user_id = pg_temp.u(5) and exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || (select status from public.join_requests where id = current_setting('test.rq_eze_p')::uuid),
  (select id::text from public.exchange_members where user_id = pg_temp.u(5) and exchange_id = current_setting('test.ex_p')::uuid) || '/1/approved',
  'approving a request from someone already in returns their membership and adds no second row');
select is(
  pg_temp.hint_as(pg_temp.u(1), format('select public.approve_join_request(%L)', current_setting('test.rq_gbemi_k')))
  || '/' || pg_temp.hint_as(pg_temp.u(1), format('select public.approve_join_request(%L)', current_setting('test.rq_gbemi_f')))
  || '/' || pg_temp.hint_as(pg_temp.u(1), format('select public.approve_join_request(%L)', current_setting('test.rq_gbemi_e'))),
  'err:22023/cancelled/err:22023/full/err:22023/closed', 'a request cannot be approved when the exchange is cancelled, full or over');
select is(
  (select count(*) from public.exchange_members where user_id = pg_temp.u(7))::text
  || '/' || (select count(*) from public.join_requests where user_id = pg_temp.u(7) and status = 'pending'),
  '0/3', 'those refusals added nobody and left the requests pending');
-- Dayo's request on A was declined above (the 'requested' tests); ask again so there is something to approve.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(4), format('select public.request_to_join(%L)', current_setting('test.tok_a')));
  perform set_config('test.rq_dayo_a2', (select id::text from public.join_requests where user_id = pg_temp.u(4) and exchange_id = current_setting('test.ex_a')::uuid and status = 'pending'), true);
  perform pg_temp.try_as(pg_temp.u(1), format('select public.approve_join_request(%L)', current_setting('test.rq_dayo_a2')));
  perform pg_temp.try_as(pg_temp.u(1), format('select public.approve_join_request(%L)', current_setting('test.rq_chi_c')));
end $fx$;
select is(
  (select format('%s/%s', count(*), count(*) filter (where state = 'active'))
   from public.exchange_members where user_id = pg_temp.u(4) and exchange_id = current_setting('test.ex_a')::uuid)
  || '/' || (select count(*) filter (where state = 'active') from public.exchange_members where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_c')::uuid),
  '2/1/1', 'a removed person''s approved request adds a new active row beside the removed one, and a request after join-by can be approved');

-- 64-65. Decline works on a cancelled exchange (it only closes the request); approve and decline wrote no event (Q11).
select is(pg_temp.try_as(pg_temp.u(1), format('select public.decline_join_request(%L)', current_setting('test.rq_gbemi_k'))),
  'ok:1', 'a request on a cancelled exchange can still be declined');
select is(
  (select count(*)::int from public.activity_events where exchange_id in (select id from public.exchanges where name like 'T190 %') and kind = 'member_joined'),
  0, 'approving and declining wrote no member_joined event');

-- 66-67. The requester's list now: Chi's two requests are decided or pending as expected.
select is(
  pg_temp.val_as(pg_temp.u(3), $$(select string_agg(exchange_name, '|') from public.list_my_join_requests())$$),
  'T190 Approval', 'the asker''s list holds only pending requests (the one on Closed was approved)');
select is(
  (select count(*) from public.join_requests where user_id = pg_temp.u(2) and status <> 'pending')::text || '/'
  || pg_temp.val_as(pg_temp.u(2), $$(select count(*) from public.list_my_join_requests())$$),
  '1/0', 'an approved request is no longer in the asker''s list');

-- 68-71. get_participants: the organiser's list of active members (S30), names and flags only (AC-12, AC-17).
select is(
  (select proargnames::text from pg_proc where oid = 'public.get_participants(uuid)'::regprocedure),
  '{p_exchange,member_id,display_name,is_me,is_organiser,taking_part}',
  'get_participants returns a member id, a name and flags only (no email, avatar or list status)');
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(format('%%s:%%s:%%s:%%s', display_name, is_organiser::text, is_me::text, taking_part::text), '|')
    from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:true:true:true|Eze:false:false:true|Bola:false:false:true',
  'the organiser sees the active members, organiser first, then in join order (not the removed person)');
select is(
  pg_temp.try_as(pg_temp.u(5), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(4), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.get_participants(%L)', current_setting('test.ex_p'))),
  'ok:0/ok:0/ok:0/ok:0/ok:0/err:42501',
  'a member, a removed person, an outsider and another organiser see no participants; a visitor is refused');
select ok(
  (select r not like '%@%' and r not like '%user_id%' and r not like '%b0000000-0000-4000-8000-%'
   from (select pg_temp.val_as(pg_temp.u(1), format($$(select jsonb_agg(to_jsonb(g)) from public.get_participants(%L) g)$$, current_setting('test.ex_p'))) as r) s),
  'the participant list carries no email and no person id (AC-41)');

-- 72-76. remove_member: organiser only; never the organiser's own row; not an inactive row; not after the event.
do $fx$ begin
  perform set_config('test.m_ada_p', (select id::text from public.exchange_members where user_id = pg_temp.u(1) and exchange_id = current_setting('test.ex_p')::uuid), true);
  perform set_config('test.m_eze_p', (select id::text from public.exchange_members where user_id = pg_temp.u(5) and exchange_id = current_setting('test.ex_p')::uuid), true);
  perform set_config('test.m_bola_p', (select id::text from public.exchange_members where user_id = pg_temp.u(2) and exchange_id = current_setting('test.ex_p')::uuid), true);
  perform set_config('test.m_dayo_p', (select id::text from public.exchange_members where user_id = pg_temp.u(4) and exchange_id = current_setting('test.ex_p')::uuid), true);
  perform set_config('test.m_femi_k', (select id::text from public.exchange_members where user_id = pg_temp.u(6) and exchange_id = current_setting('test.ex_k')::uuid), true);
  perform set_config('test.m_femi_e', (select id::text from public.exchange_members where user_id = pg_temp.u(6) and exchange_id = current_setting('test.ex_e')::uuid), true);
  perform set_config('test.m_chi_c', (select id::text from public.exchange_members where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_c')::uuid), true);
end $fx$;
select is(
  pg_temp.try_as(pg_temp.u(5), format('select public.remove_member(%L)', current_setting('test.m_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select public.remove_member(%L)', current_setting('test.m_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select public.remove_member(%L)', current_setting('test.m_bola_p')))
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select public.remove_member('c0000000-0000-4000-8000-0000000019ff')$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select public.remove_member(null)')
  || '/' || pg_temp.try_as(null, format('select public.remove_member(%L)', current_setting('test.m_bola_p'))),
  'err:P0002/err:P0002/err:P0002/err:P0002/err:P0002/err:42501',
  'a member, another organiser, the person themselves, an unknown id and null cannot remove; a visitor is refused');
select is(pg_temp.hint_as(pg_temp.u(1), format('select public.remove_member(%L)', current_setting('test.m_ada_p'))),
  'err:22023/organiser', 'the organiser''s own row can never be removed');
select is(pg_temp.hint_as(pg_temp.u(1), format('select public.remove_member(%L)', current_setting('test.m_dayo_p'))),
  'err:22023/inactive', 'a membership that already ended cannot be removed again');
select is(
  pg_temp.hint_as(pg_temp.u(1), format('select public.remove_member(%L)', current_setting('test.m_femi_k')))
  || '/' || pg_temp.hint_as(pg_temp.u(1), format('select public.remove_member(%L)', current_setting('test.m_femi_e'))),
  'err:22023/cancelled/err:22023/closed', 'nobody is removed from a cancelled exchange or after the event');
select is(
  (select count(*) from public.exchange_members where id in (current_setting('test.m_femi_k')::uuid, current_setting('test.m_femi_e')::uuid, current_setting('test.m_bola_p')::uuid) and state = 'active')::text,
  '3', 'those refusals removed nobody');

-- 77-84. Removal keeps the row and cuts every read (AC-15, AC-16).
select is(pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)', current_setting('test.m_eze_p'))),
  'ok:1', 'the organiser can remove a member before the draw');
select is(
  (select format('%s/%s/%s', count(*), min(state::text), bool_and(left_at is not null)::text)
   from public.exchange_members where user_id = pg_temp.u(5) and exchange_id = current_setting('test.ex_p')::uuid),
  '1/removed/true', 'the membership row is kept, marked removed with a leaving time');
select is(
  pg_temp.jd(pg_temp.u(5), current_setting('test.tok_p'), 'viewer') || '/'
  || coalesce(pg_temp.jd(pg_temp.u(5), current_setting('test.tok_p'), 'exchange_id'), 'none') || '/'
  || pg_temp.val_as(pg_temp.u(5), format('jsonb_array_length(public.get_join_details(%L)->''people'')', current_setting('test.tok_p')))
  || '/' || pg_temp.jd(pg_temp.u(5), current_setting('test.tok_p'), 'can_ask'),
  'removed/none/0/true', 'the removed person sees no names and no exchange id, and can ask again');
select is(
  pg_temp.try_as(pg_temp.u(5), format('select * from public.get_exchange_people(%L)', current_setting('test.ex_p')))
  || '/' || coalesce(pg_temp.val_as(pg_temp.u(5), format('public.exchange_state(%L)', current_setting('test.ex_p'))), 'null')
  || '/' || pg_temp.val_as(pg_temp.u(5), format('public.is_member(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select * from public.get_participants(%L)', current_setting('test.ex_p'))),
  'ok:0/null/false/ok:0', 'the removed person can no longer read the people, the state or anything of the exchange');
select is(
  pg_temp.val_as(pg_temp.u(5), format('public.get_removed_exchange_name(%L)', current_setting('test.ex_p')))
  || '/' || coalesce(pg_temp.val_as(pg_temp.u(2), format('public.get_removed_exchange_name(%L)', current_setting('test.ex_p'))), 'null')
  || '/' || coalesce(pg_temp.val_as(pg_temp.u(7), format('public.get_removed_exchange_name(%L)', current_setting('test.ex_p'))), 'null')
  || '/' || coalesce(pg_temp.val_as(pg_temp.u(1), format('public.get_removed_exchange_name(%L)', current_setting('test.ex_p'))), 'null')
  || '/' || coalesce(pg_temp.val_as(pg_temp.u(4), format('public.get_removed_exchange_name(%L)', current_setting('test.ex_a'))), 'null'),
  'T190 Approval/null/null/null/null',
  'only the removed person learns the exchange name (a member, an outsider, the organiser, and someone who is back in get nothing)');
select is(
  pg_temp.try_as(null, format('select public.get_removed_exchange_name(%L)', current_setting('test.ex_p'))),
  'err:42501', 'a visitor cannot call get_removed_exchange_name');
select is(
  pg_temp.hint_as(pg_temp.u(5), format('select public.join_exchange(%L)', current_setting('test.tok_p')))
  || '/' || pg_temp.val_as(pg_temp.u(5), format('public.request_to_join(%L)', current_setting('test.tok_p'))),
  'err:22023/removed/pending', 'the removed person cannot join directly but can ask (AC-2)');
select is(pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)', current_setting('test.m_chi_c'))),
  'ok:1', 'a member can also be removed after join-by, before the draw');

-- 85. Removal and the others: Bola is untouched; no event came from approve, decline or remove (Q11): the events on
-- these exchanges are exactly the asks (Bola P, Dayo A, Dayo C, Chi C, Chi P twice, Dayo A again, Eze P) = 8.
select is(
  (select count(*) from public.exchange_members where user_id = pg_temp.u(2) and exchange_id = current_setting('test.ex_p')::uuid and state = 'active')::text
  || '/' || (select count(*) filter (where kind = 'join_requested') || ':' || count(*) filter (where kind = 'member_joined')
             from public.activity_events where exchange_id in (select id from public.exchanges where name like 'T190 %')),
  '1/8:0', 'removing one person leaves the others, and approve, decline and remove wrote no event');

-- 86-92. The rate limit (Q9, AC-29): 20 an hour per person. Refused asks do not count, a refused ask is rolled back,
-- another person is unaffected, the window resets, and an idempotent ask is not a hit.
select is(
  pg_temp.hint_as(pg_temp.u(8), format('select public.request_to_join(%L)', current_setting('test.tok_k')))
  || '/' || pg_temp.hint_as(pg_temp.u(8), format('select public.request_to_join(%L)', current_setting('test.tok_a')))
  || '/' || (select count(*) from private.rate_limits where key = 'request_to_join:' || pg_temp.u(8)::text),
  'err:22023/cancelled/err:22023/can_join/0', 'refused asks do not count against the limit');
select is(pg_temp.ask_burst(pg_temp.u(8), current_setting('test.tok_p'), current_setting('test.ex_p')::uuid, 20),
  '20/err:P0429', 'twenty asks in an hour are allowed and the twenty-first is refused with P0429');
select is(
  (select hits::text from private.rate_limits where key = 'request_to_join:' || pg_temp.u(8)::text)
  || '/' || (select count(*) from public.join_requests where user_id = pg_temp.u(8))
  || '/' || (select count(*) from public.activity_events where subject_user_id = pg_temp.u(8)),
  '20/20/20', 'the refused ask rolled back with its count: no request and no event for the 21st');
select is(pg_temp.try_as(pg_temp.u(9), format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'ok:1', 'one person''s limit does not stop another person');
select is(
  pg_temp.val_as(pg_temp.u(9), format('public.request_to_join(%L)', current_setting('test.tok_p')))
  || '/' || (select hits::text from private.rate_limits where key = 'request_to_join:' || pg_temp.u(9)::text),
  'pending/1', 'asking again (idempotent) is not counted');
do $fx$ begin
  update private.rate_limits set window_start = now() - interval '2 hours' where key = 'request_to_join:' || pg_temp.u(8)::text;
end $fx$;
select is(pg_temp.try_as(pg_temp.u(8), format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'ok:1', 'after the hour the limit resets and the person can ask again');
-- WHY clear the claims: try_as sets them with `set local`, which outlives its role switch, so the owner would otherwise
-- still look like the last persona to auth.uid().
do $fx$ begin perform set_config('request.jwt.claims', '', true); end $fx$;
select is(
  pg_temp.own(format('select private.enforce_rate_limit(%L)', 'no_such_action')),
  'ok', 'private.enforce_rate_limit with no signed-in person is not limited (as before)');

-- 93-95. The writes with no person (the migration role) are not limited and the other limits still work: an
-- unknown action as a signed-in person is still refused.
select is(
  pg_temp.try_as(pg_temp.u(2), $$select private.enforce_rate_limit('create_exchange')$$),
  'err:42501', 'the rate limit function is still not callable by signed-in people');
select is(
  (select count(*)::int from public.join_requests where user_id = pg_temp.u(8) and status = 'pending'),
  1, 'the person who was limited has one pending request after the window reset');
select is(
  (select count(*)::int from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and status = 'pending'
     and user_id = pg_temp.u(9)),
  1, 'each person has at most one pending request per exchange');

select * from finish();
rollback;
