-- 110_default_wishlist_visibility — slice 3 (GC-027: default visibility for new wishlists).
-- Self-contained: creates its own two users inside the transaction (needs the profiles and
-- share_and_default_visibility migrations applied, not seed.sql). Everything rolls back.
-- Pass: "ok 1".."ok 10", "1..10", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

-- Same helpers as 060/070 (kept inline so each file runs on its own). See 060 for the reasoning.
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

select pg_temp.mk_user('b0000000-0000-4000-8000-000000000111', 'ada-110@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000112', 'bola-110@example.test', '{"first_name":"Bola"}');

-- 1. Shape: the wishlist_visibility enum, not null, default Private (GC-027: "starts as Private").
select is(
  (select format('%s/%s/%s', (a.atttypid = 'public.wishlist_visibility'::regtype)::text, a.attnotnull::text,
                 (pg_get_expr(d.adbin, d.adrelid) like '''private''::%')::text)
   from pg_attribute a
   join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where a.attrelid = 'public.user_settings'::regclass and a.attname = 'default_wishlist_visibility'),
  'true/true/true',
  'default_wishlist_visibility is a not null wishlist_visibility defaulting to private');

-- 2. A new person's row is Private (written by the sign-up trigger, which does not name the column).
select is((select default_wishlist_visibility::text from public.user_settings
           where user_id = 'b0000000-0000-4000-8000-000000000112'),
  'private', 'a new user''s default is private');

-- 3-4. A person changes their own default.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000111',
  $$update public.user_settings set default_wishlist_visibility = 'link' where user_id = 'b0000000-0000-4000-8000-000000000111'$$),
  'ok:1', 'a user can update their own default visibility');
select is((select default_wishlist_visibility::text from public.user_settings
           where user_id = 'b0000000-0000-4000-8000-000000000111'),
  'link', 'the default visibility update was saved');

-- 5-6. Not anyone else's: the row is invisible to them, so zero rows change.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000111',
  $$update public.user_settings set default_wishlist_visibility = 'link' where user_id = 'b0000000-0000-4000-8000-000000000112'$$),
  'ok:0', 'a user cannot update another user''s default visibility');
select is((select default_wishlist_visibility::text from public.user_settings
           where user_id = 'b0000000-0000-4000-8000-000000000112'),
  'private', 'the other user''s default is unchanged');

-- 7. A visitor is refused outright (no grant at all), not given zero rows.
select is(pg_temp.try_as(null,
  $$update public.user_settings set default_wishlist_visibility = 'link'$$),
  'err:42501', 'anon cannot update default visibility');

-- 8. Only the two enum values exist: 'public' is refused by the type.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000111',
  $$update public.user_settings set default_wishlist_visibility = 'public' where user_id = 'b0000000-0000-4000-8000-000000000111'$$),
  'err:22P02', 'a value outside the enum is refused');

-- 9. The notification toggles still have no update grant (they arrive in slice 7).
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000111',
  $$update public.user_settings set notify_names_drawn = false where user_id = 'b0000000-0000-4000-8000-000000000111'$$),
  'err:42501', 'the new grant did not open the notification toggles');

-- 10. Back to Private works too.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000111',
  $$update public.user_settings set default_wishlist_visibility = 'private' where user_id = 'b0000000-0000-4000-8000-000000000111'$$),
  'ok:1', 'a user can set the default back to private');

select * from finish();
rollback;
