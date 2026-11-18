-- 250_email_cascade — slice 7 round 3 (owner decision 2026-11-17, docs/tasks/slice-7.md "after builder round 2").
-- Queued emails and email invites are deleted with the person or the exchange they belong to:
--   * deleting a profile deletes the outbox rows that name it as recipient or as sender;
--   * deleting an exchange deletes its outbox rows and its email_invites rows;
--   * nothing else cascades: the only on-delete-cascade keys that point at profiles or exchanges are the five on
--     private.email_outbox and public.email_invites, and a profile that still has a membership cannot be deleted.
-- Self-contained: creates its own users inside the transaction (needs the migrations through
-- email_outbox_details applied, not seed.sql). Everything rolls back. Names are prefixed "T250".
-- Each exchange is created in its own statement (a function that reads rows written earlier in the same
-- statement would not see them).
-- Written BEFORE the email_outbox_details migration: until it is applied the first assertion fails (the keys are
-- still NO ACTION) and the deletes are refused with 23503. That is the expected "red".
-- Pass: "ok 1".."ok 14", "1..14", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

create function pg_temp.try_as(who uuid, stmt text) returns text
language plpgsql as $$
declare
  n bigint;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
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

-- own runs statements as the migration role: 'ok' or 'err:<SQLSTATE>'.
create function pg_temp.own(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return 'err:' || sqlstate;
end $$;

create function pg_temp.mk(p_name text) returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, false)',
    p_name, '10k_20k', 'organiser_chooses', '18:00', 'Africa/Lagos')
$$;

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

-- u(n): 1 Ada (organiser of A and B), 2 Bola (recipient and sender), 3 Chi (sender), 4 Dayo (member of B),
-- 5 Eze (recipient, deleted as a user).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('25' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.rows(keys text) returns bigint
language sql as $$ select count(*) from private.email_outbox where dedupe_key = any (string_to_array(keys, ',')) $$;

do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u250-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze'])[i]))
  from generate_series(1, 5) i;
end $fx$;
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T250 A'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T250 B'));
end $fx$;
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_a', (select id::text from public.exchanges where name = 'T250 A'), true);
  perform set_config('test.ex_b', (select id::text from public.exchanges where name = 'T250 B'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_b')::uuid, pg_temp.u(4), true, now() - interval '1 day');

  -- Outbox rows. rec: Bola is the recipient. send: Bola is the sender. b: Chi is the sender, exchange B.
  -- a: exchange A only. typed: a typed address on exchange B. eze: Eze is the recipient, no exchange.
  insert into private.email_outbox (template, recipient_user_id, recipient_email, exchange_id, sender_id, dedupe_key) values
    ('E09', pg_temp.u(2), null, current_setting('test.ex_a')::uuid, null, 'T250-rec'),
    ('E07', pg_temp.u(1), null, current_setting('test.ex_a')::uuid, pg_temp.u(2), 'T250-send'),
    ('E07', pg_temp.u(1), null, current_setting('test.ex_b')::uuid, pg_temp.u(3), 'T250-b'),
    ('E09', pg_temp.u(1), null, current_setting('test.ex_a')::uuid, null, 'T250-a'),
    ('E06', null, 'typed250@example.test', current_setting('test.ex_b')::uuid, pg_temp.u(1), 'T250-typed'),
    ('E09', pg_temp.u(5), null, null, null, 'T250-eze');
  insert into public.email_invites (exchange_id, invited_address, sent_by) values
    (current_setting('test.ex_a')::uuid, 'inv-a@example.test', pg_temp.u(1)),
    (current_setting('test.ex_b')::uuid, 'inv-b@example.test', pg_temp.u(1));
end $fx$;

-- 1-2. The five cascade keys, and no others that point at profiles or exchanges.
select is(
  (select string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ' order by c.conrelid::regclass::text, a.attname)
   from pg_constraint c
   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
   where c.contype = 'f' and c.confdeltype = 'c'
     and c.confrelid in ('public.profiles'::regclass, 'public.exchanges'::regclass)),
  'email_invites.exchange_id, email_invites.sent_by, private.email_outbox.exchange_id, private.email_outbox.recipient_user_id, private.email_outbox.sender_id',
  'exactly the five email keys cascade from profiles and exchanges');
select is(
  (select count(*)::int from pg_constraint c
   where c.contype = 'f' and c.confdeltype = 'c'
     and c.conrelid not in ('private.email_outbox'::regclass, 'public.email_invites'::regclass)
     and c.confrelid in ('public.profiles'::regclass, 'public.exchanges'::regclass)),
  0, 'no other table cascades from a profile or an exchange');

-- 3-5. A profile deleted: rows naming it as recipient or sender go; others stay.
select is(pg_temp.own(format('delete from public.profiles where id = %L', pg_temp.u(2))), 'ok', 'a profile with no other links can be deleted');
select is(pg_temp.rows('T250-rec,T250-send'), 0::bigint, 'their outbox rows go, as recipient and as sender');
select is(pg_temp.rows('T250-b,T250-a,T250-typed,T250-eze'), 4::bigint, 'other people''s rows stay');

-- 6-7. A second profile (sender only).
select is(pg_temp.own(format('delete from public.profiles where id = %L', pg_temp.u(3))), 'ok', 'a sender profile can be deleted');
select is(pg_temp.rows('T250-b') || '/' || pg_temp.rows('T250-a,T250-typed,T250-eze'), '0/3', 'the sender''s row goes and the rest stay');

-- 8. Nothing else cascades: a profile that is a member is still refused.
select is(pg_temp.own(format('delete from public.profiles where id = %L', pg_temp.u(4))), 'err:23503', 'a profile with a membership is still refused');

-- 9-10. An exchange deleted (its members first: that table does not cascade).
select is(pg_temp.own(format('delete from public.exchange_members where exchange_id = %L; delete from public.exchanges where id = %L',
  current_setting('test.ex_a'), current_setting('test.ex_a'))), 'ok', 'an exchange can be deleted once its members are gone');
select is(
  pg_temp.rows('T250-a') || '/' || (select count(*) from public.email_invites where invited_address = 'inv-a@example.test')
    || '/' || pg_temp.rows('T250-typed') || '/' || (select count(*) from public.email_invites where invited_address = 'inv-b@example.test'),
  '0/0/1/1', 'its outbox and invite rows go; the other exchange keeps its rows');

-- 11-12. The other exchange; the people stay.
select is(pg_temp.own(format('delete from public.exchange_members where exchange_id = %L; delete from public.exchanges where id = %L',
  current_setting('test.ex_b'), current_setting('test.ex_b'))), 'ok', 'the second exchange can be deleted');
select is(
  pg_temp.rows('T250-typed') || '/' || (select count(*) from public.email_invites where invited_address = 'inv-b@example.test')
    || '/' || (select count(*) from public.profiles where id in (pg_temp.u(1), pg_temp.u(4))),
  '0/0/2', 'its rows go and no profile is deleted with an exchange');

-- 13-14. The user path: profile, then the user. Eze's row (no exchange) goes with the profile.
select is(pg_temp.own(format('delete from public.profiles where id = %L; delete from auth.users where id = %L', pg_temp.u(5), pg_temp.u(5))),
  'ok', 'a profile and then its user can be deleted');
select is(pg_temp.rows('T250-eze'), 0::bigint, 'the person''s queued email is gone with them');

select * from finish();
rollback;
