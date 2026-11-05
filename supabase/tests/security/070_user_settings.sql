-- 070_user_settings — slice 1 (plan §5 "user_settings": time zone and notification toggles).
-- Self-contained: creates its own two users inside the transaction (needs the profiles/settings
-- migration applied, not seed.sql). Everything rolls back.
-- Pass: "ok 1".."ok 20", "1..20", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);

-- Same helpers as 060 (kept inline so each file runs on its own). See 060 for the reasoning.
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

select pg_temp.mk_user('b0000000-0000-4000-8000-000000000011', 'ada-070@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000012', 'bola-070@example.test', '{"first_name":"Bola"}');

-- 1. RLS is on.
select ok((select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass),
  'user_settings has row level security enabled');

-- 2-3. A visitor is refused outright.
select is(pg_temp.try_as(null, 'select 1 from public.user_settings'), 'err:42501', 'anon cannot read user_settings');
select is(pg_temp.try_as(null, $$update public.user_settings set timezone = 'UTC'$$), 'err:42501', 'anon cannot update user_settings');

-- 4-5. Defaults written by the sign-up trigger: Lagos and every notification on.
select is((select timezone from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000012'),
  'Africa/Lagos', 'the default time zone is Africa/Lagos');
select ok((select notify_names_drawn and notify_someone_joins and notify_join_by_reminder and notify_event_reminder
           from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000012'),
  'all four notification toggles default to on');

-- 6-7. Own row only.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011', 'select 1 from public.user_settings'),
  'ok:1', 'a user reads exactly one settings row: their own');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$select 1 from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000012'$$),
  'ok:0', 'a user cannot read another user''s settings');

-- 8-11. A person records their own time zone, not anyone else's.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$update public.user_settings set timezone = 'Europe/London' where user_id = 'b0000000-0000-4000-8000-000000000011'$$),
  'ok:1', 'a user can update their own time zone');
select is((select timezone from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000011'),
  'Europe/London', 'the time zone update was saved');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$update public.user_settings set timezone = 'Asia/Tokyo' where user_id = 'b0000000-0000-4000-8000-000000000012'$$),
  'ok:0', 'a user cannot update another user''s settings');
select is((select timezone from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000012'),
  'Africa/Lagos', 'the other user''s time zone is unchanged');

-- 12-13. A zone Postgres does not know is refused by the database, not only the app.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$update public.user_settings set timezone = 'Mars/Phobos' where user_id = 'b0000000-0000-4000-8000-000000000011'$$),
  'err:22023', 'an unknown time zone is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$update public.user_settings set timezone = repeat('a', 65) where user_id = 'b0000000-0000-4000-8000-000000000011'$$),
  'err:22023',
  'a time zone name over 64 characters is refused');

-- 14-17. Column grants: only timezone is writable by the app in this slice (the toggles arrive in slice 7).
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$update public.user_settings set notify_names_drawn = false where user_id = 'b0000000-0000-4000-8000-000000000011'$$),
  'err:42501', 'a user cannot write notification toggles yet');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$update public.user_settings set user_id = 'b0000000-0000-4000-8000-000000000019' where user_id = 'b0000000-0000-4000-8000-000000000011'$$),
  'err:42501', 'a user cannot change user_id');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$insert into public.user_settings (user_id) values ('b0000000-0000-4000-8000-000000000019')$$),
  'err:42501', 'a user cannot insert settings rows');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000011',
  $$delete from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000011'$$),
  'err:42501', 'a user cannot delete settings rows');

-- 18. Settings follow the account: the foreign key cascades on delete ('c').
select is(
  (select confdeltype::text from pg_constraint
   where conrelid = 'public.user_settings'::regclass and contype = 'f'),
  'c', 'user_settings.user_id cascades when the auth user is deleted');

-- 19-20. Writing the default zone back is accepted, and updated_at moves on update.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000012',
  $$update public.user_settings set timezone = 'Africa/Lagos' where user_id = 'b0000000-0000-4000-8000-000000000012'$$),
  'ok:1', 'writing the default zone back is accepted');
select ok((select updated_at > created_at from public.user_settings where user_id = 'b0000000-0000-4000-8000-000000000011'),
  'updated_at changes when settings are updated');

select * from finish();
rollback;
