-- 210_organiser_emails — organiser-emails (GCO-007, GCO-003, GC-009, GCO-008 story text; owner decisions
-- 2026-11-15 "organisers can see participants' email addresses" and 2026-11-16 Q1, Q2, Q3).
-- Supersedes slice-6 AC-41 (no email on the organiser's lists) and Q13 for wishlist status. Pair secrecy and
-- asymmetric visibility are unchanged: nothing here names a giver or a recipient.
-- Covers: get_participants gains `email` (every member except the organiser's own row, which is null) and
-- `has_wishlist` (whether the member's own screen would show a list: attached, and not an empty ideas list; only an
-- exists() on live items, nothing about items or reservations); get_join_requests gains
-- `email` (pending requesters). Both are the organiser's only: a member, a requester, a removed or left person,
-- an outsider and another exchange's organiser get zero rows; a visitor is refused with 42501. Removed or left
-- members and decided requests are not returned. Both are SECURITY DEFINER with an empty search_path, granted to
-- signed-in people only. No table in `public` gets an email column, and the member-facing reads
-- (get_exchange_people, get_join_details) carry no email. No joined_at is returned: "Joined just now" is UI only.
-- Self-contained: creates its own users inside the transaction (needs the migrations through organiser_emails
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T210" because dev holds other data.
-- Written BEFORE the organiser_emails migration: until it is applied the assertions on the new columns fail
-- (the old functions have no email or has_wishlist). That is the expected "red".
-- The old 190 assertions on the two functions' shapes are updated in the same change (see 190).
-- Pass: "ok 1".."ok N", "1..N" (N is the plan below), no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

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

-- u(n) is persona n: 1 Ada (organiser of P), 2 Bola (member of P, list attached), 3 Chi (member of P, no list),
-- 4 Dayo (removed from P), 5 Eze (left P), 6 Femi (organiser of X), 7 Gbemi (outsider), 8 Hana (pending request on P),
-- 9 Ife (declined on P), 10 Jide (approved on P, no membership row: the decision is what is tested), 11 Kemi (pending
-- on X), 12 Lola (pending on P, older than Hana).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('21' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u210-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi', 'Lola'])[i]))
  from generate_series(1, 12) i;
end $fx$;

-- Ada's P and Femi's X, made the way the app makes them.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T210 Approval'));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T210 Other'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T210 Approval'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T210 Other'), true);
  perform set_config('test.tok_p', (select invite_token from public.exchanges where name = 'T210 Approval'), true);
end $fx$;

-- Members, lists and requests, written as the migration role. now() is frozen, so times are set by hand.
-- Bola and Ada have a list attached, Chi has none. Ada's list is attached to show the own row's status.
do $fx$ begin
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(2), true, now() - interval '3 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(3), true, now() - interval '2 days');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(4), true, 'removed', now() - interval '5 days', now() - interval '4 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(5), true, 'left', now() - interval '5 days', now() - interval '4 days');
  insert into public.wishlists (owner_id, name) values (pg_temp.u(1), 'T210 Ada list'), (pg_temp.u(2), 'T210 Bola list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T210 Ada list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(1);
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T210 Bola list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2);
  -- Lola asked before Hana. Ife was declined and Jide approved: neither is pending.
  insert into public.join_requests (exchange_id, user_id, created_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(12), now() - interval '2 hours'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(8), now() - interval '1 hour'),
           (current_setting('test.ex_x')::uuid, pg_temp.u(11), now() - interval '1 hour');
  insert into public.join_requests (exchange_id, user_id, status, decided_at, created_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(9), 'declined', now(), now() - interval '3 hours'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(10), 'approved', now(), now() - interval '3 hours');
end $fx$;

-- 1. Shape: both are SECURITY DEFINER with an empty search_path (040 also checks the schemas).
select ok(
  (select count(*) = 2 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('get_participants', 'get_join_requests')),
  'get_participants and get_join_requests are SECURITY DEFINER with an empty search_path');

-- 2-3. Grants: anon can execute neither (030 stays at two functions); signed-in people can execute both.
select ok(
  not has_function_privilege('anon', 'public.get_participants(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_join_requests(uuid)', 'execute'),
  'anon can execute neither the participants nor the join-requests function');
select ok(
  has_function_privilege('authenticated', 'public.get_participants(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_join_requests(uuid)', 'execute'),
  'signed-in people can execute both');

-- 4-6. Shape of what is returned: the email and a yes/no list status, nothing about items, reservations, avatars,
-- pairs or a joined time. The organiser still gets a member id and a request id, never a person id.
select is(
  (select proargnames::text from pg_proc where oid = 'public.get_participants(uuid)'::regprocedure),
  '{p_exchange,member_id,display_name,is_me,is_organiser,taking_part,email,has_wishlist}',
  'get_participants returns a member id, a name, flags, an email and a has_wishlist yes/no only');
select is(
  pg_get_function_result('public.get_participants(uuid)'::regprocedure),
  'TABLE(member_id uuid, display_name text, is_me boolean, is_organiser boolean, taking_part boolean, email text, has_wishlist boolean)',
  'the list status is one boolean: whether a list is attached');
select is(
  (select proargnames::text from pg_proc where oid = 'public.get_join_requests(uuid)'::regprocedure),
  '{p_exchange,request_id,display_name,requested_at,email}',
  'get_join_requests returns a request id, a name, a time and an email only');

-- 7. The organiser reads every other active member's email and whether a list is attached. Organiser first, then
-- join order. The organiser's own row has a null email and its own list status. Removed and left people are absent.
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || coalesce(email, 'null') || ':' || has_wishlist::text, '|')
    from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:null:true|Bola:u210-2@example.test:true|Chi:u210-3@example.test:false',
  'the organiser sees each member''s email and list status (own row: no email), and not the removed or left people');

-- 8. The same list, as whole rows: no address of a removed or left person, of another exchange's people or of anyone
-- who only asked, and no person id.
select ok(
  (select r not like '%u210-4@%' and r not like '%u210-5@%' and r not like '%u210-6@%' and r not like '%u210-11@%'
     and r not like '%u210-8@%' and r not like '%u210-9@%' and r not like '%u210-1@%' and r not like '%user_id%'
     and r not like '%b0000000-0000-4000-8000-%'
   from (select pg_temp.val_as(pg_temp.u(1), format($$(select jsonb_agg(to_jsonb(g)) from public.get_participants(%L) g)$$, current_setting('test.ex_p'))) as r) s),
  'the participant rows hold no address of a removed, left, requesting or other-exchange person, and no person id');

-- 9. get_join_requests: pending requesters' emails, oldest first; the declined and the approved are not listed.
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || email, '|') from public.get_join_requests(%L))$$, current_setting('test.ex_p'))),
  'Lola:u210-12@example.test|Hana:u210-8@example.test',
  'the organiser sees pending requesters'' emails, oldest first, and not the declined or approved');

-- 10. Another exchange's organiser reads their own: Femi sees Kemi on X; Ada on X sees nothing, Femi on P sees nothing.
select is(
  pg_temp.val_as(pg_temp.u(6), format($$(select string_agg(display_name || ':' || email, '|') from public.get_join_requests(%L))$$, current_setting('test.ex_x')))
  || '/' || pg_temp.val_as(pg_temp.u(6), format($$(select string_agg(display_name || ':' || coalesce(email, 'null') || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_x'))),
  'Kemi:u210-11@example.test/Femi:null:false',
  'each organiser reads their own exchange only (the other exchange''s request and member lists are separate)');

-- 11-12. Participants: members, a requester, removed and left people, an outsider and another exchange's organiser get
-- zero rows (not an error, so nothing is revealed); the organiser of another exchange gets zero on this one; a visitor
-- is refused.
select is(
  pg_temp.try_as(pg_temp.u(2), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(8), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(4), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select * from public.get_participants(%L)', current_setting('test.ex_x'))),
  'ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0',
  'a member, a requester, a removed person, a person who left, an outsider and another exchange''s organiser read no participants');
select is(
  pg_temp.try_as(null, format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.get_join_requests(%L)', current_setting('test.ex_p'))),
  'err:42501/err:42501', 'a visitor is refused (42501) on both functions');

-- 13. Join requests: the same people get zero rows.
select is(
  pg_temp.try_as(pg_temp.u(2), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(8), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(9), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(4), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(5), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(1), format('select * from public.get_join_requests(%L)', current_setting('test.ex_x'))),
  'ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0',
  'a member, a requester, a declined person, a removed person, a person who left, an outsider and another exchange''s organiser read no requests');

-- 14. Null, unknown and malformed exchange ids return nothing (not an error, not another exchange's rows).
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from public.get_participants(null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select * from public.get_participants('c0000000-0000-4000-8000-0000000021ff')$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select * from public.get_join_requests(null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select * from public.get_join_requests('c0000000-0000-4000-8000-0000000021ff')$$),
  'ok:0/ok:0/ok:0/ok:0', 'a null or unknown exchange id returns no rows');

-- 15-17. The member-facing reads carry no email and no list status (060 and 170 stay as they are).
select ok(
  not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      -- WHY the two slice 7 functions (owner decision 2026-11-17): send_email_invite takes the address the organiser
      -- typed, and claim_due_emails (service_role only) returns each recipient's own address to the sender. Tests 220
      -- and 230 prove who can call them and that each row carries only the recipient's address.
      -- WHY draw_names and get_draw_summary (owner decision 2026-11-22, slice 10): each returns a COUNT named emails_queued
      -- (how many Names are drawn emails were queued), never an address. Tests 310 and 320 prove who can call them.
      and p.proname not in ('get_participants', 'get_join_requests', 'send_email_invite', 'claim_due_emails', 'draw_names', 'get_draw_summary')
      and (p.proargnames::text ilike '%email%'
           or (p.proretset and p.prorettype = 'pg_catalog.record'::regtype and pg_get_function_result(p.oid) ilike '%email%'))),
  'no other function in public returns or takes an email');
select ok(
  (select r not like '%@%' and r not like '%has_wishlist%'
   from (select pg_temp.val_as(pg_temp.u(2), format($$(select jsonb_agg(to_jsonb(g)) from public.get_exchange_people(%L) g)$$, current_setting('test.ex_p'))) as r) s),
  'a member''s view of the people (get_exchange_people) carries no email and no list status');
select ok(
  (select r not like '%@%' and r not like '%has_wishlist%'
   from (select pg_temp.val_as(pg_temp.u(2), format('public.get_join_details(%L)', current_setting('test.tok_p'))) as r) s),
  'a member''s join details carry no email and no list status');

-- 18. No table, view or column in `public` is called email (060 checks the same for profiles).
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and column_name ilike '%email%'),
  0, 'no table in public has an email column');

-- 19-20. The status is the attachment only and reads no items: attaching a list flips it, detaching flips it back.
do $fx$ begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(3), 'T210 Chi list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T210 Chi list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(3);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:true|Bola:true|Chi:true',
  'attaching a list flips only the yes/no status; no item or reservation is read');
do $fx$ begin
  update public.exchange_members set attached_wishlist_id = null
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:true|Bola:false|Chi:true', 'a member with no list attached reads false');

-- 21-23. The status mirrors the member's own screen (get_my_exchange_list): an exchange ideas list with no live items is
-- "none" (false), with one live item it is true, and an empty real wishlist stays true.
do $fx$ begin
  insert into public.wishlists (owner_id, kind, name, visibility, exchange_id)
    values (pg_temp.u(3), 'exchange_ideas', 'Exchange ideas', 'private', current_setting('test.ex_p')::uuid);
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where owner_id = pg_temp.u(3) and kind = 'exchange_ideas')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(3);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:true|Bola:false|Chi:false', 'an attached ideas list with no live items reads false, like "none" on the member''s screen');
do $fx$ begin
  insert into public.wishlist_items (wishlist_id, name, priority)
    values ((select id from public.wishlists where owner_id = pg_temp.u(3) and kind = 'exchange_ideas'), 'T210 Item', 'nice_to_have');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:true|Bola:false|Chi:true', 'an ideas list with one live item reads true');
do $fx$ begin
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T210 Bola list')
    where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(2);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:true|Bola:true|Chi:true', 'an attached real wishlist with no items reads true');

-- 24-27. The lists follow the lifecycle: approving Lola moves her from requests to participants (with her email); removing
-- Chi takes Chi's address out. WHY each call is its own statement: a read in the same statement uses an older snapshot.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), format('select public.approve_join_request(%L)',
    (select id from public.join_requests where user_id = pg_temp.u(12) and exchange_id = current_setting('test.ex_p')::uuid)));
  perform pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)',
    (select id from public.exchange_members where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid)));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || coalesce(email, 'null') || ':' || has_wishlist::text, '|') from public.get_participants(%L))$$, current_setting('test.ex_p'))),
  'Ada:null:true|Bola:u210-2@example.test:true|Lola:u210-12@example.test:false',
  'an approved requester appears with their email; a removed member''s email is gone');
select is(
  pg_temp.val_as(pg_temp.u(1), format($$(select string_agg(display_name || ':' || email, '|') from public.get_join_requests(%L))$$, current_setting('test.ex_p'))),
  'Hana:u210-8@example.test', 'a decided request leaves the pending list');
select is(
  pg_temp.try_as(pg_temp.u(3), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p'))),
  'ok:0/ok:0', 'the person removed just now reads nothing');
select is(
  pg_temp.try_as(pg_temp.u(12), format('select * from public.get_participants(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(12), format('select * from public.get_join_requests(%L)', current_setting('test.ex_p'))),
  'ok:0/ok:0', 'the person approved just now is a member and reads nothing');

select * from finish();
rollback;
