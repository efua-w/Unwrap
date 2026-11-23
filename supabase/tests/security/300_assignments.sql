-- 300_assignments — slice 10 (GCO-011 manual draw, GC-014 reveal; plan §5, §6 invariants 1, 2, 4; owner decisions
-- 2026-11-22 Q1a in docs/tasks/slice-10.md).
-- Covers (AC-1, AC-11): private.assignments is closed to both API roles (no grant, RLS on, no policy: 42501 on select,
-- insert, update and delete, not zero rows); the table holds exactly the approved columns and member ids (no user id);
-- a giver never takes themself; one CURRENT row per giver (a superseded row does not count); a row is immutable: it can
-- never be deleted, and only superseded_at (once), revealed_at (once) and list_last_opened_at can change.
-- Self-contained: creates its own users inside the transaction (needs the migrations through the draw_and_reveal one
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T300" because dev holds other data.
-- Written BEFORE the draw_and_reveal migration: until it is applied the first statement that names private.assignments
-- fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 17", "1..17", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

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
  select format('select public.create_exchange(%L, %L, %L, current_date + 10, %L, %L, current_date + 20, %L, true, false)',
    p_name, null, '10k_20k', 'organiser_chooses', '18:00', 'Africa/Lagos')
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

-- u(n) is persona n: 1 Ada (organiser), 2 Bola, 3 Chi, 4 Dayo (members of P).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('30' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.mid(nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = current_setting('test.ex_p')::uuid and p.display_name = nm
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u300-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo'])[i]))
  from generate_series(1, 4) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T300 Assignments'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T300 Assignments'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3, 4]) n;
end $fx$;

-- 1. The table exists with RLS on and NO policy and no grant: the only readers are the definer functions.
select ok(
  (select relrowsecurity from pg_class where oid = 'private.assignments'::regclass)
  and not exists (select 1 from pg_policy where polrelid = 'private.assignments'::regclass)
  and not has_table_privilege('anon', 'private.assignments', 'select, insert, update, delete, truncate, references, trigger')
  and not has_table_privilege('authenticated', 'private.assignments', 'select, insert, update, delete, truncate, references, trigger')
  and not has_any_column_privilege('anon', 'private.assignments', 'select, insert, update, references')
  and not has_any_column_privilege('authenticated', 'private.assignments', 'select, insert, update, references'),
  'private.assignments has RLS on, no policy and no grant for anon or authenticated');

-- 2. WHY an exact column list: member ids only (never a person id), and nothing that could hold a name or a message.
select is(
  (select string_agg(column_name, ',' order by ordinal_position)
   from information_schema.columns where table_schema = 'private' and table_name = 'assignments'),
  'id,exchange_id,giver_member_id,receiver_member_id,draw_round,kind,created_at,superseded_at,revealed_at,list_last_opened_at,ref_salt',
  'the table holds exactly the approved columns: member ids, no user id, no name');

-- 3-4. AC-1: a signed-in person and a visitor are refused (42501) on every statement, not given zero rows.
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from private.assignments')
  || '/' || pg_temp.try_as(pg_temp.u(1), format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 1, ''full'')',
      current_setting('test.ex_p'), pg_temp.mid('Bola'), pg_temp.mid('Chi')))
  || '/' || pg_temp.try_as(pg_temp.u(1), 'update private.assignments set revealed_at = now()')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'delete from private.assignments'),
  'err:42501/err:42501/err:42501/err:42501',
  'a signed-in person (the organiser) is refused (42501) selecting, inserting, updating and deleting private.assignments');
select is(
  pg_temp.try_as(null, 'select * from private.assignments')
  || '/' || pg_temp.try_as(null, format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 1, ''full'')',
      current_setting('test.ex_p'), pg_temp.mid('Bola'), pg_temp.mid('Chi')))
  || '/' || pg_temp.try_as(null, 'update private.assignments set revealed_at = now()')
  || '/' || pg_temp.try_as(null, 'delete from private.assignments'),
  'err:42501/err:42501/err:42501/err:42501',
  'a visitor is refused (42501) selecting, inserting, updating and deleting private.assignments');

-- 5. Rows are written by the migration role only (the draw is a definer function). Three people in a ring.
do $fx$ begin
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Ada'), pg_temp.mid('Bola'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Bola'), pg_temp.mid('Chi'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Chi'), pg_temp.mid('Ada'), 1, 'full');
end $fx$;
select is(
  (select count(*)::text || ':' || count(*) filter (where ref_salt ~ '^[0-9a-f]{32}$')::text || ':'
          || count(distinct ref_salt)::text || ':' || count(*) filter (where superseded_at is null and revealed_at is null and list_last_opened_at is null)::text
   from private.assignments where exchange_id = current_setting('test.ex_p')::uuid),
  '3:3:3:3', 'rows get a random 32-character hex salt each and start current, unrevealed and unopened');

-- 6. A giver never takes themself (23514).
select is(
  pg_temp.owner_try(format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 1, ''full'')',
    current_setting('test.ex_p'), pg_temp.mid('Dayo'), pg_temp.mid('Dayo'))),
  '23514', 'a giver cannot be their own receiver');

-- 7. One CURRENT row per giver (23505).
select is(
  pg_temp.owner_try(format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 2, ''rematch'')',
    current_setting('test.ex_p'), pg_temp.mid('Ada'), pg_temp.mid('Chi'))),
  '23505', 'a giver with a current row cannot be given a second one');

-- 8. The kind is one of the three approved values (22P02, an invalid enum value).
select is(
  pg_temp.owner_try(format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 1, ''secret'')',
    current_setting('test.ex_p'), pg_temp.mid('Dayo'), pg_temp.mid('Ada'))),
  '22P02', 'the kind is full, rematch or assignment and nothing else');

-- 9. AC-11: a row can never be deleted, not even by the owner role.
select is(
  pg_temp.owner_try('delete from private.assignments')
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid),
  '23001/3', 'deleting an assignment is refused and every row is still there');

-- 10. AC-11: who gives to whom, which draw, which kind, which exchange, the salt and the creation time never change.
select is(
  pg_temp.owner_try(format('update private.assignments set giver_member_id = %L where giver_member_id = %L', pg_temp.mid('Dayo'), pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set receiver_member_id = %L where giver_member_id = %L', pg_temp.mid('Dayo'), pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set draw_round = 9 where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set kind = ''rematch'' where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set ref_salt = repeat(''a'', 32) where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set exchange_id = %L where giver_member_id = %L', gen_random_uuid(), pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set created_at = now() + interval ''1 day'' where giver_member_id = %L', pg_temp.mid('Ada'))),
  '23001/23001/23001/23001/23001/23001/23001',
  'giver, receiver, round, kind, salt, exchange and creation time cannot be updated');

-- 11. An allowed column does not smuggle a forbidden one in the same statement.
select is(
  pg_temp.owner_try(format('update private.assignments set revealed_at = now(), receiver_member_id = %L where giver_member_id = %L', pg_temp.mid('Dayo'), pg_temp.mid('Ada')))
  || '/' || (select count(*)::text from private.assignments where revealed_at is not null and exchange_id = current_setting('test.ex_p')::uuid),
  '23001/0', 'changing an allowed column and a forbidden one together is refused and nothing changes');

-- 12. list_last_opened_at is a plain "last seen" stamp: it can change as often as the app needs.
select is(
  pg_temp.owner_try(format('update private.assignments set list_last_opened_at = now() where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set list_last_opened_at = now() + interval ''1 hour'' where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set list_last_opened_at = null where giver_member_id = %L', pg_temp.mid('Ada'))),
  'ok/ok/ok', 'list_last_opened_at can be set and changed');

-- 13. revealed_at is set once: setting it again to the same instant is no change, any other value is refused.
select is(
  pg_temp.owner_try(format('update private.assignments set revealed_at = now() where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set revealed_at = now() where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set revealed_at = now() + interval ''1 minute'' where giver_member_id = %L', pg_temp.mid('Ada')))
  || '/' || pg_temp.owner_try(format('update private.assignments set revealed_at = null where giver_member_id = %L', pg_temp.mid('Ada'))),
  'ok/ok/23001/23001', 'revealed_at is set once and then can neither move nor be cleared');

-- 14. superseded_at is set once, the same way.
select is(
  pg_temp.owner_try(format('update private.assignments set superseded_at = now() where giver_member_id = %L', pg_temp.mid('Bola')))
  || '/' || pg_temp.owner_try(format('update private.assignments set superseded_at = now() + interval ''1 minute'' where giver_member_id = %L', pg_temp.mid('Bola')))
  || '/' || pg_temp.owner_try(format('update private.assignments set superseded_at = null where giver_member_id = %L', pg_temp.mid('Bola'))),
  'ok/23001/23001', 'superseded_at is set once and then can neither move nor be cleared (a row cannot come back)');

-- 15. A superseded row frees the giver: a new current row for the same giver is allowed, the old one stays.
-- WHY the insert is its own statement: a count in the same select uses that statement's snapshot and cannot see the row.
do $fx$ begin
  perform set_config('test.try15', pg_temp.owner_try(format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 2, ''rematch'')',
    current_setting('test.ex_p'), pg_temp.mid('Bola'), pg_temp.mid('Dayo'))), true);
end $fx$;
select is(
  current_setting('test.try15')
  || '/' || (select count(*)::text from private.assignments where giver_member_id = pg_temp.mid('Bola')),
  'ok/2', 'a giver can be given a new current row once the old one is superseded, and the old one is kept');

-- 16. Foreign keys: the rows follow real members of a real exchange (23503), and there is no cascade to remove them.
select is(
  pg_temp.owner_try(format('insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values (%L, %L, %L, 1, ''full'')',
    current_setting('test.ex_p'), gen_random_uuid(), pg_temp.mid('Ada')))
  || '/' || (select count(*)::text from pg_constraint c
             where c.conrelid = 'private.assignments'::regclass and c.contype = 'f' and c.confdeltype <> 'a'),
  '23503/0', 'a giver must be a real member, and no foreign key cascades or nulls on delete (never-do 8)');

-- 17. The immutability trigger is the one defence that also binds the owner role: it is on the table, before update and
-- delete, and the app role never has a grant to bypass it.
select ok(
  -- tgtype bits: 1 row, 2 before, 8 delete, 16 update.
  exists (select 1 from pg_trigger t
   where t.tgrelid = 'private.assignments'::regclass and not t.tgisinternal
     and (t.tgtype & 1) = 1 and (t.tgtype & 2) = 2 and (t.tgtype & 8) = 8 and (t.tgtype & 16) = 16),
  'a BEFORE trigger guards updates and deletes on private.assignments');

select * from finish();
rollback;
