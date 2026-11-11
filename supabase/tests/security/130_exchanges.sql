-- 130_exchanges — slice 4 (GCO-001, GCO-002, GCO-003, GCO-004, GC-008, GC-013; plan §5 "exchanges" and
-- "exchange_members", §6 invariants 2 and 8).
-- Self-contained: creates its own users inside the transaction (needs the profiles, wishlists and
-- exchanges migrations applied, not seed.sql), so it runs as plain SQL on the hosted dev project and
-- under `supabase test db`. Everything rolls back.
-- Written BEFORE the exchanges migration: until that is applied the first statement that names
-- public.exchanges fails (relation does not exist) and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 80", "1..80", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(80);

-- Same helpers as 060/090 (inline so the file runs on its own); nothing is left in `public`
-- (it would break the function allowlist test 030).
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

-- hint_as is try_as for signed-in people that also reports the error hint, which is how
-- create_exchange says which field was wrong: 'ok' or 'err:<SQLSTATE>/<hint>'.
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

-- val_as returns one value read as a signed-in persona.
create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
  begin
    execute format('select (%s)::text', expr) into v;
    reset role;
    return v;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

-- mk builds the create_exchange call. Defaults are a valid "At join-by time" exchange; dates are SQL
-- expressions (text) so the test never goes stale. Lagos is UTC+1 all year, and every default date
-- is days away, so the session's current_date cannot flip a result.
create function pg_temp.mk(
  p_name text,
  p_note text default null,
  p_budget text default '10k_20k',
  jb text default 'current_date + 10',
  mode text default 'at_join_by',
  dtime text default '18:00',
  ev text default 'current_date + 20',
  etime text default '15:00',
  tz text default 'Africa/Lagos',
  taking text default 'true',
  approval text default 'false'
) returns text
language sql as $$
  select format('select public.create_exchange(%L, %L, %L, %s, %L, %L, %s, %L, %L, %s, %s)',
    p_name, p_note, p_budget, jb, mode, dtime, ev, etime, tz, taking, approval)
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

-- Ada (organiser), Bola (active member), Chi (outsider), Dayo (left), Eze (second organiser, tints).
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001301', 'ada-130@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001302', 'bola-130@example.test', '{"first_name":"Bola"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001303', 'chi-130@example.test', '{"first_name":"Chi"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001304', 'dayo-130@example.test', '{"first_name":"Dayo"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001305', 'eze-130@example.test', '{"first_name":"Eze"}');

-- 1-3. Shape: RLS on both tables; no cascade on any foreign key (never-do 8); invite tokens unique.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.exchanges'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.exchange_members'::regclass),
  'exchanges and exchange_members have row level security enabled');
select ok(
  (select count(*) > 0 and bool_and(confdeltype = 'a') from pg_constraint
   where contype = 'f' and conrelid in ('public.exchanges'::regclass, 'public.exchange_members'::regclass)),
  'every foreign key on exchanges and exchange_members is no action on delete (no cascade)');
select ok(exists (
  select 1 from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
  where i.indrelid = 'public.exchanges'::regclass and i.indisunique and i.indnatts = 1
    and a.attname = 'invite_token'),
  'invite_token has a unique index');

-- 4-7. Visitors are refused outright and cannot call any exchange function; signed-in people can.
select is(pg_temp.try_as(null, 'select 1 from public.exchanges'), 'err:42501', 'anon cannot read exchanges');
select is(pg_temp.try_as(null, 'select 1 from public.exchange_members'), 'err:42501', 'anon cannot read exchange_members');
select ok(
  not has_function_privilege('anon', 'public.is_member(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.is_organiser(uuid)', 'execute')
  and not has_function_privilege('anon',
    'public.create_exchange(text,text,public.exchange_budget_preset,date,public.exchange_draw_mode,time without time zone,date,time without time zone,text,boolean,boolean)',
    'execute')
  and not has_function_privilege('anon', 'public.exchange_state(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_exchange_invite_token(uuid)', 'execute'),
  'anon cannot execute any exchange function');
select ok(
  has_function_privilege('authenticated', 'public.is_member(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.is_organiser(uuid)', 'execute')
  and has_function_privilege('authenticated',
    'public.create_exchange(text,text,public.exchange_budget_preset,date,public.exchange_draw_mode,time without time zone,date,time without time zone,text,boolean,boolean)',
    'execute')
  and has_function_privilege('authenticated', 'public.exchange_state(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_exchange_invite_token(uuid)', 'execute'),
  'authenticated can execute the exchange functions');

-- 8-9. Create (GCO-001..003), "At join-by time": every value is computed in Postgres from the dates,
-- times and zone, never sent as a timestamp.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Office Secret Santa')),
  'ok:1', 'a signed-in person can create an exchange');
select set_config('test.ex_a', (select id::text from public.exchanges where name = 'Office Secret Santa'), true);
select is(
  (select format('%s/%s/%s/%s/%s/%s/%s/%s/%s/%s',
     organiser_id, coalesce(note, 'null'), budget_preset, draw_mode, organiser_tz,
     approval_required::text, draw_round, (cancelled_at is null and completed_at is null
       and reopened_join_by_at is null and draw_blocked_reason is null)::text,
     (join_by_at = ((current_date + 10) + time '18:00') at time zone 'Africa/Lagos'
       and draw_at = join_by_at
       and event_at = ((current_date + 20) + time '15:00') at time zone 'Africa/Lagos')::text,
     (invite_token ~ '^[0-9a-f]{32}$')::text)
   from public.exchanges where id = current_setting('test.ex_a')::uuid),
  'b0000000-0000-4000-8000-000000001301/null/10k_20k/at_join_by/Africa/Lagos/false/0/true/true/true',
  'the exchange stores the caller as organiser, the zone, the computed join-by = draw = date + time in that zone, and a 32-hex token');

-- 10. The organiser always gets a member row (taking part here).
select is(
  (select format('%s/%s/%s', count(*), bool_and(state = 'active' and user_id = 'b0000000-0000-4000-8000-000000001301')::text, bool_and(taking_part)::text)
   from public.exchange_members where exchange_id = current_setting('test.ex_a')::uuid),
  '1/true/true', 'creating an exchange adds exactly one active member row, the organiser, taking part');

-- 11-13. "When I choose": join closes at the end of the join-by day (next local midnight), no draw
-- date, the draw time is ignored; the organiser can just organise (taking_part false).
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  pg_temp.mk('Family', mode => 'organiser_chooses', taking => 'false')),
  'ok:1', 'a person can create a "When I choose" exchange');
select is(
  (select format('%s/%s/%s', draw_mode,
     (join_by_at = (current_date + 11)::timestamp at time zone 'Africa/Lagos' and draw_at is null)::text,
     (select taking_part::text from public.exchange_members m where m.exchange_id = e.id))
   from public.exchanges e where name = 'Family'),
  'organiser_chooses/true/false',
  'manual draw: join closes at the next local midnight after the join-by day, draw_at is null, the draw time is ignored, taking_part is kept');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  pg_temp.mk('Today', mode => 'organiser_chooses', jb => '(now() at time zone ''Africa/Lagos'')::date', ev => 'current_date + 5')),
  'ok:1', 'a manual-draw exchange may close joining at the end of today (the join-by day is a local date)');
select set_config('test.ex_b', (select id::text from public.exchanges where name = 'Family'), true);

-- 14-16. Input is trimmed and bounded: name 1 to 40, note 1 to 280 or none.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('  Padded  ', p_note => '  hello  ')),
  'ok:1', 'a name and note with surrounding spaces are accepted');
select is(
  (select format('[%s]/[%s]', name, note) from public.exchanges where name = 'Padded'),
  '[Padded]/[hello]', 'the name and note are stored trimmed');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('BlankNote', p_note => '   ')),
  'ok:1', 'a blank note is accepted');
select ok((select note is null from public.exchanges where name = 'BlankNote'), 'a blank note is stored as no note');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk(repeat('a', 40))),
  'ok:1', 'a 40-character name is accepted');

-- Remember how many exchanges Ada has, to prove every refusal below writes nothing.
select set_config('test.ada_count', (select count(*)::text from public.exchanges
  where organiser_id = 'b0000000-0000-4000-8000-000000001301'), true);

-- 19-33. Refusals: SQLSTATE 22023 with the field as the hint.
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('   ')),
  'err:22023/name', 'a blank name is refused (hint name)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk(null)),
  'err:22023/name', 'a missing name is refused (hint name)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk(repeat('a', 41))),
  'err:22023/name', 'a 41-character name is refused (hint name)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Long note', p_note => repeat('n', 281))),
  'err:22023/note', 'a 281-character note is refused (hint note)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('No budget', p_budget => null)),
  'err:22023/budget', 'a missing budget is refused (hint budget)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Odd budget', p_budget => 'free')),
  'err:22P02', 'an unknown budget value is refused by the enum');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Past join', jb => 'current_date - 2')),
  'err:22023/join_by', 'a join-by time in the past is refused (hint join_by)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Past gift', jb => 'current_date - 4', ev => 'current_date - 2')),
  'err:22023/event', 'a gift time in the past is refused (hint event)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Out of order', jb => 'current_date + 20', ev => 'current_date + 10')),
  'err:22023/join_by', 'a join-by time after the gift time is refused (hint join_by)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301',
  pg_temp.mk('Same moment', jb => 'current_date + 10', dtime => '15:00', ev => 'current_date + 10', etime => '15:00')),
  'err:22023/join_by', 'a join-by time equal to the gift time is refused (it must be strictly before)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301',
  pg_temp.mk('Manual same day', mode => 'organiser_chooses', jb => 'current_date + 10', ev => 'current_date + 10')),
  'err:22023/join_by', '"When I choose": a join-by day on the gift day is refused (it must be the day before or earlier)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301',
  pg_temp.mk('Manual past', mode => 'organiser_chooses', jb => 'current_date - 3')),
  'err:22023/join_by', '"When I choose": a join-by day already over is refused (hint join_by)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('Bad zone', tz => 'Mars/Olympus')),
  'err:22023/time_zone', 'an unknown time zone is refused (hint time_zone)');
select is(pg_temp.hint_as('b0000000-0000-4000-8000-000000001301', pg_temp.mk('No zone', tz => null)),
  'err:22023/time_zone', 'a missing time zone is refused (hint time_zone)');
select is(
  (select count(*)::text from public.exchanges where organiser_id = 'b0000000-0000-4000-8000-000000001301'),
  current_setting('test.ada_count'), 'refused calls create no exchange');
select is(
  (select count(*)::int from public.exchange_members m
   where m.user_id = 'b0000000-0000-4000-8000-000000001301'
     and not exists (select 1 from public.exchanges e where e.id = m.exchange_id)),
  0, 'refused calls leave no orphan member row');

-- 36. A caller with no signed-in identity cannot create (execute is already refused for anon; this
-- guards the function body if it is ever reached with no uid).
select is(pg_temp.try_as(null, pg_temp.mk('Visitor')), 'err:42501', 'anon cannot call create_exchange');

-- 37-41. No client writes at all: every change goes through a function (no INSERT, UPDATE or
-- DELETE grant on either table).
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  $$insert into public.exchanges (name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('Direct', '5k_10k', now() + interval '1 day', 'organiser_chooses', null, now() + interval '2 days', 'Africa/Lagos', 'clay')$$),
  'err:42501', 'a user cannot insert an exchange directly');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  format('insert into public.exchange_members (exchange_id, user_id, taking_part) values (%L, %L, true)',
    current_setting('test.ex_b'), 'b0000000-0000-4000-8000-000000001303')),
  'err:42501', 'the organiser cannot add a member row directly (joining is slice 5, by token)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  format('update public.exchanges set name = %L where id = %L', 'Renamed', current_setting('test.ex_a'))),
  'err:42501', 'the organiser cannot update an exchange directly (editing is slice 13, by function)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  format('update public.exchange_members set taking_part = false where exchange_id = %L', current_setting('test.ex_a'))),
  'err:42501', 'a member cannot update a member row directly');
select is(
  pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
    format('delete from public.exchanges where id = %L', current_setting('test.ex_a')))
  || '/' ||
  pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
    format('delete from public.exchange_members where exchange_id = %L', current_setting('test.ex_a'))),
  'err:42501/err:42501', 'nobody can hard-delete an exchange or a member row (no DELETE grant)');

-- Fixtures for the read tests, written as the migration role (joining arrives in slice 5):
-- Bola is an active member of A; Dayo was a member of A and left.
insert into public.exchange_members (exchange_id, user_id, taking_part)
values (current_setting('test.ex_a')::uuid, 'b0000000-0000-4000-8000-000000001302', true);
insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
values (current_setting('test.ex_a')::uuid, 'b0000000-0000-4000-8000-000000001304', true, 'left',
        now() - interval '1 day', now());

-- 42-44. Column grants: the invite token and the leave time are not readable by clients, so
-- `select *` is refused; the token comes only from get_exchange_invite_token.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', 'select * from public.exchanges'),
  'err:42501', 'the organiser cannot select the whole exchanges row (invite_token has no grant)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  format('select invite_token from public.exchanges where id = %L', current_setting('test.ex_a'))),
  'err:42501', 'the organiser cannot read invite_token with a plain select');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301', 'select left_at from public.exchange_members'),
  'err:42501', 'left_at on a member row is not readable by clients');

-- 45-50. Who can read an exchange: its active members (the organiser included), nobody else.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001301',
  format('select id, name, budget_preset, event_at, tint from public.exchanges where id = %L', current_setting('test.ex_a'))),
  'ok:1', 'the organiser can read their exchange');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001302',
  format('select id, name from public.exchanges where id = %L', current_setting('test.ex_a'))),
  'ok:1', 'an active member can read the exchange');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001303',
  format('select id from public.exchanges where id = %L', current_setting('test.ex_a'))),
  'ok:0', 'an outsider cannot read the exchange');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001304',
  format('select id from public.exchanges where id = %L', current_setting('test.ex_a'))),
  'ok:0', 'a person who left cannot read the exchange');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001302',
  format('select id from public.exchanges where id = %L', current_setting('test.ex_b'))),
  'ok:0', 'a member of one exchange cannot read another exchange');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001303', 'select id from public.exchanges'),
  'ok:0', 'an outsider lists no exchanges at all');

-- 51-54. Who can read member rows: co-members see the active people; everyone also sees their own
-- row in any state; outsiders and people who left see no one else.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001302',
  format('select user_id, taking_part, state from public.exchange_members where exchange_id = %L', current_setting('test.ex_a'))),
  'ok:2', 'a member sees the active members of their exchange (and not the person who left)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001303',
  format('select user_id from public.exchange_members where exchange_id = %L', current_setting('test.ex_a'))),
  'ok:0', 'an outsider sees no member rows');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001304',
  format('select user_id from public.exchange_members where exchange_id = %L', current_setting('test.ex_a'))),
  'ok:1', 'a person who left sees only their own row, not the other members');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001302',
  format('select user_id from public.exchange_members where exchange_id = %L', current_setting('test.ex_b'))),
  'ok:0', 'a member of one exchange sees no member rows of another');

-- 55-56. The membership helpers answer only about the caller.
select is(
  pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.is_member(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000001302', format('public.is_member(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000001303', format('public.is_member(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000001304', format('public.is_member(%L)', current_setting('test.ex_a'))),
  'true/true/false/false', 'is_member: organiser and active member yes; outsider and person who left no');
select is(
  pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.is_organiser(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000001302', format('public.is_organiser(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000001303', format('public.is_organiser(%L)', current_setting('test.ex_a'))),
  'true/false/false', 'is_organiser: only the organiser is true');

-- 57-58. The invite token: only the organiser can get it, and one answer for everyone else.
select is(
  pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.get_exchange_invite_token(%L)', current_setting('test.ex_a'))),
  (select invite_token from public.exchanges where id = current_setting('test.ex_a')::uuid),
  'the organiser gets the invite token');
select is(
  pg_temp.try_as('b0000000-0000-4000-8000-000000001302', format('select public.get_exchange_invite_token(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as('b0000000-0000-4000-8000-000000001303', format('select public.get_exchange_invite_token(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as('b0000000-0000-4000-8000-000000001301', $$select public.get_exchange_invite_token('c0000000-0000-4000-8000-0000000013ff')$$)
  || '/' || pg_temp.try_as(null, format('select public.get_exchange_invite_token(%L)', current_setting('test.ex_a'))),
  'err:P0002/err:P0002/err:P0002/err:42501',
  'a member, an outsider and an unknown id all get "not found"; a visitor is refused outright');

-- 59-60. exchange_state is null for anyone who is not an active member, and "open" before the join-by.
select is(
  pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.exchange_state(%L)', current_setting('test.ex_a')))
  || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000001302', format('public.exchange_state(%L)', current_setting('test.ex_a'))),
  'open/open', 'exchange_state is open for the organiser and a member before joining closes');
select is(
  coalesce(pg_temp.val_as('b0000000-0000-4000-8000-000000001303', format('public.exchange_state(%L)', current_setting('test.ex_a'))), 'null')
  || '/' || coalesce(pg_temp.val_as('b0000000-0000-4000-8000-000000001304', format('public.exchange_state(%L)', current_setting('test.ex_a'))), 'null'),
  'null/null', 'exchange_state is null for an outsider and for a person who left');

-- 61-66. The state is calculated from the timestamps (plan §3: never stored). Fixtures move the
-- timestamps of B (a manual-draw exchange, so draw_at stays null) as the migration role.
update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_b')::uuid;
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.exchange_state(%L)', current_setting('test.ex_b'))),
  'joining_closed', 'exchange_state is joining_closed once the join-by time has passed');
update public.exchanges set reopened_join_by_at = now() + interval '1 day' where id = current_setting('test.ex_b')::uuid;
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.exchange_state(%L)', current_setting('test.ex_b'))),
  'open', 'exchange_state is open again while a reopened join-by is in the future');
update public.exchanges set reopened_join_by_at = null, join_by_at = now() - interval '2 days',
  event_at = now() - interval '1 minute' where id = current_setting('test.ex_b')::uuid;
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.exchange_state(%L)', current_setting('test.ex_b'))),
  'event_passed', 'exchange_state is event_passed once the gift time has passed');
update public.exchanges set completed_at = now() where id = current_setting('test.ex_b')::uuid;
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.exchange_state(%L)', current_setting('test.ex_b'))),
  'complete', 'exchange_state is complete once completed_at is set');
update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_b')::uuid;
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000001301', format('public.exchange_state(%L)', current_setting('test.ex_b'))),
  'cancelled', 'exchange_state is cancelled, which wins over every other state');

-- 67-73. Table checks, tried as the migration role (clients cannot write these tables at all).
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', 'X', '5k_10k', now() + interval '3 days', 'organiser_chooses', null, now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'an exchange cannot close joining at or after the gift time');
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', 'X', '5k_10k', now() + interval '1 day', 'organiser_chooses', now() + interval '1 day', now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'a manual-draw exchange cannot have a draw time');
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', 'X', '5k_10k', now() + interval '1 day', 'at_join_by', null, now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'an automatic-draw exchange must have a draw time');
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', 'X', '5k_10k', now() + interval '1 day', 'at_join_by', now() + interval '1 day 1 hour', now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'an automatic draw happens exactly at the join-by time');
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', ' X', '5k_10k', now() + interval '1 day', 'organiser_chooses', null, now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'a name with surrounding spaces is refused by the table');
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', 'X', '   ', '5k_10k', now() + interval '1 day', 'organiser_chooses', null, now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'a blank note is refused by the table (no note is null)');
select throws_ok(
  $$insert into public.exchanges (organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint)
    values ('b0000000-0000-4000-8000-000000001301', 'X', repeat('n', 281), '5k_10k', now() + interval '1 day', 'organiser_chooses', null, now() + interval '2 days', 'Africa/Lagos', 'clay')$$,
  '23514', null, 'a 281-character note is refused by the table');

-- 74-75. The invite token is server-made even for a privileged insert; a person has at most one
-- ACTIVE membership per exchange, but a person who left may join again.
insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, event_at, organiser_tz, tint, invite_token)
values ('b0000000-0000-4000-8000-000000001301', 'Token check', '5k_10k', now() + interval '1 day', 'organiser_chooses', null,
        now() + interval '2 days', 'Africa/Lagos', 'clay', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
select ok(
  (select invite_token <> 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' and invite_token ~ '^[0-9a-f]{32}$'
   from public.exchanges where name = 'Token check'),
  'an invite token sent on a privileged insert is overwritten with a random one');
select throws_ok(
  format($$insert into public.exchange_members (exchange_id, user_id, taking_part) values (%L, 'b0000000-0000-4000-8000-000000001302', true)$$,
    current_setting('test.ex_a')),
  '23505', null, 'a person cannot be an active member of the same exchange twice');

-- 76-77. A membership is active exactly when left_at is null.
select throws_ok(
  format($$insert into public.exchange_members (exchange_id, user_id, taking_part, state, left_at) values (%L, 'b0000000-0000-4000-8000-000000001303', true, 'active', now())$$,
    current_setting('test.ex_a')),
  '23514', null, 'an active membership cannot have a left_at');
select throws_ok(
  format($$insert into public.exchange_members (exchange_id, user_id, taking_part, state) values (%L, 'b0000000-0000-4000-8000-000000001303', true, 'removed')$$,
    current_setting('test.ex_a')),
  '23514', null, 'a left or removed membership must have a left_at');

-- 78. Rejoin: Dayo left above, so a new active row is allowed (the partial unique index only covers
-- active rows). Last of the Dayo reads, so the earlier "person who left" checks are unaffected.
select lives_ok(
  format($$insert into public.exchange_members (exchange_id, user_id, taking_part) values (%L, 'b0000000-0000-4000-8000-000000001304', true)$$,
    current_setting('test.ex_a')),
  'a person who left can have a new active membership in the same exchange');

-- 79-82. Tint (owner decision 7): the colour used least among the organiser's LIVE exchanges (not
-- cancelled or completed), ties random. Eze starts four exchanges: all four colours, none repeated.
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001305', pg_temp.mk('T1')); end $fx$;
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001305', pg_temp.mk('T2')); end $fx$;
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001305', pg_temp.mk('T3')); end $fx$;
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001305', pg_temp.mk('T4')); end $fx$;
select is(
  (select count(distinct tint)::int || '/' || count(*) from public.exchanges
   where organiser_id = 'b0000000-0000-4000-8000-000000001305'),
  '4/4', 'four new exchanges by one organiser get four different tints');
-- Cancel T1: its colour is now the only one with no live exchange, so T5 must take it.
select set_config('test.t1_tint', (select tint::text from public.exchanges where name = 'T1'), true);
update public.exchanges set cancelled_at = now() where name = 'T1';
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001305', pg_temp.mk('T5')); end $fx$;
select is((select tint::text from public.exchanges where name = 'T5'), current_setting('test.t1_tint'),
  'a cancelled exchange no longer counts: the next exchange takes the colour it freed');
-- Complete T2: same rule for a completed exchange.
select set_config('test.t2_tint', (select tint::text from public.exchanges where name = 'T2'), true);
update public.exchanges set completed_at = now() where name = 'T2';
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001305', pg_temp.mk('T6')); end $fx$;
select is((select tint::text from public.exchanges where name = 'T6'), current_setting('test.t2_tint'),
  'a completed exchange no longer counts: the next exchange takes the colour it freed');
-- Whoever creates an exchange, the tint is always one of the four approved colours (Bola has one
-- as a member of A, never as organiser, before this).
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001302', pg_temp.mk('Bola first')); end $fx$;
select ok((select tint::text in ('clay', 'peach', 'sand', 'mint') from public.exchanges where name = 'Bola first'),
  'the tint is one of the four approved colours');

select * from finish();
rollback;
