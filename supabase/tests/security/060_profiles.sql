-- 060_profiles — slice 1 (GC-003, GC-005, GC-024; plan §5 "profiles", §6 invariants).
-- Self-contained: creates its own two users inside the transaction (needs the profiles migration
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under
-- `supabase test db`. Everything rolls back.
-- Pass: "ok 1".."ok 22", "1..22", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);

-- WHY: helpers live in pg_temp so nothing is left in `public` (it would break the function
-- allowlist test 030). try_as runs one statement as a persona (null = anon) and reports the
-- outcome as text, so a refusal can be asserted as a SQLSTATE and a hidden row as a zero count.
-- WHY the nested block: the role switch stays outside it, so catching an error does not undo it.
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

-- No passwords, no real addresses: the .test TLD can never reach an inbox. The trigger under test
-- creates each profile and settings row from first_name.
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

select pg_temp.mk_user('b0000000-0000-4000-8000-000000000001', 'ada-060@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000002', 'bola-060@example.test', '{"first_name":"Bola"}');

-- 1-3. Shape: RLS on, and no email anywhere in `public` (the organiser must never see emails).
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has row level security enabled');
select hasnt_column('public', 'profiles', 'email', 'profiles has no email column');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and column_name ilike '%email%'),
  0, 'no table in public has an email column');

-- 4-5. A visitor is refused outright (no grant), not shown zero rows.
select is(pg_temp.try_as(null, 'select 1 from public.profiles'), 'err:42501', 'anon cannot read profiles');
select is(pg_temp.try_as(null, $$update public.profiles set display_name = 'X'$$), 'err:42501', 'anon cannot update profiles');

-- 6-7. Signed in, a person sees only their own row.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001', 'select 1 from public.profiles'),
  'ok:1', 'a user reads exactly one profile row: their own');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$select 1 from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'$$),
  'ok:0', 'a user cannot read another user''s profile');

-- 8-11. A person can change their own name and nobody else's.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set display_name = 'Ada O' where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'ok:1', 'a user can update their own display name');
select is((select display_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000001'),
  'Ada O', 'the own-name update was saved');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set display_name = 'Hacked' where id = 'b0000000-0000-4000-8000-000000000002'$$),
  'ok:0', 'a user cannot update another user''s profile');
select is((select display_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  'Bola', 'the other user''s name is unchanged');

-- 12-16. Column grants: only display_name is writable by the app in this slice.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set avatar_path = 'x' where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:42501', 'a user cannot write avatar_path (photos arrive in a later slice)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set anonymised_at = now() where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:42501', 'a user cannot write anonymised_at');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set id = 'b0000000-0000-4000-8000-000000000009' where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:42501', 'a user cannot change a profile id');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$insert into public.profiles (id, display_name) values ('b0000000-0000-4000-8000-000000000009', 'Mallory')$$),
  'err:42501', 'a user cannot insert profiles (the sign-up trigger does)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$delete from public.profiles where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:42501', 'a user cannot delete a profile');

-- 17-20. Name rules (GC-005): 1 to 50 code points, no surrounding spaces. Emoji count as one each.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set display_name = '   ' where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:23514', 'a blank display name is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set display_name = repeat('a', 51) where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:23514', 'a 51-character display name is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set display_name = ' Ada' where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'err:23514', 'a display name with surrounding spaces is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000001',
  $$update public.profiles set display_name = repeat(chr(128512), 50) where id = 'b0000000-0000-4000-8000-000000000001'$$),
  'ok:1', 'a 50-emoji display name is accepted (counted in code points, not bytes)');

-- 21. updated_at moves on update (the transaction clock is frozen, so it must use the wall clock).
select ok((select updated_at > created_at from public.profiles where id = 'b0000000-0000-4000-8000-000000000001'),
  'updated_at changes when a profile is updated');

-- 22. A profile outlives its auth user: deleting the user is refused while the profile exists,
-- so account deletion has to anonymise the profile first (GC-028, plan §5 "anonymised_at").
select throws_ok(
  $$delete from auth.users where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'profiles.id references auth.users without a cascade');

select * from finish();
rollback;
