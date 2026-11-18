-- 230_email_invites — slice 7 (GCO-005 Invite by email; plan §5, §6; docs/tasks/slice-7.md).
-- CHANGED 2026-11-17 (owner decision, Tobechukwu Olih, after review: invite by email is deferred to a later version).
-- The migration email_invite_off revokes execute on public.send_email_invite from authenticated, so this file now proves
-- the feature is CLOSED, not that it works:
--   * authenticated people (organiser, member, outsider, another organiser, a signed-in person with no exchange) get
--     42501 from send_email_invite, a visitor too, and nothing is written to email_invites or the outbox;
--   * the table stays locked down (RLS on; only the organiser of that exchange reads rows; nobody writes directly), so
--     turning the feature back on later starts from a safe table;
--   * the five cascading foreign keys stay as the owner decided on 2026-11-17 (kept from the earlier version).
-- Removed because the function can no longer be reached by any app role, so they cannot apply (they exercised the
-- function body: trimming and lower-casing, same result with or without an account, member/cancelled/full/invalid
-- refusals with hints, the 20-per-hour limit with P0429, P0002 for non-organisers, the E06 row shape and payload with no
-- address). Re-instate them from git history when the function is granted again, together with the per-address limit
-- (docs/progress.md open item, reviewer R1-1).
-- Self-contained: creates its own users inside the transaction (needs the migrations through email_invite_off applied,
-- not seed.sql). Everything rolls back. Names are prefixed "T230".
-- Pass: "ok 1".."ok 10", "1..10", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

-- Isolation (test setup only; no assertion, value or description changes). WHY: the dev database holds outbox and
-- invite rows from other runs (e2e), which would be counted by the scalar subqueries below. Every row is deleted
-- INSIDE this transaction, which rolls back at the end, so nothing is lost.
delete from private.email_outbox;
delete from public.email_invites;

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

-- inv is the invite statement for one exchange and address.
create function pg_temp.inv(ex uuid, addr text) returns text
language sql as $$
  select format('select public.send_email_invite(%L, %L)', ex, addr)
$$;

create function pg_temp.mk(p_name text, mode text default 'at_join_by', approval text default 'false') returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, %s)',
    p_name, '10k_20k', mode, '18:00', 'Africa/Lagos', approval)
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

-- u(n) is persona n: 1 Ada (organiser of A), 2 Bola (has an account, not in any exchange), 3 Chi (member of A),
-- 4 Dayo (outsider), 5 Ife (organiser of B).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('23' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u230-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Ife'])[i]))
  from generate_series(1, 5) i;
end $fx$;

-- A is Ada's; B is Ife's.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T230 Open'));
  perform pg_temp.try_as(pg_temp.u(5), pg_temp.mk('T230 Other'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_a', (select id::text from public.exchanges where name = 'T230 Open'), true);
  perform set_config('test.ex_b', (select id::text from public.exchanges where name = 'T230 Other'), true);
  -- Chi is a member of A.
  insert into public.exchange_members (exchange_id, user_id, taking_part)
    values (current_setting('test.ex_a')::uuid, pg_temp.u(3), true);
end $fx$;

-- 1-4. Shape and grants. Test 4 CHANGED: it used to say signed-in people can execute; now nobody app-side can.
select ok((select relrowsecurity from pg_class where oid = 'public.email_invites'::regclass),
  'email_invites has row level security enabled');
select ok(
  has_column_privilege('authenticated', 'public.email_invites', 'invited_address', 'select')
  and not has_column_privilege('authenticated', 'public.email_invites', 'sent_by', 'select')
  and not has_any_column_privilege('authenticated', 'public.email_invites', 'insert, update')
  and not has_table_privilege('authenticated', 'public.email_invites', 'delete')
  and not has_any_column_privilege('anon', 'public.email_invites', 'select, insert, update'),
  'signed-in people can read the invite columns but not sent_by, write nothing; a visitor holds no privilege');
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
          and pg_get_function_arguments(p.oid) = 'p_exchange uuid, p_email text'
   from pg_proc p where p.oid = 'public.send_email_invite(uuid, text)'::regprocedure),
  'send_email_invite is SECURITY DEFINER with an empty search_path and takes an exchange and an address, no user id');
select ok(
  not has_function_privilege('anon', 'public.send_email_invite(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.send_email_invite(uuid, text)', 'execute'),
  'neither anon nor signed-in people can execute send_email_invite (invite by email is switched off)');

-- 5-6. CHANGED (was: the organiser invites, others get P0002): every caller is refused with 42501 before the function
-- body runs, so the organiser, a member, an outsider, another organiser and an account holder outside the exchange
-- all get the same answer, and so does a visitor.
select is(
  pg_temp.try_as(null, pg_temp.inv(current_setting('test.ex_a')::uuid, 'visitor-230@example.test'))
  || '/' || pg_temp.try_as(null, 'select 1 from public.email_invites'),
  'err:42501/err:42501', 'a visitor is refused (42501) on the invite function and the table');
select is(
  pg_temp.try_as(pg_temp.u(1), pg_temp.inv(current_setting('test.ex_a')::uuid, 'new-person-230@example.test'))
  || '/' || pg_temp.try_as(pg_temp.u(3), pg_temp.inv(current_setting('test.ex_a')::uuid, 'someone-230@example.test'))
  || '/' || pg_temp.try_as(pg_temp.u(4), pg_temp.inv(current_setting('test.ex_a')::uuid, 'someone-230@example.test'))
  || '/' || pg_temp.try_as(pg_temp.u(5), pg_temp.inv(current_setting('test.ex_a')::uuid, 'someone-230@example.test'))
  || '/' || pg_temp.try_as(pg_temp.u(2), pg_temp.inv(current_setting('test.ex_a')::uuid, 'u230-2@example.test'))
  || '/' || pg_temp.try_as(pg_temp.u(5), pg_temp.inv(current_setting('test.ex_b')::uuid, 'own-230@example.test')),
  'err:42501/err:42501/err:42501/err:42501/err:42501/err:42501',
  'the organiser (on their own exchange too), a member, an outsider, another organiser and an account holder all get 42501');

-- 7. CHANGED (was: one invite and one E06 row are stored): the refused calls wrote nothing anywhere.
select is(
  (select count(*)::int from public.email_invites) || '/'
  || (select count(*)::int from private.email_outbox where template = 'E06'),
  '0/0', 'the refused calls wrote no invite and no E06 row');

-- 8. Nobody writes the table directly (unchanged).
select is(
  pg_temp.try_as(pg_temp.u(1), format($$insert into public.email_invites (exchange_id, invited_address, sent_by) values (%L, 'x@example.test', %L)$$,
    current_setting('test.ex_a'), pg_temp.u(1)))
  || '/' || pg_temp.try_as(pg_temp.u(1), $$update public.email_invites set invited_address = 'y@example.test'$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), $$delete from public.email_invites$$),
  'err:42501/err:42501/err:42501', 'the organiser cannot write email_invites directly (42501)');

-- 9. Who reads email_invites (unchanged assertion, now fed by a row seeded as the table owner because the function can no
-- longer create one): the organiser alone; zero rows (not an error) for everyone else; 42501 for a visitor.
do $fx$ begin
  insert into public.email_invites (exchange_id, invited_address, sent_by)
    values (current_setting('test.ex_a')::uuid, 'seeded-230@example.test', pg_temp.u(1));
end $fx$;
select is(
  pg_temp.try_as(pg_temp.u(1), format('select 1 from public.email_invites where exchange_id = %L', current_setting('test.ex_a')))
  || '/' || pg_temp.try_as(pg_temp.u(3), 'select 1 from public.email_invites')
  || '/' || pg_temp.try_as(pg_temp.u(4), 'select 1 from public.email_invites')
  || '/' || pg_temp.try_as(pg_temp.u(5), 'select 1 from public.email_invites')
  || '/' || pg_temp.try_as(pg_temp.u(2), 'select 1 from public.email_invites')
  || '/' || pg_temp.try_as(null, 'select 1 from public.email_invites'),
  'ok:1/ok:0/ok:0/ok:0/ok:0/err:42501',
  'only the organiser reads the invites: a member, an outsider, another organiser and the person invited read none');

-- 10. Unchanged. Changed 2026-11-17 (owner decision after builder round 2; was NO ACTION): queued emails and invites are
-- deleted with their person or exchange. 250_email_cascade proves the deletes and that nothing else cascades.
select ok(
  (select count(*) = 5 and bool_and(confdeltype = 'c') from pg_constraint
   where contype = 'f' and conrelid in ('public.email_invites'::regclass, 'private.email_outbox'::regclass)),
  'the five foreign keys on email_invites and the outbox cascade on delete (owner decision 2026-11-17)');

select * from finish();
rollback;
