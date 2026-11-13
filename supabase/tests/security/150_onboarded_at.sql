-- 150_onboarded_at — audit finding 3 (2026-11-13; GC-003, GC-004, GC-005).
-- profiles.onboarded_at records that a person finished Profile setup. The server routes on it (a
-- signed-in person without it goes to Profile setup), replacing a browser-supplied guess. Clients
-- cannot write it; saving the display name sets it once.
-- Self-contained: creates its own users inside the transaction (needs the onboarded_at migration
-- applied). Everything rolls back.
-- Pass: "ok 1".."ok 9", "1..9", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

-- Same helpers as 060 (inline so the file runs on its own); nothing is left in `public`.
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

select pg_temp.mk_user('b0000000-0000-4000-8000-000000001501', 'ada-150@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001502', 'bola-150@example.test', '{"first_name":"Bola"}');

-- 1-2. Shape, and a new account has not finished Profile setup.
select has_column('public', 'profiles', 'onboarded_at', 'profiles has onboarded_at');
select ok((select onboarded_at is null from public.profiles where id = 'b0000000-0000-4000-8000-000000001501'),
  'a new account starts with onboarded_at null');

-- 3. The owner can read it (the server routes on it under the person's own session).
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001501',
  $$select onboarded_at from public.profiles where id = 'b0000000-0000-4000-8000-000000001501'$$),
  'ok:1', 'a person can read their own onboarded_at');

-- 4. Nobody writes it directly: no column grant.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001501',
  $$update public.profiles set onboarded_at = now() where id = 'b0000000-0000-4000-8000-000000001501'$$),
  'err:42501', 'a person cannot write onboarded_at directly');

-- 5-6. Saving the display name (Profile setup) sets it, for that person only.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001501',
  $$update public.profiles set display_name = 'Ada O' where id = 'b0000000-0000-4000-8000-000000001501'$$),
  'ok:1', 'a person saves their display name');
select is(
  (select format('%s/%s', (a.onboarded_at is not null)::text, (b.onboarded_at is null)::text)
   from public.profiles a, public.profiles b
   where a.id = 'b0000000-0000-4000-8000-000000001501' and b.id = 'b0000000-0000-4000-8000-000000001502'),
  'true/true', 'saving the name sets onboarded_at for that person and nobody else');

-- 7. Saving the same name again (Profile setup with the name unchanged) still counts.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001502',
  $$update public.profiles set display_name = display_name where id = 'b0000000-0000-4000-8000-000000001502'$$),
  'ok:1', 'saving an unchanged name succeeds');
select ok((select onboarded_at is not null from public.profiles where id = 'b0000000-0000-4000-8000-000000001502'),
  'saving an unchanged name also sets onboarded_at');

-- 9. Once set, a later rename does not move it.
select set_config('test.first', (select onboarded_at::text from public.profiles where id = 'b0000000-0000-4000-8000-000000001501'), true);
-- WHY `do ... perform`: a bare select would print "ok:1", which pg_prove reads as a TAP line.
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001501',
  $$update public.profiles set display_name = 'Ada Okafor' where id = 'b0000000-0000-4000-8000-000000001501'$$); end $fx$;
select is((select onboarded_at::text from public.profiles where id = 'b0000000-0000-4000-8000-000000001501'),
  current_setting('test.first'), 'a later rename keeps the first onboarded_at');

select * from finish();
rollback;
