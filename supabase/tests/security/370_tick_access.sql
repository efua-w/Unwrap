-- 370_tick_access — slice 12 (GCO-011 scheduled draw, GC-026 reminders, GCO-015 auto-complete; plan §6 invariants 9, 11, 12;
-- owner decisions 2026-11-24 Q1-Q12 in docs/tasks/slice-12.md).
-- Covers (AC-1, AC-2, AC-9): private.tick and private.run_draw are SECURITY DEFINER with an empty search_path, executable by no
-- API role at all (anon, signed-in people AND service_role: 42501 for each), and neither takes or returns an address, a pair, a
-- member id or a person id; tick takes the advisory lock with the non-blocking function, so a second run returns at once; the
-- lock key is held after a run; two runs with nothing to do write nothing; the organiser's read of the blocked reason is a
-- definer function for signed-in people only; the claim keeps its exact columns plus one (revealed) and stays service_role only;
-- the outbox has for_at and the three new templates; the writer has one signature and no API role may run it; the two indexes
-- exist; the blocked reason check exists.
-- NOT here: a check that no migration schedules a cron job (a pgTAP test cannot read the migration files, and a check on
-- cron.job would fail on dev once the owner schedules it on purpose). Owner decision Q2; checked by reading the migration.
-- WHY the exchanges are parked first: tick looks at every exchange. All of them are cancelled inside this transaction (it rolls
-- back), so a run here touches nothing real.
-- Self-contained: needs the migrations through scheduled_jobs applied, not seed.sql. Everything rolls back.
-- Written BEFORE the scheduled_jobs migration: until it is applied the first statement that names private.tick fails and the
-- run stops. That is the expected "red".
-- Pass: "ok 1".."ok 14", "1..14", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
create function pg_temp.try_as(who uuid, stmt text) returns text
language plpgsql as $$
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
    reset role;
    return 'ok';
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

-- try_svc runs a statement as service_role: 'ok' or 'err:<SQLSTATE>'.
create function pg_temp.try_svc(stmt text) returns text
language plpgsql as $$
begin
  set local role service_role;
  set local request.jwt.claims = '{"role":"service_role"}';
  begin
    execute stmt;
    reset role;
    return 'ok';
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

-- 1. Shape: both are SECURITY DEFINER with an empty search_path; tick also carries a statement timeout.
select ok(
  (select count(*) = 2 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
          and bool_and(p.proname <> 'tick' or exists (select 1 from unnest(p.proconfig) c where c like 'statement_timeout=%'))
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace and p.proname in ('tick', 'run_draw')),
  'private.tick and private.run_draw are SECURITY DEFINER with an empty search_path, and tick has a statement timeout');

-- 2. AC-1: no API role can execute them, nor the helpers the job uses (effective privilege, PUBLIC included).
select ok(
  not has_function_privilege('anon', 'private.tick()', 'execute')
  and not has_function_privilege('authenticated', 'private.tick()', 'execute')
  and not has_function_privilege('service_role', 'private.tick()', 'execute')
  and not has_function_privilege('anon', 'private.run_draw(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.run_draw(uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.run_draw(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.reminder_window(date, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.reminder_window(date, text)', 'execute')
  and not has_function_privilege('service_role', 'private.reminder_window(date, text)', 'execute')
  and not has_function_privilege('anon', 'private.reveal_flag(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.reveal_flag(uuid, uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.reveal_flag(uuid, uuid)', 'execute'),
  'anon, signed-in people and service_role can execute none of tick, run_draw, reminder_window and reveal_flag');

-- 3. AC-1: calling them is refused (42501) for every role, whatever the exchange.
select is(
  pg_temp.try_as(null, 'select * from private.tick()')
  || '/' || pg_temp.try_as('b0000000-0000-4000-8000-000000003701'::uuid, 'select * from private.tick()')
  || '/' || pg_temp.try_svc('select * from private.tick()')
  || '/' || pg_temp.try_as(null, 'select * from private.run_draw(gen_random_uuid())')
  || '/' || pg_temp.try_as('b0000000-0000-4000-8000-000000003701'::uuid, 'select * from private.run_draw(gen_random_uuid())')
  || '/' || pg_temp.try_svc('select * from private.run_draw(gen_random_uuid())'),
  'err:42501/err:42501/err:42501/err:42501/err:42501/err:42501',
  'a visitor, a signed-in person and service_role are refused (42501) on tick and on run_draw');

-- 4. AC-9: no argument or result column of the two is named for an address.
select ok(
  not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'private'::regnamespace and p.proname in ('tick', 'run_draw', 'reminder_window')
      and (coalesce(p.proargnames::text, '') ilike '%email%' or pg_get_function_result(p.oid) ilike '%email%')),
  'no argument or result column of tick, run_draw or reminder_window is called email');

-- 5. AC-9: what comes back. WHY exact strings: a column that could hold a person or a pair must be added on purpose, with this
-- test changed in the open. Counts and an outcome only.
select is(
  pg_get_function_result('private.tick()'::regprocedure)
  || '/' || pg_get_function_result('private.run_draw(uuid)'::regprocedure)
  || '/' || pg_get_function_result('private.reminder_window(date, text)'::regprocedure),
  'TABLE(ran boolean, drawn integer, blocked integer, reminders integer, completed integer)'
  || '/' || 'TABLE(outcome text, people_count integer, pairs_excluded integer, told integer)'
  || '/' || 'TABLE(opens_at timestamp with time zone, closes_at timestamp with time zone)',
  'tick returns counts, run_draw an outcome and counts, reminder_window two moments: no person, no pair');

-- 6. AC-2: two runs at once. One session cannot hold a lock against itself, so the second-run behaviour is asserted from the
-- source: the non-blocking function is used (never the blocking one), and the loser returns ran = false before any work.
select ok(
  (select p.prosrc ilike '%pg_try_advisory_xact_lock%'
          and p.prosrc not ilike '%pg_advisory_xact_lock(%'
          and p.prosrc ilike '%ran := false%'
          and position('ran := false' in p.prosrc) < position('for r in' in p.prosrc)
   from pg_proc p where p.oid = 'private.tick()'::regprocedure),
  'tick takes the advisory lock without waiting and returns ran = false before doing any work');

-- 7. AC-2: park every exchange (this rolls back), run twice. Both runs ran, did nothing, and this transaction holds the lock key.
do $fx$ begin
  update public.exchanges set cancelled_at = now() where cancelled_at is null;
end $fx$;
do $fx$ begin
  perform set_config('test.t1', (select format('%s/%s/%s/%s/%s', ran::text, drawn, blocked, reminders, completed) from private.tick()), true);
  perform set_config('test.t2', (select format('%s/%s/%s/%s/%s', ran::text, drawn, blocked, reminders, completed) from private.tick()), true);
end $fx$;
select is(
  current_setting('test.t1') || '|' || current_setting('test.t2') || '|'
  || (select exists (
        select 1 from pg_locks l
        where l.locktype = 'advisory' and l.pid = pg_backend_pid()
          and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('unwrap:tick', 0)))::text,
  'true/0/0/0/0|true/0/0/0/0|true',
  'two runs with nothing to do both ran, wrote nothing, and the transaction holds the tick lock');

-- 8. Q5: the organiser's read of the blocked reason is a definer function for signed-in people only (who reads what: test 380).
select ok(
  (select count(*) = 1 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
                                    and pg_get_function_result(p.oid) = 'TABLE(reason text)')
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_draw_blocked_reason')
  and not has_function_privilege('anon', 'public.get_draw_blocked_reason(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_draw_blocked_reason(uuid)', 'execute'),
  'get_draw_blocked_reason is SECURITY DEFINER with an empty search_path, returns one text column, and is for signed-in people only');

-- 9. AC-9: the claim has exactly the columns it had plus revealed (E24 only: the reader''s own reveal flag). WHY exact: a new
-- column must be added on purpose, here, in the open.
select is(
  pg_get_function_result('public.claim_due_emails(integer)'::regprocedure),
  'TABLE(id uuid, template text, to_email text, to_name text, to_timezone text, exchange_id uuid, exchange_name text, other_name text, '
  || 'invite_token text, attempts integer, budget_preset text, join_by_at timestamp with time zone, gift_day date, note text, '
  || 'draw_mode text, draw_at timestamp with time zone, people_count integer, revealed boolean)',
  'the claim returns its old columns and one more, revealed: no pair, no giver, no receiver, no second address');

-- 10. The claim and the result write-back stay for the sender only.
select ok(
  has_function_privilege('service_role', 'public.claim_due_emails(integer)', 'execute')
  and not has_function_privilege('anon', 'public.claim_due_emails(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_due_emails(integer)', 'execute')
  and (select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'claim_due_emails'),
  'claim_due_emails is for service_role only and has one signature');

-- 11. The outbox: for_at, and E15, E23 and E24 beside the old templates.
select ok(
  exists (select 1 from information_schema.columns
           where table_schema = 'private' and table_name = 'email_outbox' and column_name = 'for_at'
             and data_type = 'timestamp with time zone')
  and (select pg_get_constraintdef(c.oid) like '%''E15''%' and pg_get_constraintdef(c.oid) like '%''E23''%'
              and pg_get_constraintdef(c.oid) like '%''E24''%' and pg_get_constraintdef(c.oid) like '%''E06''%'
              and pg_get_constraintdef(c.oid) like '%''E19''%' and pg_get_constraintdef(c.oid) like '%''E21''%'
       from pg_constraint c where c.conrelid = 'private.email_outbox'::regclass and c.conname = 'email_outbox_template_known'),
  'email_outbox has for_at, and E15, E23 and E24 are known templates beside the old ones');

-- 12. The writer keeps its one signature (eight arguments, as 220 and 270 pin) and no API role can run it.
select ok(
  (select count(*) = 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'enqueue_email')
  and to_regprocedure('private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)') is not null
  and not has_function_privilege('anon', 'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)', 'execute'),
  'private.enqueue_email has one signature and no API role can run it');

-- 13. The job's two indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exchanges' and indexdef like '%(join_by_at)%')
  and exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exchanges' and indexdef like '%(gift_day)%'),
  'exchanges has an index on join_by_at and one on gift_day');

-- 14. The blocked reason can only be few or exclusions (what it holds is tested in 380).
select ok(
  (select pg_get_constraintdef(c.oid) like '%''few''%' and pg_get_constraintdef(c.oid) like '%''exclusions''%'
   from pg_constraint c where c.conrelid = 'public.exchanges'::regclass and c.conname = 'exchanges_draw_blocked_reason_known'),
  'exchanges.draw_blocked_reason is checked against few and exclusions');

select * from finish();
rollback;
