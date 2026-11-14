-- 170_invite_and_join — slice 5 (GC-002, GC-004, GC-009, GC-012, GC-013, GCO-005; plan §3, §6 invariants 2 and 8).
-- Owner decisions 2026-11-13 applied: Q1 join sets onboarded_at, Q2 approval-required exchanges refuse a
-- direct join, Q4 co-member names through get_exchange_people, Q5 counting rules (joined_count excludes the
-- organiser; the 100-person limit counts every active row), Q6 reset_invite_token.
-- Self-contained: creates its own users inside the transaction (needs the migrations through
-- invite_and_join applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under
-- `supabase test db`. Everything rolls back. Names are prefixed "T170" because dev holds other data.
-- Written BEFORE the invite_and_join migration: until it is applied the first statement that names one of
-- the new functions fails (function does not exist) and the run stops. That is the expected "red".
-- Not here (it needs the exchange_lists migration, so it lives in 180): attached_wishlist_id has no grant.
-- Pass: "ok 1".."ok 61", "1..61", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(61);

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

-- pv / jd read one field of the preview / join details as a persona.
create function pg_temp.pv(who uuid, tok text, path text) returns text
language sql as $$
  select pg_temp.val_as(who, format('public.get_invite_preview(%L)->>%L', tok, path))
$$;
create function pg_temp.jd(who uuid, tok text, path text) returns text
language sql as $$
  select pg_temp.val_as(who, format('public.get_join_details(%L)->>%L', tok, path))
$$;

-- mk builds the create_exchange call (same defaults as 130: a valid "At join-by time" exchange).
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

-- u(n) is persona n: 1 Ada (organiser), 2 Bola (outsider who joins), 3 Chi (outsider), 4 Dayo (left, rejoins),
-- 5 Eze (removed), 6 Femi (member). Only ever used as an argument, never inside a role-switched statement.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('17' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u170-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi'])[i]))
  from generate_series(1, 6) i;
  -- 98 more people for the 100-person limit; the auth trigger creates their profiles.
  perform pg_temp.mk_user(('b0000000-0000-4000-8000-1700' || lpad(g::text, 8, '0'))::uuid,
    'bulk170-' || g || '@example.test', '{"first_name":"Bulk"}')
  from generate_series(1, 98) g;
end $fx$;

-- Ada's exchanges, made the way the app makes them: A open (with a note), C joining closed, K cancelled,
-- P approval required, F full-to-be, J where she only organises.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T170 Open', p_note => 'T170 secret note'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T170 Closed', mode => 'organiser_chooses'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T170 Cancelled', mode => 'organiser_chooses'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T170 Approval', mode => 'organiser_chooses', approval => 'true'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T170 Full', mode => 'organiser_chooses'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T170 Just organising', mode => 'organiser_chooses', taking => 'false'));
end $fx$;

-- Ids and tokens, read as the migration role.
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_a', (select id::text from public.exchanges where name = 'T170 Open'), true);
  perform set_config('test.ex_c', (select id::text from public.exchanges where name = 'T170 Closed'), true);
  perform set_config('test.ex_k', (select id::text from public.exchanges where name = 'T170 Cancelled'), true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T170 Approval'), true);
  perform set_config('test.ex_f', (select id::text from public.exchanges where name = 'T170 Full'), true);
  perform set_config('test.ex_j', (select id::text from public.exchanges where name = 'T170 Just organising'), true);
  perform set_config('test.tok_a', (select invite_token from public.exchanges where name = 'T170 Open'), true);
  perform set_config('test.tok_c', (select invite_token from public.exchanges where name = 'T170 Closed'), true);
  perform set_config('test.tok_k', (select invite_token from public.exchanges where name = 'T170 Cancelled'), true);
  perform set_config('test.tok_p', (select invite_token from public.exchanges where name = 'T170 Approval'), true);
  perform set_config('test.tok_f', (select invite_token from public.exchanges where name = 'T170 Full'), true);
  perform set_config('test.tok_j', (select invite_token from public.exchanges where name = 'T170 Just organising'), true);
end $fx$;

-- States and members, written as the migration role (joining is what is under test, so the setup does not
-- use it). now() is frozen in a transaction, so the moves are by update. Every join-by stays before the gift day.
do $fx$ begin
  -- C: joining has closed an hour ago. K: cancelled.
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_c')::uuid;
  update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_k')::uuid;
  -- A: Femi is in; Dayo left; Eze was removed.
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_a')::uuid, pg_temp.u(6), true, now() - interval '2 days');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_a')::uuid, pg_temp.u(4), true, 'left', now() - interval '3 days', now() - interval '1 day');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_a')::uuid, pg_temp.u(5), true, 'removed', now() - interval '3 days', now() - interval '1 day');
  -- F: the organiser plus 98 people = 99 active rows, and Dayo's left row (not counted).
  insert into public.exchange_members (exchange_id, user_id, taking_part)
    select current_setting('test.ex_f')::uuid, ('b0000000-0000-4000-8000-1700' || lpad(g::text, 8, '0'))::uuid, true
    from generate_series(1, 98) g;
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_f')::uuid, pg_temp.u(4), true, 'left', now() - interval '3 days', now() - interval '1 day');
  -- Dayo has been through Profile setup already: join must not move that.
  update public.profiles set onboarded_at = '2020-01-01 00:00:00+00' where id = pg_temp.u(4);
end $fx$;

-- 1. Shape: every function is SECURITY DEFINER with an empty search_path (040 also checks the schemas).
select ok(
  (select count(*) = 6 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('get_invite_preview', 'get_join_details', 'join_exchange', 'get_exchange_people',
                       'reset_invite_token', 'exchange_state'))
  and (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
       where p.oid = 'private.exchange_status(uuid)'::regprocedure),
  'every invite and join function, and private.exchange_status, is SECURITY DEFINER with an empty search_path');

-- 2-4. Grants: anon may execute get_invite_preview and nothing else here; signed-in people may execute all
-- of them; private.exchange_status is closed to both API roles.
select ok(
  has_function_privilege('anon', 'public.get_invite_preview(text)', 'execute')
  and not has_function_privilege('anon', 'public.get_join_details(text)', 'execute')
  and not has_function_privilege('anon', 'public.join_exchange(text)', 'execute')
  and not has_function_privilege('anon', 'public.get_exchange_people(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.reset_invite_token(uuid)', 'execute'),
  'anon can execute get_invite_preview only');
select ok(
  has_function_privilege('authenticated', 'public.get_invite_preview(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_join_details(text)', 'execute')
  and has_function_privilege('authenticated', 'public.join_exchange(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_exchange_people(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.reset_invite_token(uuid)', 'execute'),
  'signed-in people can execute the invite and join functions');
select ok(
  not has_function_privilege('anon', 'private.exchange_status(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.exchange_status(uuid)', 'execute'),
  'private.exchange_status is not executable by anon or signed-in people');

-- 5-6. The preview as a visitor: malformed and unknown tokens are all null; the key set is exact.
select is(
  coalesce(pg_temp.val_as(null, 'public.get_invite_preview(null::text)'), 'null')
  || '/' || coalesce(pg_temp.val_as(null, $$public.get_invite_preview('')$$), 'null')
  || '/' || coalesce(pg_temp.val_as(null, $$public.get_invite_preview(upper(current_setting('test.tok_a')))$$), 'null')
  || '/' || coalesce(pg_temp.val_as(null, $$public.get_invite_preview(left(current_setting('test.tok_a'), 31))$$), 'null')
  || '/' || coalesce(pg_temp.val_as(null, $$public.get_invite_preview('x'' or 1=1 --')$$), 'null')
  || '/' || coalesce(pg_temp.val_as(null, $$public.get_invite_preview('ffffffffffffffffffffffffffffffff')$$), 'null')
  || '/' || coalesce(pg_temp.val_as(null, $$public.get_invite_preview(current_setting('test.ex_a'))$$), 'null'),
  'null/null/null/null/null/null/null',
  'the preview is null for a null, empty, uppercase, short, injected, unknown token and an exchange id');
select is(
  pg_temp.val_as(null, format($$(select string_agg(k, ',' order by k collate "C") from jsonb_object_keys(public.get_invite_preview(%L)) k)$$,
    current_setting('test.tok_a'))),
  'budget_preset,cancelled_at,closed_at,draw_at,draw_mode,exchange_name,gift_day,inviter_name,join_by_at,joined_count,status,tint',
  'the preview has exactly these keys and no others');

-- 7-10. What the preview says for an open exchange; the count excludes the organiser, a person who left and
-- a person who was removed (Q5); an exchange with only its organiser says 0.
select is(
  pg_temp.pv(null, current_setting('test.tok_a'), 'status') || '/' || pg_temp.pv(null, current_setting('test.tok_a'), 'exchange_name')
  || '/' || pg_temp.pv(null, current_setting('test.tok_a'), 'inviter_name')
  || '/' || pg_temp.pv(null, current_setting('test.tok_a'), 'budget_preset')
  || '/' || (pg_temp.pv(null, current_setting('test.tok_a'), 'gift_day') = (current_date + 20)::text)::text,
  'open/T170 Open/Ada/10k_20k/true',
  'the preview of an open exchange has the status, name, inviter, budget and gift day');
select is(pg_temp.pv(null, current_setting('test.tok_a'), 'joined_count'), '1',
  'joined_count is the active members other than the organiser (not the organiser, not the person who left or was removed)');
select is(pg_temp.pv(null, current_setting('test.tok_j'), 'joined_count'), '0',
  'an exchange with only its organiser has joined_count 0');
select ok(
  (select r is not null
     and r not like '%b0000000-0000-4000-8000-%'
     and r not like '%' || current_setting('test.tok_a') || '%'
     and r not like '%' || current_setting('test.ex_a') || '%'
     and r not like '%secret note%'
     and r not like '%@%'
     and r not like '%Africa/Lagos%'
     and r not like '%Femi%' and r not like '%Dayo%' and r not like '%Eze%'
   from (select pg_temp.val_as(null, format('public.get_invite_preview(%L)', current_setting('test.tok_a'))) as r) s),
  'the preview carries no id, token, note, other person''s name, email or organiser time zone');

-- 11-12. Closed: joining has closed (joining_closed). Cancelled shows when it was cancelled. Approval shows.
select is(
  pg_temp.pv(null, current_setting('test.tok_c'), 'status') || '/'
  || (pg_temp.pv(null, current_setting('test.tok_c'), 'closed_at') is not null)::text || '/'
  || (pg_temp.pv(null, current_setting('test.tok_c'), 'cancelled_at') is null)::text,
  'closed/true/true', 'joining closed: status closed with the closing moment and no cancelled_at');
select is(
  pg_temp.pv(null, current_setting('test.tok_k'), 'status') || '/'
  || (pg_temp.pv(null, current_setting('test.tok_k'), 'cancelled_at') is not null)::text || '/'
  || (pg_temp.pv(null, current_setting('test.tok_k'), 'closed_at') is null)::text,
  'cancelled/true/true', 'cancelled: status cancelled with the cancelled moment and no closed_at');
select is(pg_temp.pv(null, current_setting('test.tok_p'), 'status'), 'approval',
  'an otherwise open exchange that needs approval says so (the unavailable state, Q2)');

-- 13-14. The full limit counts every active row, the organiser included: Ada + 98 = 99 is still open (and the
-- left row is not counted); joined_count is 98.
select is(
  (select count(*)::text from public.exchange_members where exchange_id = current_setting('test.ex_f')::uuid and state = 'active')
  || '/' || pg_temp.pv(null, current_setting('test.tok_f'), 'status')
  || '/' || pg_temp.pv(null, current_setting('test.tok_f'), 'joined_count'),
  '99/open/98', '99 active rows (organiser included, a left row not counted) is still open; joined_count excludes the organiser');

-- 15-24. get_join_details: signed in only; one shape; the exchange id only for a member.
select is(pg_temp.try_as(null, format('select public.get_join_details(%L)', current_setting('test.tok_a'))),
  'err:42501', 'a visitor cannot call get_join_details');
select is(
  pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'viewer') || '/'
  || coalesce(pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'exchange_id'), 'none'),
  'can_join/none', 'an outsider is can_join and gets no exchange id');
select is(
  pg_temp.val_as(pg_temp.u(3), format($$(select string_agg(k, ',' order by k collate "C") from jsonb_object_keys(public.get_join_details(%L)) k)$$,
    current_setting('test.tok_a'))),
  'budget_preset,draw_at,draw_mode,exchange_id,exchange_name,gift_day,join_by_at,note,organiser_name,people,status,tint,viewer',
  'the join details have exactly these keys');
select is(
  pg_temp.val_as(pg_temp.u(3), format($$(select string_agg(e->>'name' || ':' || (e->>'is_organiser'), ',') from jsonb_array_elements(public.get_join_details(%L)->'people') e)$$,
    current_setting('test.tok_a'))),
  'Ada:true,Femi:false',
  'the people are the active members, organiser first (not the person who left or was removed)');
select ok(
  (select r is not null and r not like '%b0000000-%' and r not like '%@%'
          and r not like '%"user_id"%' and r not like '%attached%' and r not like '%taking_part%'
   from (select pg_temp.val_as(pg_temp.u(3), format($$(select jsonb_agg(e) from jsonb_array_elements(public.get_join_details(%L)->'people') e)$$,
     current_setting('test.tok_a'))) as r) s)
  and pg_temp.val_as(pg_temp.u(3), format($$(select string_agg(distinct k, ',' order by k) from jsonb_array_elements(public.get_join_details(%L)->'people') e, jsonb_object_keys(e) k)$$,
     current_setting('test.tok_a'))) = 'is_organiser,name',
  'each person in the join details has a name and an organiser flag only (no id, email or list status)');
select is(
  pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'note') || '/'
  || pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'organiser_name') || '/'
  || pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'draw_mode') || '/'
  || (pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'draw_at') = pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'join_by_at'))::text,
  'T170 secret note/Ada/at_join_by/true', 'the join details carry the note, organiser, draw mode and draw time');
select is(
  pg_temp.jd(pg_temp.u(6), current_setting('test.tok_a'), 'viewer') || '/' || pg_temp.jd(pg_temp.u(6), current_setting('test.tok_a'), 'exchange_id')
  || '/' || pg_temp.jd(pg_temp.u(1), current_setting('test.tok_a'), 'viewer') || '/' || pg_temp.jd(pg_temp.u(1), current_setting('test.tok_a'), 'exchange_id'),
  'member/' || current_setting('test.ex_a') || '/member/' || current_setting('test.ex_a'),
  'an active member and the organiser are members and get the exchange id');
select is(
  pg_temp.jd(pg_temp.u(5), current_setting('test.tok_a'), 'viewer') || '/'
  || coalesce(pg_temp.jd(pg_temp.u(5), current_setting('test.tok_a'), 'exchange_id'), 'none') || '/'
  || pg_temp.val_as(pg_temp.u(5), format('jsonb_array_length(public.get_join_details(%L)->''people'')', current_setting('test.tok_a'))),
  'removed/none/0', 'a removed person is removed, gets no exchange id and sees no names');
select is(
  pg_temp.jd(pg_temp.u(4), current_setting('test.tok_a'), 'viewer') || '/'
  || coalesce(pg_temp.jd(pg_temp.u(4), current_setting('test.tok_a'), 'exchange_id'), 'none'),
  'can_join/none', 'a person who left can join again and gets no exchange id');
select is(
  coalesce(pg_temp.val_as(pg_temp.u(3), $$public.get_join_details('ffffffffffffffffffffffffffffffff')$$), 'null')
  || '/' || coalesce(pg_temp.val_as(pg_temp.u(3), $$public.get_join_details('not a token')$$), 'null'),
  'null/null', 'an unknown or malformed token has no join details');

-- 25. exchange_state still answers for members only, and agrees with the shared status (replaced function).
select is(
  coalesce(pg_temp.val_as(pg_temp.u(3), format('public.exchange_state(%L)', current_setting('test.ex_a'))), 'null')
  || '/' || pg_temp.val_as(pg_temp.u(1), format('public.exchange_state(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('public.exchange_state(%L)', current_setting('test.ex_c')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('public.exchange_state(%L)', current_setting('test.ex_k'))),
  'null/open/joining_closed/cancelled',
  'exchange_state is null for a non-member and the calculated status for the organiser');

-- 26-29. get_exchange_people (Q4): the active members, for members only.
select is(
  pg_temp.val_as(pg_temp.u(6), format($$(select string_agg(format('%%s:%%s:%%s:%%s', display_name, is_organiser::text, is_me::text, taking_part::text), '|')
    from public.get_exchange_people(%L))$$, current_setting('test.ex_a'))),
  'Ada:true:false:true|Femi:false:true:true',
  'a member sees the active members, organiser first, flagged organiser and me (not the person who left or was removed)');
select is(
  pg_temp.try_as(pg_temp.u(3), format('select * from public.get_exchange_people(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as(pg_temp.u(4), format('select * from public.get_exchange_people(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select * from public.get_exchange_people(%L)', current_setting('test.ex_a'))),
  'ok:0/ok:0/ok:0', 'an outsider, a person who left and a removed person see no names');
select is(pg_temp.try_as(null, format('select * from public.get_exchange_people(%L)', current_setting('test.ex_a'))),
  'err:42501', 'a visitor cannot call get_exchange_people');
select is(
  (select proargnames::text from pg_proc where oid = 'public.get_exchange_people(uuid)'::regprocedure),
  '{p_exchange,display_name,is_organiser,is_me,taking_part}',
  'get_exchange_people returns names and flags only (no id, avatar or list status)');
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(format('%%s:%%s:%%s:%%s', display_name, is_organiser::text, is_me::text, taking_part::text), '|')
    from public.get_exchange_people(%L))$$, current_setting('test.ex_j'))),
  'Ada:true:true:false', 'an organiser who only organises is listed as not taking part');

-- 30-36. join_exchange: a visitor cannot; an outsider joins once; Join is idempotent; the organiser's own row
-- is unchanged.
select is(pg_temp.try_as(null, format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'err:42501', 'a visitor cannot join');
do $fx$ begin
  perform set_config('test.bola_mem', pg_temp.val_as(pg_temp.u(2), format('public.join_exchange(%L)', current_setting('test.tok_a'))), true);
end $fx$;
select is(current_setting('test.bola_mem'),
  (select id::text from public.exchange_members where exchange_id = current_setting('test.ex_a')::uuid and user_id = pg_temp.u(2) and state = 'active'),
  'an outsider can join and gets their membership id');
select is(
  (select format('%s/%s/%s', count(*), bool_and(taking_part)::text, min(state::text))
   from public.exchange_members where exchange_id = current_setting('test.ex_a')::uuid and user_id = pg_temp.u(2)),
  '1/true/active', 'joining adds exactly one active row, taking part');
do $fx$ begin
  perform set_config('test.bola_mem2', pg_temp.val_as(pg_temp.u(2), format('public.join_exchange(%L)', current_setting('test.tok_a'))), true);
end $fx$;
select is(
  current_setting('test.bola_mem2') || '/' || (select count(*) from public.exchange_members where exchange_id = current_setting('test.ex_a')::uuid and user_id = pg_temp.u(2)),
  current_setting('test.bola_mem') || '/1', 'joining again is idempotent: the same membership, no second row');
do $fx$ begin
  perform set_config('test.ada_j_mem', pg_temp.val_as(pg_temp.u(1), format('public.join_exchange(%L)', current_setting('test.tok_j'))), true);
end $fx$;
select is(
  (select format('%s/%s/%s/%s', count(*), bool_and(taking_part)::text, bool_and(state = 'active')::text, (min(id::text) = current_setting('test.ada_j_mem'))::text)
   from public.exchange_members where exchange_id = current_setting('test.ex_j')::uuid and user_id = pg_temp.u(1)),
  '1/false/true/true', 'the organiser joining their own exchange gets their existing row back, still not taking part');
select is(
  pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', 'ffffffffffffffffffffffffffffffff'))
  || '/' || pg_temp.try_as(pg_temp.u(3), $$select public.join_exchange('not-a-token')$$)
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as(pg_temp.u(3), $$select public.join_exchange('')$$)
  || '/' || pg_temp.try_as(pg_temp.u(3), 'select public.join_exchange(null)'),
  'err:P0002/err:P0002/err:P0002/err:P0002/err:P0002',
  'an unknown, malformed, empty or null token, and an exchange id used as a token, are all "not found"');
select is(
  (select count(*)::int from public.exchange_members where user_id = pg_temp.u(3)), 0,
  'those refusals created no membership');

-- 37-40. Refusals by state: closed, cancelled, approval (22023 with the reason as the hint). Nothing is written.
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_c'))),
  'err:22023/closed', 'joining closed: refused with hint closed');
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_k'))),
  'err:22023/cancelled', 'cancelled: refused with hint cancelled');
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_p'))),
  'err:22023/approval', 'an approval-required exchange refuses a direct join (Q2)');
select is(pg_temp.hint_as(pg_temp.u(5), format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'err:22023/removed', 'a removed person cannot join again');

-- 41-42. The closed state also covers "gift day passed" and "complete".
update public.exchanges set join_by_at = now() - interval '3 days',
  gift_day = (now() at time zone 'Africa/Lagos')::date - 1
  where id = current_setting('test.ex_c')::uuid;
select is(
  pg_temp.pv(null, current_setting('test.tok_c'), 'status') || '/'
  || pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_c'))),
  'closed/err:22023/closed', 'once the gift day has passed the invite is closed');
update public.exchanges set completed_at = now() where id = current_setting('test.ex_c')::uuid;
select is(
  pg_temp.pv(null, current_setting('test.tok_c'), 'status') || '/'
  || pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_c'))),
  'closed/err:22023/closed', 'a complete exchange is closed');
select is(
  pg_temp.jd(pg_temp.u(3), current_setting('test.tok_c'), 'status') || '/'
  || pg_temp.val_as(pg_temp.u(3), format('jsonb_array_length(public.get_join_details(%L)->''people'')', current_setting('test.tok_c'))),
  'closed/0', 'the join details of a closed exchange show no names');

-- 43-44. The 100-person limit counts every active row. Bola takes the 100th place; Chi is refused; once one
-- person leaves, a place is free (a left row is not counted).
select is(pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_f'))),
  'ok:1', 'the 100th person can join');
select is(
  (select count(*)::text from public.exchange_members where exchange_id = current_setting('test.ex_f')::uuid and state = 'active')
  || '/' || pg_temp.pv(null, current_setting('test.tok_f'), 'status')
  || '/' || pg_temp.pv(null, current_setting('test.tok_f'), 'joined_count'),
  '100/full/99', 'a hundred active rows is full for the preview; joined_count excludes the organiser');
select is(pg_temp.hint_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_f'))),
  'err:22023/full', 'the 101st person is refused with hint full');
-- Q1 caller-only checks, before Chi's later successful join: refusals above set nobody's onboarded_at.
select is(
  (select count(*) filter (where onboarded_at is not null)::text
     from public.profiles where id in (pg_temp.u(3), pg_temp.u(5), pg_temp.u(6))),
  '0', 'a refused join does not set onboarded_at, and joining never sets anyone else''s');
do $fx$ begin
  update public.exchange_members set state = 'left', left_at = now()
    where exchange_id = current_setting('test.ex_f')::uuid
      and user_id = ('b0000000-0000-4000-8000-1700' || lpad('1', 8, '0'))::uuid;
end $fx$;
select is(pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_f'))),
  'ok:1', 'when someone leaves, a place is free again (a left row is not counted)');

-- 45-47. Rejoin and onboarded_at (Q1): a person who left joins again as a NEW row; onboarded_at is set once for
-- a person who has none and left alone for a person who has.
select is(pg_temp.try_as(pg_temp.u(4), format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'ok:1', 'a person who left can join again');
select is(
  (select format('%s/%s', count(*), count(*) filter (where state = 'active'))
   from public.exchange_members where exchange_id = current_setting('test.ex_a')::uuid and user_id = pg_temp.u(4)),
  '2/1', 'rejoining adds a new active row and keeps the old left row');
select is(
  (select format('%s/%s/%s',
     (select onboarded_at is not null from public.profiles where id = pg_temp.u(2))::text,
     (select onboarded_at = '2020-01-01 00:00:00+00' from public.profiles where id = pg_temp.u(4))::text,
     (select onboarded_at is null from public.profiles where id = pg_temp.u(6))::text)),
  'true/true/true', 'join sets onboarded_at for the person who joined, never moves an earlier value, and leaves others alone');

-- 48-49. No client writes the member table (the write path is join_exchange only).
select is(pg_temp.try_as(pg_temp.u(3),
  format('insert into public.exchange_members (exchange_id, user_id, taking_part) values (%L, %L, true)', current_setting('test.ex_p'), pg_temp.u(3)::text)),
  'err:42501', 'a person cannot add themselves to an exchange by inserting a member row');
select is(pg_temp.try_as(pg_temp.u(6),
  format('update public.exchange_members set state = %L where exchange_id = %L', 'active', current_setting('test.ex_a'))),
  'err:42501', 'a person cannot change member rows directly');

-- 50-57. reset_invite_token (Q6): organiser only; the old link stops working; cancelled and complete are refused.
do $fx$ begin
  perform set_config('test.tok_a2', pg_temp.val_as(pg_temp.u(1), format('public.reset_invite_token(%L)', current_setting('test.ex_a'))), true);
end $fx$;
select ok(current_setting('test.tok_a2') ~ '^[0-9a-f]{32}$' and current_setting('test.tok_a2') <> current_setting('test.tok_a'),
  'the organiser gets a new 32-hex token');
select is(
  coalesce(pg_temp.pv(null, current_setting('test.tok_a'), 'status'), 'null')
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_a')))
  || '/' || coalesce(pg_temp.jd(pg_temp.u(3), current_setting('test.tok_a'), 'status'), 'null')
  || '/' || pg_temp.pv(null, current_setting('test.tok_a2'), 'status'),
  'null/err:P0002/null/open', 'the old link is unknown to the preview, join and details; the new link works');
select is(
  pg_temp.val_as(pg_temp.u(1), format('public.get_exchange_invite_token(%L)', current_setting('test.ex_a'))),
  current_setting('test.tok_a2'), 'the organiser''s stored token is the new one');
select is(
  pg_temp.try_as(pg_temp.u(2), format('select public.reset_invite_token(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select public.reset_invite_token(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select public.reset_invite_token('c0000000-0000-4000-8000-0000000017ff')$$)
  || '/' || pg_temp.try_as(null, format('select public.reset_invite_token(%L)', current_setting('test.ex_a'))),
  'err:P0002/err:P0002/err:P0002/err:42501',
  'a member, an outsider and an unknown id all get "not found"; a visitor is refused outright');
select is(
  pg_temp.hint_as(pg_temp.u(1), format('select public.reset_invite_token(%L)', current_setting('test.ex_k')))
  || '/' || pg_temp.hint_as(pg_temp.u(1), format('select public.reset_invite_token(%L)', current_setting('test.ex_c'))),
  'err:22023/cancelled/err:22023/complete', 'a cancelled or complete exchange cannot have its link reset');
select is(
  pg_temp.val_as(pg_temp.u(2), format('public.is_member(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as(pg_temp.u(6), format('public.is_member(%L)', current_setting('test.ex_a'))),
  'true/true', 'resetting the link does not remove anyone');
select is(
  (select count(*)::int from public.exchanges where name like 'T170 %' and invite_token = current_setting('test.tok_a')),
  0, 'the old token is gone from the table');

select * from finish();
rollback;
