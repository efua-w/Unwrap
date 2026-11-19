-- 270_nudges — slice 8 (GCO-008 Nudge, E10; plan §5-§8; owner decisions 2026-11-18 1-4, docs/tasks/slice-8.md).
-- Covers: send_nudge and undo_nudge are the organiser's only; nothing is written for anyone else (P0002), a visitor is
-- refused (42501). A nudge queues one E10 per person, always (no notification toggle), from the organiser, with a payload of
-- the exchange id only and send_after 20 seconds ahead (the Undo window), and writes no activity event. Skipped silently:
-- the organiser's own row, a person whose list is in, someone nudged in the last 12 hours by ANY sender, a left, removed or
-- not-taking-part person, another exchange's member, an anonymised person. The result names only the people actually queued.
-- The limit is 20 emails an hour per organiser across exchanges, an over-limit send is refused WHOLE (P0429, hint 'nudges'),
-- and undone nudges do not count. Allowed before the draw (open or joining closed); refused when the exchange is over
-- ('closed') or cancelled ('cancelled'). undo_nudge stops only the caller's own unsent, unleased rows. claim_due_emails
-- does not take a nudge before its 20 seconds are up, cancels an E10 as 'not_needed' when the person left or added a list,
-- and carries the organiser's name and the draw mode and time for E10 only.
-- Self-contained: creates its own users inside the transaction (needs the migrations through readiness_and_nudges
-- applied, not seed.sql). Everything rolls back. Names are prefixed "T270" because dev holds other data. now() is frozen
-- inside a transaction, so times are moved by update, never relied on. Each RPC is its own statement (a function that
-- reads rows written earlier in the same statement would not see them).
-- Written BEFORE the readiness_and_nudges migration: until it is applied the first statement that names send_nudge fails
-- and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 43", "1..43", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(43);

-- Isolation (test setup only): the dev database holds outbox rows from other runs, which would change the hourly count
-- and the 12-hour skip. Every row is deleted INSIDE this transaction, which rolls back at the end.
delete from private.email_outbox;

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

-- nudge calls send_nudge as a persona for an exchange and the member rows of the listed personas (every row each persona
-- has, in any exchange and any state: the function must ignore the ones that do not belong). It returns the names it
-- queued joined with '|', '(none)' when nothing was, or 'err:<SQLSTATE>:<hint>'.
create function pg_temp.nudge(who uuid, ex text, users int[]) returns text
language plpgsql as $$
declare
  v text;
  ids uuid[];
  st text;
  h text;
begin
  select array_agg(m.id) into ids from public.exchange_members m
   where m.user_id = any (select pg_temp.u(x) from unnest(users) x);
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
  begin
    select coalesce(string_agg(r.display_name, '|' order by r.display_name), '(none)') into v
      from public.send_nudge(ex::uuid, ids) r;
    reset role;
    return v;
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    st := sqlstate;
    reset role;
    return 'err:' || st || ':' || coalesce(h, '');
  end;
end $$;

-- nudge_raw: the same call with an explicit member id array (null and empty lists).
create function pg_temp.nudge_raw(who uuid, ex text, ids_sql text) returns text
language plpgsql as $$
declare
  v text;
  st text;
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
    execute format('select coalesce(string_agg(r.display_name, ''|''), ''(none)'') from public.send_nudge(%L, %s) r', ex, ids_sql) into v;
    reset role;
    return v;
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    st := sqlstate;
    reset role;
    return 'err:' || st || ':' || coalesce(h, '');
  end;
end $$;

-- undo calls undo_nudge as a persona: the count, or 'err:<SQLSTATE>'.
create function pg_temp.undo(who uuid, ex text) returns text
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
    execute format('select public.undo_nudge(%L)::text', ex) into v;
    reset role;
    return v;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

-- claim_as_svc calls claim_due_emails as service_role and keeps the rows as json in a transaction setting.
create function pg_temp.claim_as_svc(slot text) returns void
language plpgsql as $$
declare
  v jsonb;
begin
  set local role service_role;
  set local request.jwt.claims = '{"role":"service_role"}';
  begin
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v from public.claim_due_emails(50) c;
  exception when others then
    reset role;
    raise;
  end;
  reset role;
  perform set_config(slot, v::text, true);
end $$;

create function pg_temp.mk(p_name text, mode text default 'organiser_chooses') returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, false)',
    p_name, '10k_20k', mode, '18:00', 'Africa/Lagos')
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

-- u(n) is persona n: 1 Ada (organiser of P, R and T), 2 Bola (member of P), 3 Chi (member of P and T), 4 Dayo (member of
-- P, real wishlist attached), 5 Eze (member of P, every toggle off), 6 Femi (organiser of X), 7 Gbemi (member of X),
-- 8 Hana (left P, member of X), 9 Ife (removed from P), 10 Jide (member of P who is not taking part), 11 Kemi (member of
-- P), 12-36 members of R, 37 Zed (member of P, anonymised).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('27' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- The outbox rows for an exchange and template, as one string: recipient first names in order.
create function pg_temp.queued(ex text, tpl text) returns text
language sql as $$
  select coalesce(string_agg(p.display_name, '|' order by p.display_name), '(none)')
  from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
  where o.template = tpl and o.exchange_id = ex::uuid and o.cancelled_at is null
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u270-' || i || '@example.test',
    jsonb_build_object('first_name',
      case when i <= 11 then (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi'])[i]
           when i = 37 then 'Zed'
           else 'R' || lpad(i::text, 2, '0') end))
  from (select generate_series(1, 37) i) s;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T270 Nudges'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T270 Rate'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T270 Auto', mode => 'at_join_by'));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T270 Other'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T270 Nudges'), true);
  perform set_config('test.ex_r', (select id::text from public.exchanges where name = 'T270 Rate'), true);
  perform set_config('test.ex_t', (select id::text from public.exchanges where name = 'T270 Auto'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T270 Other'), true);
end $fx$;

-- Members, lists and settings, written as the migration role (so no activity event is written by the setup).
do $fx$ begin
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - (20 - n) * interval '1 hour'
      from unnest(array[2, 3, 4, 5, 11, 37]) n;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(10), false, now() - interval '1 hour');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(8), true, 'left', now() - interval '9 days', now() - interval '8 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(9), true, 'removed', now() - interval '9 days', now() - interval '8 days');
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_r')::uuid, pg_temp.u(n), true, now() - (40 - n) * interval '1 minute'
      from generate_series(12, 36) n;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_t')::uuid, pg_temp.u(3), true, now() - interval '1 day');
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_x')::uuid, pg_temp.u(7), true, now() - interval '2 days'),
           (current_setting('test.ex_x')::uuid, pg_temp.u(8), true, now() - interval '1 day');
  insert into public.wishlists (owner_id, name) values (pg_temp.u(4), 'T270 Dayo list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T270 Dayo list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(4);
  update public.user_settings
     set notify_names_drawn = false, notify_someone_joins = false, notify_join_by_reminder = false, notify_event_reminder = false
   where user_id = pg_temp.u(5);
  update public.profiles set anonymised_at = now() where id = pg_temp.u(37);
  perform set_config('test.events0', (select count(*)::text from public.activity_events), true);
end $fx$;

-- 1. Shape: both RPCs are SECURITY DEFINER with an empty search_path (040 checks all schemas).
select ok(
  (select count(*) = 2 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('send_nudge', 'undo_nudge')),
  'send_nudge and undo_nudge are SECURITY DEFINER with an empty search_path');

-- 2. What they return: the people queued (member id and name), and a count.
select is(
  pg_get_function_result('public.send_nudge(uuid, uuid[])'::regprocedure) || '/' || pg_get_function_result('public.undo_nudge(uuid)'::regprocedure),
  'TABLE(member_id uuid, display_name text)/integer',
  'send_nudge returns member ids and names only; undo_nudge a count');

-- 3. Grants: anon cannot execute either (030 stays as it is); signed-in people can. The writer has its new signature
-- and neither API role can reach it.
select ok(
  not has_function_privilege('anon', 'public.send_nudge(uuid, uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.undo_nudge(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.send_nudge(uuid, uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.undo_nudge(uuid)', 'execute'),
  'anon cannot execute the nudge functions; signed-in people can');
select ok(
  to_regprocedure('private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text)') is null
  and to_regprocedure('private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)') is not null
  and not has_function_privilege('authenticated', 'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)', 'execute'),
  'enqueue_email has one signature (with send_after) and no API role can execute it');

-- 4. A visitor is refused.
select is(
  pg_temp.nudge_raw(null, current_setting('test.ex_p'), 'array[gen_random_uuid()]')
  || '/' || pg_temp.undo(null, current_setting('test.ex_p')),
  'err:42501:/err:42501', 'a visitor is refused (42501) on both');

-- 5. Everyone but the organiser of that exchange gets P0002 and nothing is queued: a member, a person who left, a removed
-- person, another exchange's member and organiser, and an unknown or null exchange.
select is(
  pg_temp.nudge(pg_temp.u(2), current_setting('test.ex_p'), array[3])
  || '/' || pg_temp.nudge(pg_temp.u(8), current_setting('test.ex_p'), array[3])
  || '/' || pg_temp.nudge(pg_temp.u(9), current_setting('test.ex_p'), array[3])
  || '/' || pg_temp.nudge(pg_temp.u(7), current_setting('test.ex_p'), array[3])
  || '/' || pg_temp.nudge(pg_temp.u(6), current_setting('test.ex_p'), array[3])
  || '/' || pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_x'), array[3])
  || '/' || pg_temp.nudge(pg_temp.u(1), 'c0000000-0000-4000-8000-0000000027ff', array[3])
  || '/' || pg_temp.nudge_raw(pg_temp.u(1), null, 'array[gen_random_uuid()]'),
  'err:P0002:/err:P0002:/err:P0002:/err:P0002:/err:P0002:/err:P0002:/err:P0002:/err:P0002:',
  'a member, a person who left, a removed person, an outsider and another exchange''s organiser cannot nudge');
select is((select count(*)::int from private.email_outbox), 0, 'those refusals queued nothing');

-- 6. A null or empty list of people is refused with the hint 'members' (22023).
select is(
  pg_temp.nudge_raw(pg_temp.u(1), current_setting('test.ex_p'), 'null::uuid[]')
  || '/' || pg_temp.nudge_raw(pg_temp.u(1), current_setting('test.ex_p'), 'array[]::uuid[]'),
  'err:22023:members/err:22023:members', 'no people is refused');

-- 7. The organiser nudges Bola and Chi: the result names exactly them.
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[2, 3]), 'Bola|Chi',
  'the organiser nudges two people and the result names them');

-- 8. What was queued: E10, from Ada, to each, a payload of the exchange id only, 20 seconds ahead, not sent.
select is(
  (select string_agg(p.display_name || ':' || (o.sender_id = pg_temp.u(1))::text || ':'
                     || (select string_agg(k, ',') from jsonb_object_keys(o.payload) k) || ':'
                     || (o.send_after - now())::text || ':' || (o.sent_at is null and o.cancelled_at is null)::text, '|' order by p.display_name)
   from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
   where o.template = 'E10' and o.exchange_id = current_setting('test.ex_p')::uuid),
  'Bola:true:exchange_id:00:00:20:true|Chi:true:exchange_id:00:00:20:true',
  'two E10 rows from the organiser, payload the exchange id only, due in 20 seconds');

-- 9. No activity event and no address in a row.
select is((select count(*)::text from public.activity_events), current_setting('test.events0'), 'a nudge writes no activity event');
select ok(
  not exists (select 1 from private.email_outbox o where o.template = 'E10'
    and (o.recipient_email is not null or o.payload::text like '%@%' or o.payload::text like '%' || pg_temp.u(1)::text || '%')),
  'an E10 row holds no address and no person id');

-- 10. Skipped, whole call returns nothing: the organiser's own row, a person whose list is in, a person who left, a removed
-- person, a person not taking part, another exchange's member, an anonymised person. Nothing is queued.
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[1, 4, 8, 9, 10, 7, 37]), '(none)',
  'the organiser, a list that is in, a left, removed, not-taking-part, other-exchange and anonymised person are all skipped');
select is((select count(*)::int from private.email_outbox where template = 'E10'), 2, 'the skipped people were queued nothing');

-- 11. Partly nudged: the rest are sent and only they are named. Eze has every toggle off and is still queued (always sent).
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[2, 3, 5]), 'Eze',
  'a repeat nudge sends to the person not yet nudged and names only them');
select is(pg_temp.queued(current_setting('test.ex_p'), 'E10'), 'Bola|Chi|Eze',
  'one E10 each: the toggles do not stop a nudge');

-- 12. The 12-hour skip counts any sender: Femi's nudge to Kemi stops Ada's.
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key)
    values ('E10', pg_temp.u(11), current_setting('test.ex_p')::uuid, pg_temp.u(6), 'T270-kemi');
end $fx$;
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[11]), '(none)',
  'someone nudged by another sender in the last 12 hours is skipped');

-- 13. Older than 12 hours does not count.
do $fx$ begin
  update private.email_outbox o set created_at = now() - interval '13 hours'
   where o.recipient_user_id = pg_temp.u(2) and o.template = 'E10';
end $fx$;
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[2]), 'Bola',
  'a nudge from 13 hours ago no longer stops a new one');

-- 14. undo_nudge stops only the caller's own unsent rows for that exchange: Femi, Gbemi and Bola (a recipient) stop none.
select is(
  pg_temp.undo(pg_temp.u(6), current_setting('test.ex_p'))
  || '/' || pg_temp.undo(pg_temp.u(7), current_setting('test.ex_p'))
  || '/' || pg_temp.undo(pg_temp.u(2), current_setting('test.ex_p'))
  || '/' || pg_temp.undo(pg_temp.u(1), current_setting('test.ex_x')),
  '1/0/0/0',
  'no one stops another organiser''s nudges (the only row Femi can stop is their own to Kemi)');
-- 15. Ada undoes: Bola (twice: the old and the new), Chi and Eze are stopped, with the reason 'undone'.
select is(pg_temp.undo(pg_temp.u(1), current_setting('test.ex_p')), '4', 'the organiser stops four unsent nudges');
select is(
  (select count(*)::text || '/' || count(*) filter (where o.cancelled_at is not null and o.last_error_code = 'undone')::text
   from private.email_outbox o where o.template = 'E10' and o.sender_id = pg_temp.u(1)),
  '4/4', 'every one is cancelled and marked undone');
-- 16. After an undo the person can be nudged again (an undone nudge does not count for the 12 hours).
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[3]), 'Chi', 'an undone nudge can be sent again');

-- 17. undo_nudge leaves a sent row and a row being sent (a live lease) alone.
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key, sent_at)
    values ('E10', pg_temp.u(4), current_setting('test.ex_p')::uuid, pg_temp.u(1), 'T270-sent', now() - interval '1 minute');
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key, claimed_until)
    values ('E10', pg_temp.u(4), current_setting('test.ex_p')::uuid, pg_temp.u(1), 'T270-leased', now() + interval '5 minutes');
end $fx$;
select is(pg_temp.undo(pg_temp.u(1), current_setting('test.ex_p')), '1', 'only the unsent, unleased nudge (Chi) is stopped');
select is(
  (select count(*)::int from private.email_outbox where dedupe_key in ('T270-sent', 'T270-leased') and cancelled_at is null),
  2, 'the sent row and the row being sent stay as they are');

-- 18-23. The hourly limit. Start clean: Ada has sent no nudge in the last hour.
delete from private.email_outbox;
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_r'), (select array_agg(n) from generate_series(12, 31) n)) like 'R12|R13|%R31', 'true',
  'twenty people in one call is allowed');
select is((select count(*)::int from private.email_outbox where template = 'E10'), 20, 'twenty emails were queued');
select is(
  pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_r'), array[32])
  || '/' || pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[5]),
  'err:P0429:nudges/err:P0429:nudges',
  'the 21st email in an hour is refused with the hint nudges, in this exchange or another');
select is((select count(*)::int from private.email_outbox where template = 'E10'), 20, 'the refused sends queued nothing');
select is(pg_temp.nudge(pg_temp.u(6), current_setting('test.ex_x'), array[7]), 'Gbemi',
  'the limit is per organiser: Femi can still nudge');
-- 24. Undone nudges do not count, and an over-limit send is refused whole.
select is(pg_temp.undo(pg_temp.u(1), current_setting('test.ex_r')), '20', 'twenty nudges are undone');
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_r'), (select array_agg(n) from generate_series(12, 26) n)) like 'R12|%R26', 'true',
  'after the undo the count is zero: fifteen people are allowed');
select is(
  pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_r'), (select array_agg(n) from generate_series(27, 32) n))
  || '/' || (select count(*)::text from private.email_outbox where template = 'E10' and sender_id = pg_temp.u(1) and cancelled_at is null),
  'err:P0429:nudges/15',
  'six more would pass 20: the whole send is refused, none of the six is queued');
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_r'), (select array_agg(n) from generate_series(27, 31) n)) like 'R27|%R31', 'true',
  'five more reach exactly 20 and are sent');

-- 25. Only before the draw: joining closed is allowed; an exchange that is over or cancelled is refused. Nothing is queued.
do $fx$ begin
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_x')::uuid;
end $fx$;
select is(pg_temp.nudge(pg_temp.u(6), current_setting('test.ex_x'), array[8]), 'Hana', 'joining closed still allows a nudge');
do $fx$ begin
  update public.exchanges set completed_at = now() where id = current_setting('test.ex_p')::uuid;
  update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_r')::uuid;
end $fx$;
select is(
  pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[5])
  || '/' || pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_r'), array[32])
  || '/' || (select count(*)::text from private.email_outbox where template = 'E10' and recipient_user_id = pg_temp.u(5)),
  'err:22023:closed/err:22023:cancelled/0',
  'a finished exchange is refused with the hint closed, a cancelled one with cancelled, and nothing is queued');
do $fx$ begin
  update public.exchanges set completed_at = null where id = current_setting('test.ex_p')::uuid;
end $fx$;

-- 26-31. The sender's claim. Start clean, then queue three nudges on P (Bola, Chi, Eze) and one on T (Chi).
delete from private.email_outbox;
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_p'), array[2, 3, 5]), 'Bola|Chi|Eze', 'three nudges queued for the claim test');
select is(pg_temp.nudge(pg_temp.u(1), current_setting('test.ex_t'), array[3]), 'Chi', 'one nudge on the automatic exchange');
do $fx$ begin
  perform pg_temp.claim_as_svc('test.claim0');
end $fx$;
select is(current_setting('test.claim0'), '[]', 'a nudge is not taken before its 20 seconds are up (the Undo window)');
do $fx$ begin
  update private.email_outbox set send_after = now() - interval '1 minute' where template = 'E10';
  -- an unrelated E09 shows the new columns are empty for every other template
  perform private.enqueue_email('E09', pg_temp.u(4), null, current_setting('test.ex_p')::uuid, null, null);
  -- Bola adds a list and Eze leaves, both after being nudged
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T270 Bola list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T270 Bola list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2);
  update public.exchange_members set state = 'left', left_at = now()
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(5);
end $fx$;
do $fx$ begin
  perform pg_temp.claim_as_svc('test.claim1');
end $fx$;
select is(
  (select string_agg(c ->> 'template' || ':' || coalesce(c ->> 'to_name', '-') || ':' || coalesce(c ->> 'other_name', '-') || ':'
                     || coalesce(c ->> 'draw_mode', '-') || ':' || (c ->> 'draw_at' is not null)::text, '|'
                     order by c ->> 'template', c ->> 'draw_mode')
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c),
  'E09:Dayo:-:-:false|E10:Chi:Ada:at_join_by:true|E10:Chi:Ada:organiser_chooses:false',
  'the claim returns E10 with the organiser''s name and the draw mode and time, and the E09 has none');
select is(
  (select string_agg(p.display_name || ':' || coalesce(o.last_error_code, '-') || ':' || (o.cancelled_at is not null)::text, '|' order by p.display_name)
   from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
   where o.template = 'E10' and o.exchange_id = current_setting('test.ex_p')::uuid),
  'Bola:not_needed:true|Chi:-:false|Eze:not_needed:true',
  'a nudge to a person who added a list or left is cancelled as not_needed and never claimed');
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('test.claim1')::jsonb) c, jsonb_object_keys(c) k
   where k not in ('id', 'template', 'to_email', 'to_name', 'to_timezone', 'exchange_id', 'exchange_name', 'other_name',
                   'invite_token', 'attempts', 'budget_preset', 'join_by_at', 'gift_day', 'note', 'draw_mode', 'draw_at')),
  0, 'a claimed row has no other column: no pair, no list, no second address');
select ok(
  (select bool_and((c ->> 'to_email') = (select u.email::text from auth.users u where u.id = o.recipient_user_id))
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c join private.email_outbox o on o.id = (c ->> 'id')::uuid)
  and not exists (select 1 from jsonb_array_elements(current_setting('test.claim1')::jsonb) c, jsonb_each_text(c) kv
                  where kv.key <> 'to_email' and kv.value like '%@%'),
  'each claimed nudge carries the recipient''s own address and no other');

-- 32. Nothing in the nudge functions touches an assignment or a reservation.
select ok(
  not exists (
    select 1 from pg_proc p
    where p.oid in ('public.send_nudge(uuid, uuid[])'::regprocedure, 'public.undo_nudge(uuid)'::regprocedure,
                    'public.claim_due_emails(integer)'::regprocedure,
                    'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)'::regprocedure)
      and (p.prosrc ilike '%assign%' or p.prosrc ilike '%reserv%')),
  'the nudge and sender functions read no assignment and no reservation');

select * from finish();
rollback;
