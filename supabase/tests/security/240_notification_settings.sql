-- 240_notification_settings — slice 7 (GC-026 Notifications; plan §5 "user_settings"; owner decisions 2026-11-17, docs/tasks/slice-7.md).
-- Covers AC-7 and the toggle half of AC-3:
--   * the four notify_* columns are now writable by their owner and nothing else is (user_id, created_at and
--     updated_at stay closed; timezone and default_wishlist_visibility keep their grants);
--   * a person updates their own row only (another person's row changes zero rows, a visitor gets 42501); a value that
--     is not a boolean, or null, is refused by the database;
--   * the toggle the person saves is the one the emails obey: "Someone joins" off queues no E07, on again queues it, and
--     the other three toggles do not switch it off. (220 covers E08, E09, E12 and the anonymised case.)
-- Self-contained: creates its own users inside the transaction (needs the migrations through email_outbox applied, not
-- seed.sql). Everything rolls back. Each join is its own statement.
-- Written BEFORE the email_outbox migration: until it is applied the first statement that needs the new grant fails.
-- That is the expected "red".
-- Pass: "ok 1".."ok 14", "1..14", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

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

-- u(n) is persona n: 1 Ada (organiser of A), 2 Bola, 3 Chi, 4 Dayo.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('24' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u240-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo'])[i]))
  from generate_series(1, 4) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), format(
    'select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, false)',
    'T240 Open', '10k_20k', 'at_join_by', '18:00', 'Africa/Lagos'));
end $fx$;
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.tok_a', (select invite_token from public.exchanges where name = 'T240 Open'), true);
end $fx$;

-- 1. Column grants: exactly the four toggles were added to timezone and the default visibility.
select ok(
  has_column_privilege('authenticated', 'public.user_settings', 'notify_names_drawn', 'update')
  and has_column_privilege('authenticated', 'public.user_settings', 'notify_someone_joins', 'update')
  and has_column_privilege('authenticated', 'public.user_settings', 'notify_join_by_reminder', 'update')
  and has_column_privilege('authenticated', 'public.user_settings', 'notify_event_reminder', 'update')
  and has_column_privilege('authenticated', 'public.user_settings', 'timezone', 'update')
  and has_column_privilege('authenticated', 'public.user_settings', 'default_wishlist_visibility', 'update')
  and not has_column_privilege('authenticated', 'public.user_settings', 'user_id', 'update')
  and not has_column_privilege('authenticated', 'public.user_settings', 'created_at', 'update')
  and not has_column_privilege('authenticated', 'public.user_settings', 'updated_at', 'update')
  and not has_any_column_privilege('anon', 'public.user_settings', 'select, insert, update'),
  'a person may update the four toggles, the time zone and the default visibility, and nothing else; a visitor holds nothing');

-- 2-4. A person saves each toggle on their own row.
select is(
  pg_temp.try_as(pg_temp.u(2), $$update public.user_settings set notify_names_drawn = false where user_id = 'b0000000-0000-4000-8000-000000002402'$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), $$update public.user_settings set notify_someone_joins = false where user_id = 'b0000000-0000-4000-8000-000000002402'$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), $$update public.user_settings set notify_join_by_reminder = false where user_id = 'b0000000-0000-4000-8000-000000002402'$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), $$update public.user_settings set notify_event_reminder = false where user_id = 'b0000000-0000-4000-8000-000000002402'$$),
  'ok:1/ok:1/ok:1/ok:1', 'a user can update each of their four notification toggles');
select ok((select not (notify_names_drawn or notify_someone_joins or notify_join_by_reminder or notify_event_reminder)
           from public.user_settings where user_id = pg_temp.u(2)),
  'the four toggles were saved');
select ok((select updated_at > created_at from public.user_settings where user_id = pg_temp.u(2)),
  'updated_at moves when a toggle is saved');
select is(pg_temp.try_as(pg_temp.u(2),
  $$update public.user_settings set notify_names_drawn = true, notify_someone_joins = true, notify_join_by_reminder = true, notify_event_reminder = true where user_id = 'b0000000-0000-4000-8000-000000002402'$$),
  'ok:1', 'all four can be turned back on in one save');

-- 5-7. Not anyone else's row, not as a visitor, and only booleans.
select is(pg_temp.try_as(pg_temp.u(2),
  $$update public.user_settings set notify_someone_joins = false where user_id = 'b0000000-0000-4000-8000-000000002403'$$),
  'ok:0', 'a user cannot update another user''s toggles (zero rows)');
select ok((select notify_someone_joins from public.user_settings where user_id = pg_temp.u(3)),
  'the other user''s toggle is unchanged');
select is(pg_temp.try_as(null, $$update public.user_settings set notify_names_drawn = false$$), 'err:42501',
  'a visitor is refused (42501)');
select is(
  pg_temp.try_as(pg_temp.u(2), $$update public.user_settings set notify_names_drawn = 'maybe' where user_id = 'b0000000-0000-4000-8000-000000002402'$$)
  || '/' || pg_temp.try_as(pg_temp.u(2), $$update public.user_settings set notify_names_drawn = null where user_id = 'b0000000-0000-4000-8000-000000002402'$$),
  'err:22P02/err:23502', 'a value that is not a boolean, or null, is refused by the database');

-- 8-10. The toggle the person saves is the one E07 obeys. Ada turns "Someone joins" off herself.
select is(pg_temp.try_as(pg_temp.u(1),
  $$update public.user_settings set notify_someone_joins = false where user_id = 'b0000000-0000-4000-8000-000000002401'$$),
  'ok:1', 'Ada turns "Someone joins" off');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_a'))), 'ok:1',
  'Bola joins; with the toggle off the organiser is not emailed');
select is((select count(*)::int from private.email_outbox where template = 'E07'), 0,
  'no E07 was queued while Ada''s toggle was off');
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1),
    $$update public.user_settings set notify_someone_joins = true, notify_names_drawn = false where user_id = 'b0000000-0000-4000-8000-000000002401'$$);
end $fx$;
select is(pg_temp.try_as(pg_temp.u(3), format('select public.join_exchange(%L)', current_setting('test.tok_a'))), 'ok:1',
  'Chi joins after Ada turns "Someone joins" back on (and "Names are drawn" off)');
select is((select count(*)::int from private.email_outbox where template = 'E07'), 1,
  'E07 is queued again, and another toggle being off does not stop it');

select * from finish();
rollback;
