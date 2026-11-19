-- 260_readiness — slice 8 (GCO-006 readiness; plan §5-§8; owner decisions 2026-11-18 1-4, docs/tasks/slice-8.md).
-- Covers: get_readiness is the organiser's read of who is taking part, whether a list is in, and whether they were
-- nudged in the last 12 hours. Booleans, a first name and an opaque member id only: no address, no person id, no list
-- name, no item, no reservation, no pair. Members, requesters, removed or left people, an outsider and another
-- exchange's organiser get zero rows (not an error, so nothing is revealed); a visitor is refused with 42501.
-- Only active members who are taking part are returned. "A list is in" is ONE rule (private.member_has_list) shared
-- with get_participants: an attached list that is not an empty ideas list; a deleted list the giver keeps and an empty
-- real wishlist count as in. A cancelled-by-undo nudge does not make someone "recently nudged"; a nudge from any
-- sender does; one older than 12 hours does not.
-- Self-contained: creates its own users inside the transaction (needs the migrations through readiness_and_nudges
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T260" because dev holds other data.
-- Written BEFORE the readiness_and_nudges migration: until it is applied the first statement that names
-- get_readiness fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 25", "1..25", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

-- Isolation (test setup only): the dev database holds outbox rows from other runs, which would change what
-- "recently nudged" says. Every row is deleted INSIDE this transaction, which rolls back at the end.
delete from private.email_outbox;

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

-- val_as returns one value read as a persona (null = anon), or 'err:<SQLSTATE>'.
create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
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
    execute format('select (%s)::text', expr) into v;
    reset role;
    return v;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

create function pg_temp.mk(p_name text) returns text
language sql as $$
  select format('select public.create_exchange(%L, %L, %L, current_date + 10, %L, %L, current_date + 20, %L, true, true)',
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

-- u(n) is persona n: 1 Ada (organiser of P, no list), 2 Bola (member, real wishlist attached), 3 Chi (member, none),
-- 4 Dayo (removed from P), 5 Eze (left P), 6 Femi (organiser of X), 7 Gbemi (outsider), 8 Hana (pending request on P),
-- 9 Ife (member of P who is not taking part), 10 Jide (member, empty ideas list), 11 Kemi (member, deleted list kept).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('26' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- The readiness of P as one line per row, in the order returned: name:me:in:nudged.
create function pg_temp.line(p_ex text) returns text
language sql as $$
  select format($q$(select string_agg(display_name || ':' || is_me::text || ':' || has_wishlist::text || ':' || nudged_recently::text, '|')
    from public.get_readiness(%L))$q$, p_ex)
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u260-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi'])[i]))
  from generate_series(1, 11) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T260 Readiness'));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T260 Other'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T260 Readiness'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T260 Other'), true);
end $fx$;

-- Members and lists, written as the migration role. now() is frozen, so times are set by hand.
do $fx$ begin
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(2), true, now() - interval '5 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(3), true, now() - interval '4 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(10), true, now() - interval '3 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(11), true, now() - interval '2 days');
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(9), false, now() - interval '1 day');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(4), true, 'removed', now() - interval '9 days', now() - interval '8 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(5), true, 'left', now() - interval '9 days', now() - interval '8 days');
  insert into public.join_requests (exchange_id, user_id) values (current_setting('test.ex_p')::uuid, pg_temp.u(8));
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T260 Bola list');
  insert into public.wishlists (owner_id, kind, name, visibility, exchange_id)
    values (pg_temp.u(10), 'exchange_ideas', 'Exchange ideas', 'private', current_setting('test.ex_p')::uuid);
  insert into public.wishlists (owner_id, name, deleted_at) values (pg_temp.u(11), 'T260 Kemi deleted list', now());
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T260 Bola list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2);
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where owner_id = pg_temp.u(10) and kind = 'exchange_ideas')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(10);
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T260 Kemi deleted list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(11);
end $fx$;

-- 1. Shape: get_readiness and the two helpers are SECURITY DEFINER with an empty search_path (040 checks all schemas).
select ok(
  (select count(*) = 3 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where (p.pronamespace = 'public'::regnamespace and p.proname = 'get_readiness')
      or (p.pronamespace = 'private'::regnamespace and p.proname in ('member_has_list', 'recently_nudged'))),
  'get_readiness, member_has_list and recently_nudged are SECURITY DEFINER with an empty search_path');

-- 2-3. Grants: anon cannot execute it (030 stays as it is); signed-in people can; neither role can reach the helpers.
select ok(not has_function_privilege('anon', 'public.get_readiness(uuid)', 'execute'), 'anon cannot execute get_readiness');
select ok(
  has_function_privilege('authenticated', 'public.get_readiness(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.member_has_list(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.recently_nudged(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'private.member_has_list(uuid)', 'execute'),
  'signed-in people can execute get_readiness and neither role can execute the private helpers');

-- 4. What is returned: a member id, a name, two flags and "nudged recently". Nothing else can be added silently.
select is(
  pg_get_function_result('public.get_readiness(uuid)'::regprocedure),
  'TABLE(member_id uuid, display_name text, is_me boolean, has_wishlist boolean, nudged_recently boolean)',
  'get_readiness returns a member id, a name, is_me, has_wishlist and nudged_recently only');

-- 5. The organiser reads every active member who is taking part, organiser first then join order. A real wishlist and a
-- kept deleted list are in; an empty ideas list and nothing attached are not. Ife (not taking part), Dayo (removed),
-- Eze (left) and Hana (a request) are absent.
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:false|Jide:false:false:false|Kemi:false:true:false',
  'the organiser reads who is taking part and whose list is in; not the removed, left, requesting or not-taking-part');

-- 6. The rows as json: no address, no person id, no list name, no reservation.
select ok(
  (select r not like '%@%' and r not like '%user_id%' and r not like '%b0000000-0000-4000-8000-%'
     and r not like '%T260%' and r not like '%reserv%' and r not like '%email%'
   from (select pg_temp.val_as(pg_temp.u(1), format($$(select jsonb_agg(to_jsonb(g)) from public.get_readiness(%L) g)$$, current_setting('test.ex_p'))) as r) s),
  'the readiness rows hold no address, person id, list name or reservation');

-- 7. Another exchange's organiser reads only their own: Femi sees themself on X (no list), Ada reads nothing on X.
select is(
  pg_temp.val_as(pg_temp.u(6), pg_temp.line(current_setting('test.ex_x')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select * from public.get_readiness(%L)', current_setting('test.ex_x')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.get_readiness(%L)', current_setting('test.ex_p'))),
  'Femi:true:false:false/ok:0/ok:0',
  'each organiser reads their own exchange only');

-- 8. Members, a requester, removed and left people, a non-participant, an outsider: zero rows, not an error.
select is(
  pg_temp.try_as(pg_temp.u(2), format('select * from public.get_readiness(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select * from public.get_readiness(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(8), format('select * from public.get_readiness(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(4), format('select * from public.get_readiness(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select * from public.get_readiness(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(9), format('select * from public.get_readiness(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.get_readiness(%L)', current_setting('test.ex_p'))),
  'ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0',
  'a member, a requester, a removed person, a person who left, a non-participant and an outsider read no readiness');

-- 9. A visitor is refused; a null or unknown exchange id returns nothing.
select is(
  pg_temp.try_as(null, format('select * from public.get_readiness(%L)', current_setting('test.ex_p'))),
  'err:42501', 'a visitor is refused (42501)');
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from public.get_readiness(null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select * from public.get_readiness('c0000000-0000-4000-8000-0000000026ff')$$),
  'ok:0/ok:0', 'a null or unknown exchange id returns no rows');

-- 10. The helpers refuse the API roles outright (42501 on the private schema).
select is(
  pg_temp.try_as(pg_temp.u(1), 'select private.member_has_list(null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select private.recently_nudged(null, null)')
  || '/' || pg_temp.try_as(null, 'select private.member_has_list(null)'),
  'err:42501/err:42501/err:42501', 'the private helpers are refused for signed-in people and visitors');

-- 11. One rule: Participants and readiness agree on every member's list status.
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_participants(%L) where taking_part)$$, current_setting('test.ex_p'))),
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_readiness(%L))$$, current_setting('test.ex_p'))),
  'get_participants and get_readiness give the same list status for every member');

-- 12-13. An ideas list flips to in with one live item; an attached empty real wishlist stays in.
do $fx$ begin
  insert into public.wishlist_items (wishlist_id, name, priority)
    values ((select id from public.wishlists where owner_id = pg_temp.u(10) and kind = 'exchange_ideas'), 'T260 Item', 'nice_to_have');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:false|Jide:false:true:false|Kemi:false:true:false',
  'an ideas list with one live item is in');
do $fx$ begin
  update public.wishlist_items set deleted_at = now() where name = 'T260 Item';
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:false|Jide:false:false:false|Kemi:false:true:false',
  'an ideas list whose only item was deleted is not in again');

-- 14. Attaching a list flips Chi, and the readiness follows.
do $fx$ begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(3), 'T260 Chi list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T260 Chi list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(3);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:true:false|Jide:false:false:false|Kemi:false:true:false',
  'attaching a list flips only that member''s flag');
do $fx$ begin
  update public.exchange_members set attached_wishlist_id = null
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(3);
end $fx$;

-- 15-19. nudged_recently: a pending nudge from any sender counts; one cancelled by undo does not; one older than
-- 12 hours does not; a sent one counts. Rows are written as the migration role (the app cannot write them).
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key)
    values ('E10', pg_temp.u(3), current_setting('test.ex_p')::uuid, pg_temp.u(6), 'T260-chi');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:true|Jide:false:false:false|Kemi:false:true:false',
  'a nudge from any sender, still waiting to be sent, makes the person recently nudged');
do $fx$ begin
  update private.email_outbox set cancelled_at = now(), last_error_code = 'undone' where dedupe_key = 'T260-chi';
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:false|Jide:false:false:false|Kemi:false:true:false',
  'an undone nudge does not count');
do $fx$ begin
  update private.email_outbox set cancelled_at = null, last_error_code = null, created_at = now() - interval '13 hours'
    where dedupe_key = 'T260-chi';
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:false|Jide:false:false:false|Kemi:false:true:false',
  'a nudge from 13 hours ago does not count');
do $fx$ begin
  update private.email_outbox set created_at = now() - interval '11 hours', sent_at = now() - interval '11 hours'
    where dedupe_key = 'T260-chi';
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:true|Jide:false:false:false|Kemi:false:true:false',
  'a sent nudge from 11 hours ago counts');
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key)
    values ('E10', pg_temp.u(2), current_setting('test.ex_x')::uuid, pg_temp.u(6), 'T260-other-exchange');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Chi:false:false:true|Jide:false:false:false|Kemi:false:true:false',
  'a nudge about another exchange does not count here');

-- 20. A removed person leaves the readiness the moment they are removed. WHY a separate statement for the call: a
-- read in the same statement would use an older snapshot.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)',
    (select id from public.exchange_members where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid)));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Ada:true:false:false|Bola:false:true:false|Jide:false:false:false|Kemi:false:true:false',
  'a removed member is gone from the readiness');

-- 21. Nothing in the readiness functions touches an assignment or a reservation.
select ok(
  not exists (
    select 1 from pg_proc p
    where p.oid in ('public.get_readiness(uuid)'::regprocedure, 'private.member_has_list(uuid)'::regprocedure,
                    'private.recently_nudged(uuid, uuid)'::regprocedure)
      and (p.prosrc ilike '%assign%' or p.prosrc ilike '%reserv%')),
  'the readiness functions read no assignment and no reservation');

-- 22. No function in public returns or takes an address because of this slice beyond the ones 210 already allows:
-- the readiness result has no email column.
select ok(
  (select pg_get_function_result('public.get_readiness(uuid)'::regprocedure) not ilike '%email%'
      and pg_get_function_result('public.get_readiness(uuid)'::regprocedure) not ilike '%user_id%'),
  'get_readiness has no email and no person id column');

-- 23. The organiser's own row is marked is_me and no one else's is.
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select count(*) filter (where is_me)::text || '/' || count(*)::text from public.get_readiness(%L))$$, current_setting('test.ex_p'))),
  '1/4', 'only the caller''s own row is is_me');

-- 24. The organiser who only organises is not in the readiness, a person with no row is not either.
do $fx$ begin
  update public.exchange_members set taking_part = false
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(1);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), pg_temp.line(current_setting('test.ex_p'))),
  'Bola:false:true:false|Jide:false:false:false|Kemi:false:true:false',
  'an organiser who is not taking part is not counted');

select * from finish();
rollback;
