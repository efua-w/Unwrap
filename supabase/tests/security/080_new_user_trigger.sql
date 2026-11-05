-- 080_new_user_trigger — slice 1 (GC-003, GC-005): creating an auth user creates their profile and
-- settings rows, and never falls back to the email for a name.
-- Self-contained: creates its own users inside the transaction (needs the profiles/settings
-- migration applied, not seed.sql). Everything rolls back.
-- Pass: "ok 1".."ok 17", "1..17", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

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

-- 1-4. The happy path: exactly one profile and one settings row, named from first_name, trimmed.
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000021', 'chi-080@example.test', '{"first_name":"  Chi  "}');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-4000-8000-000000000021'),
  1, 'a new user gets exactly one profile');
select is((select count(*)::int from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000021'),
  1, 'a new user gets exactly one settings row');
select is((select display_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000021'),
  'Chi', 'the display name is the sign-up first name, trimmed');
select ok((select display_name not like '%@%' from public.profiles where id = 'b0000000-0000-4000-8000-000000000021'),
  'the display name is never the email');

-- 5-9. Sign-up is refused, and no user is left behind, when the name is missing or unusable.
select throws_ok(
  $$select pg_temp.mk_user('b0000000-0000-4000-8000-000000000022', 'noname-080@example.test', '{}')$$,
  '23514', null, 'a user with no first_name is refused');
select throws_ok(
  $$select pg_temp.mk_user('b0000000-0000-4000-8000-000000000023', 'blank-080@example.test', '{"first_name":"   "}')$$,
  '23514', null, 'a blank first_name is refused');
select throws_ok(
  $$select pg_temp.mk_user('b0000000-0000-4000-8000-000000000024', 'long-080@example.test', jsonb_build_object('first_name', repeat('a', 51)))$$,
  '23514', null, 'a 51-character first_name is refused');
select throws_ok(
  $$select pg_temp.mk_user('b0000000-0000-4000-8000-000000000025', 'num-080@example.test', '{"first_name":123}')$$,
  '23514', null, 'a first_name that is not a string is refused');
select is((select count(*)::int from auth.users where id::text like 'b0000000-0000-4000-8000-00000000002%' and id <> 'b0000000-0000-4000-8000-000000000021'),
  0, 'the refused sign-ups left no auth user behind');

-- 10. A 50-emoji first name is accepted: the limit counts code points.
select lives_ok(
  $$select pg_temp.mk_user('b0000000-0000-4000-8000-000000000026', 'emoji-080@example.test', jsonb_build_object('first_name', repeat(chr(128512), 50)))$$,
  'a 50-emoji first_name is accepted');

-- 11-14. The trigger functions are not an API: nobody but the owner can execute them.
select ok(not has_function_privilege('anon', 'private.handle_new_user()', 'execute'),
  'anon cannot execute handle_new_user');
select ok(not has_function_privilege('authenticated', 'private.handle_new_user()', 'execute'),
  'authenticated cannot execute handle_new_user');
select ok(not has_function_privilege('anon', 'private.check_timezone()', 'execute')
  and not has_function_privilege('authenticated', 'private.check_timezone()', 'execute'),
  'neither API role can execute check_timezone');
select ok(not has_function_privilege('anon', 'private.set_updated_at()', 'execute')
  and not has_function_privilege('authenticated', 'private.set_updated_at()', 'execute'),
  'neither API role can execute set_updated_at');

-- 15. handle_new_user is SECURITY DEFINER with an empty search_path (also covered generically by 040).
select ok(
  (select p.prosecdef and 'search_path=""' = any (p.proconfig)
   from pg_proc p where p.oid = 'private.handle_new_user()'::regprocedure),
  'handle_new_user is SECURITY DEFINER with search_path set to empty');

-- 16. The trigger is attached to auth.users, fires after insert (tgtype bit 4 = INSERT, bit 2 = BEFORE), and is enabled.
select is(
  (select count(*)::int from pg_trigger
   where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
     and tgenabled = 'O' and (tgtype & 4) = 4 and (tgtype & 2) = 0),
  1, 'on_auth_user_created is an enabled AFTER INSERT trigger on auth.users');

-- 17. Only the two accepted sign-ups (Chi and the emoji name) have profiles.
select is(
  (select count(*)::int from public.profiles p
   where p.id::text like 'b0000000-0000-4000-8000-00000000002%'),
  2, 'only the two accepted sign-ups have profiles');

select * from finish();
rollback;
