-- 220_email_outbox — slice 7 (GC-026, GCO-005 email, GCO-007 E12, GCO-003 and GC-012 E08 and E09; plan §5, §6, §8;
-- owner decisions 2026-11-17 Q1-Q12, docs/tasks/slice-7.md).
-- Covers AC-1, AC-2, AC-3, AC-4 and AC-13 (exactly once, in SQL):
--   * private.email_outbox has RLS and no grant for any role (a direct read or write is refused with 42501, not
--     zero rows); claim_due_emails and mark_email_result are executable by service_role only; the writer and the
--     cancel helper are not reachable by the API roles at all.
--   * the four trigger RPCs (join_exchange, request_to_join, approve_join_request, remove_member) queue E07, E08,
--     E09 and E12 and nothing else; a payload holds two fixed ids only; no row carries a pair, a reservation or an
--     address other than the recipient's; no function mentions an assignment or a reservation.
--   * toggles are respected for E07 and E08 only; E09 is always sent (Q8) and approving queues no E07 for the
--     organiser; E12 is always sent, cancels that person's other unsent rows for the exchange first, and names no
--     organiser (no sender, no subject, no reason); anonymised recipients are skipped.
--   * claim_due_emails returns each due row once (lease), with the one address the row is for; mark_email_result
--     records the outcome; a failure retries later and a fifth failure cancels the row.
-- Self-contained: creates its own users inside the transaction (needs the migrations through email_outbox
-- applied, not seed.sql). Everything rolls back. Names are prefixed "T220" because dev holds other data.
-- now() is frozen inside a transaction, so times are moved by update, never relied on.
-- Each trigger RPC is called in its own statement (a function that reads rows written earlier in the same statement
-- would not see them).
-- Written BEFORE the email_outbox migration: until it is applied the first statement that names the new table or
-- functions fails and the run stops. That is the expected "red".
-- Round 3 (2026-11-17): four assertions on the claim's new columns (E06 only; no pair data; no address but the
-- recipient's). They fail until the email_outbox_details migration is applied.
-- Pass: "ok 1".."ok 74", "1..74", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(74);

-- Isolation (test setup only; no assertion, value or description changes). WHY: the dev database holds outbox and
-- invite rows from other runs (e2e), which would be counted by the scalar subqueries and claimed ahead of this
-- test's own rows (a claim returns at most 50, oldest first). Every row is deleted INSIDE this transaction, which
-- rolls back at the end, so nothing is lost and every count and claim below sees only the rows this test makes.
delete from private.email_outbox;
delete from public.email_invites;

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
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

-- own runs one statement as the migration role: 'ok' or 'err:<SQLSTATE>' (constraint checks).
create function pg_temp.own(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return 'err:' || sqlstate;
end $$;

-- svc runs one statement as service_role: 'ok:<rows>' or 'err:<SQLSTATE>'.
create function pg_temp.svc(stmt text) returns text
language plpgsql as $$
declare
  n bigint;
begin
  set local role service_role;
  set local request.jwt.claims = '{"role":"service_role"}';
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

-- claim_as_svc calls claim_due_emails as service_role and keeps the rows as json in a transaction setting.
create function pg_temp.claim_as_svc(lim int, slot text) returns void
language plpgsql as $$
declare
  v jsonb;
begin
  set local role service_role;
  set local request.jwt.claims = '{"role":"service_role"}';
  begin
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v from public.claim_due_emails(lim) c;
  exception when others then
    reset role;
    raise;
  end;
  reset role;
  perform set_config(slot, v::text, true);
end $$;

create function pg_temp.mk(
  p_name text,
  mode text default 'at_join_by',
  approval text default 'false'
) returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, %s)',
    p_name, '10k_20k', mode, '18:00', 'Africa/Lagos', approval)
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

-- u(n) is persona n: 1 Ada (organiser of A and P), 2 Bola, 3 Chi, 4 Dayo, 5 Eze, 6 Femi, 7 Gbemi, 8 Hana.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('22' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u220-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana'])[i]))
  from generate_series(1, 8) i;
end $fx$;

-- A is open without approval, P needs approval (the main one).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T220 Open'));
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T220 Approval', mode => 'organiser_chooses', approval => 'true'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_a', (select id::text from public.exchanges where name = 'T220 Open'), true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T220 Approval'), true);
  perform set_config('test.tok_a', (select invite_token from public.exchanges where name = 'T220 Open'), true);
  perform set_config('test.tok_p', (select invite_token from public.exchanges where name = 'T220 Approval'), true);
  -- Dayo is a member of P (for the removal). Dayo and Chi have every notification toggle off: E09 and E12 must
  -- still be queued for them.
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(4), true, now() - interval '2 days');
  update public.user_settings
     set notify_names_drawn = false, notify_someone_joins = false,
         notify_join_by_reminder = false, notify_event_reminder = false
   where user_id in (pg_temp.u(3), pg_temp.u(4));
end $fx$;

-- 1-4. Shape.
select ok((select relrowsecurity from pg_class where oid = 'private.email_outbox'::regclass),
  'private.email_outbox has row level security enabled');

select ok(
  (select count(*) = 4 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in (
     'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)'::regprocedure,
     'private.cancel_pending_emails(uuid, uuid)'::regprocedure,
     'public.claim_due_emails(integer)'::regprocedure,
     'public.mark_email_result(uuid, text)'::regprocedure)),
  'the writer, the cancel helper and the two sender functions are SECURITY DEFINER with an empty search_path');

-- WHY an exact column list: a column that could hold a pair, a reservation or a free-text body must be added on
-- purpose, with this test changed in the open.
-- WHY for_at is on the list (slice 12, owner decision Q1 2026-11-24): the moment a reminder is about (the join-by moment, or the
-- start of the gift day in the person's zone). One timestamp; it holds no person, no pair and no text.
select is(
  (select string_agg(column_name, ',' order by ordinal_position)
   from information_schema.columns where table_schema = 'private' and table_name = 'email_outbox'),
  'id,template,recipient_user_id,recipient_email,exchange_id,sender_id,payload,send_after,sent_at,cancelled_at,claimed_until,attempts,last_error_code,dedupe_key,created_at,for_at',
  'the outbox holds exactly the planned columns: no pair, no reservation, no body');

select ok(
  not has_table_privilege('anon', 'private.email_outbox', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'private.email_outbox', 'select, insert, update, delete')
  and not has_table_privilege('service_role', 'private.email_outbox', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'private.email_outbox', 'select, insert, update')
  and not has_any_column_privilege('authenticated', 'private.email_outbox', 'select, insert, update')
  and not has_any_column_privilege('service_role', 'private.email_outbox', 'select, insert, update'),
  'no API role holds any privilege on the outbox, service_role included (it works through the two functions)');

-- 5-8. Clients are refused (42501, not zero rows) on the outbox and the sender functions (AC-1).
select is(pg_temp.try_as(pg_temp.u(1), 'select 1 from private.email_outbox'), 'err:42501',
  'a signed-in organiser is refused (42501) reading the outbox');
select is(pg_temp.try_as(null, 'select 1 from private.email_outbox'), 'err:42501',
  'a visitor is refused (42501) reading the outbox');
select is(
  pg_temp.try_as(pg_temp.u(1), $$insert into private.email_outbox (template, recipient_email) values ('E06', 'x@example.test')$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), $$update private.email_outbox set sent_at = now()$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), $$delete from private.email_outbox$$)
  || '/' || pg_temp.svc('select 1 from private.email_outbox'),
  'err:42501/err:42501/err:42501/err:42501',
  'writing the outbox is refused (42501) for a signed-in person, and service_role cannot query it either');
select ok(
  not has_function_privilege('anon', 'public.claim_due_emails(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_due_emails(integer)', 'execute')
  and has_function_privilege('service_role', 'public.claim_due_emails(integer)', 'execute')
  and not has_function_privilege('anon', 'public.mark_email_result(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.mark_email_result(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.mark_email_result(uuid, text)', 'execute'),
  'claim_due_emails and mark_email_result are executable by service_role only');

-- 9-10. The sender functions and the writer are refused for the API roles.
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from public.claim_due_emails(5)')
  || '/' || pg_temp.try_as(null, 'select * from public.claim_due_emails(5)')
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select public.mark_email_result('00000000-0000-4000-8000-000000000001')$$)
  || '/' || pg_temp.try_as(null, $$select public.mark_email_result('00000000-0000-4000-8000-000000000001')$$),
  'err:42501/err:42501/err:42501/err:42501',
  'a signed-in person and a visitor are refused (42501) on both sender functions');
select is(
  pg_temp.try_as(pg_temp.u(1), $$select private.enqueue_email('E09', null, 'x@example.test', null, null, null)$$)
  || '/' || pg_temp.try_as(pg_temp.u(1), $$select private.cancel_pending_emails('00000000-0000-4000-8000-000000000001', null)$$),
  'err:42501/err:42501',
  'the writer and the cancel helper are not reachable by a signed-in person');

-- 11-14. join_exchange queues one E07 for the organiser, on a real join only (AC-2, AC-3).
select is(pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'ok:1', 'Bola joins the open exchange');
select is(
  (select format('%s/%s/%s/%s/%s', count(*),
     bool_and(o.recipient_user_id = pg_temp.u(1))::text, bool_and(o.sender_id = pg_temp.u(2))::text,
     bool_and(o.recipient_email is null)::text,
     bool_and(o.payload = jsonb_build_object('exchange_id', o.exchange_id, 'subject_user_id', pg_temp.u(2)))::text)
   from private.email_outbox o
   where o.template = 'E07' and o.exchange_id = current_setting('test.ex_a')::uuid),
  '1/true/true/true/true',
  'one E07 for the organiser: the joiner is the subject, the payload is the two fixed ids, no typed address');
select is(pg_temp.try_as(pg_temp.u(2), format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'ok:1', 'Bola joins again (idempotent)');
select is((select count(*)::int from private.email_outbox where template = 'E07'), 1,
  'the idempotent join queued nothing more');

-- 15-17. request_to_join queues one E08 for the organiser, once per new request.
select is(pg_temp.try_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'ok:1', 'Chi asks to join the approval exchange');
select is(
  (select format('%s/%s/%s/%s', count(*),
     bool_and(o.recipient_user_id = pg_temp.u(1))::text, bool_and(o.sender_id = pg_temp.u(3))::text,
     bool_and(o.payload = jsonb_build_object('exchange_id', o.exchange_id, 'subject_user_id', pg_temp.u(3)))::text)
   from private.email_outbox o
   where o.template = 'E08' and o.exchange_id = current_setting('test.ex_p')::uuid),
  '1/true/true/true',
  'one E08 for the organiser: the asker is the subject, the payload is the two fixed ids');
select is(pg_temp.try_as(pg_temp.u(3), format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'ok:1', 'Chi asks again (idempotent)');
select is((select count(*)::int from private.email_outbox where template = 'E08'), 1,
  'asking again queued nothing more');

-- 18-19. The "Someone joins" toggle is respected for E07 and E08: off, nothing is queued; on again, it resumes.
do $fx$ begin
  update public.user_settings set notify_someone_joins = false where user_id = pg_temp.u(1);
end $fx$;
select is(pg_temp.try_as(pg_temp.u(5), format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'ok:1', 'Eze joins while the organiser has the toggle off');
select is(pg_temp.try_as(pg_temp.u(6), format('select public.request_to_join(%L)', current_setting('test.tok_p'))),
  'ok:1', 'Femi asks while the organiser has the toggle off');
select is((select count(*)::int from private.email_outbox where template in ('E07', 'E08')), 2,
  'with the toggle off, neither a join nor a request queued an email');
do $fx$ begin
  update public.user_settings set notify_someone_joins = true where user_id = pg_temp.u(1);
end $fx$;
select is(pg_temp.try_as(pg_temp.u(8), format('select public.join_exchange(%L)', current_setting('test.tok_a'))),
  'ok:1', 'Hana joins after the toggle is back on');
select is((select count(*)::int from private.email_outbox where template = 'E07'), 2,
  'with the toggle back on, a join queues E07 again');

-- 20-23. approve_join_request queues E09 for the person let in, always (Q8), and no E07 for the organiser.
select is(pg_temp.try_as(pg_temp.u(1), format('select public.approve_join_request(%L)',
  (select id from public.join_requests where user_id = pg_temp.u(3) and exchange_id = current_setting('test.ex_p')::uuid))),
  'ok:1', 'Ada approves Chi (who has every toggle off)');
select is(
  (select format('%s/%s/%s/%s', count(*),
     bool_and(o.recipient_user_id = pg_temp.u(3))::text, bool_and(o.sender_id is null)::text,
     bool_and(o.payload = jsonb_build_object('exchange_id', o.exchange_id))::text)
   from private.email_outbox o
   where o.template = 'E09' and o.exchange_id = current_setting('test.ex_p')::uuid),
  '1/true/true/true',
  'E09 is queued for Chi although every toggle is off; it has no sender and a one-id payload');
select is((select count(*)::int from private.email_outbox
           where template = 'E07' and exchange_id = current_setting('test.ex_p')::uuid), 0,
  'approving queues no E07 for the organiser (Q8)');
select ok((select not (notify_names_drawn or notify_someone_joins or notify_join_by_reminder or notify_event_reminder)
           from public.user_settings where user_id = pg_temp.u(3)),
  'control: Chi still has every toggle off');

-- 24-25. An anonymised recipient is skipped (GC-028).
do $fx$ begin
  update public.profiles set anonymised_at = now() where id = pg_temp.u(6);
end $fx$;
select is(pg_temp.try_as(pg_temp.u(1), format('select public.approve_join_request(%L)',
  (select id from public.join_requests where user_id = pg_temp.u(6) and exchange_id = current_setting('test.ex_p')::uuid))),
  'ok:1', 'Ada approves Femi, whose account has been anonymised');
select is((select count(*)::int from private.email_outbox where recipient_user_id = pg_temp.u(6)), 0,
  'nothing is queued for an anonymised person');

-- 26-33. remove_member queues E12, always, and cancels that person's other unsent rows for the exchange first.
-- p1 is Dayo's unsent row about P (must be cancelled), p2 an unsent row about A (must stay), p3 a sent row about P
-- (must stay untouched). The dedupe keys tag them.
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, dedupe_key)
    values ('E09', pg_temp.u(4), current_setting('test.ex_p')::uuid, 'T220-p1'),
           ('E09', pg_temp.u(4), current_setting('test.ex_a')::uuid, 'T220-p2');
  insert into private.email_outbox (template, recipient_user_id, exchange_id, dedupe_key, sent_at)
    values ('E09', pg_temp.u(4), current_setting('test.ex_p')::uuid, 'T220-p3', now());
end $fx$;
select is(pg_temp.try_as(pg_temp.u(7), format('select public.remove_member(%L)',
  (select id from public.exchange_members where user_id = pg_temp.u(4) and exchange_id = current_setting('test.ex_p')::uuid))),
  'err:P0002', 'an outsider cannot remove Dayo');
select is(pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)',
  (select id from public.exchange_members where user_id = pg_temp.u(1) and exchange_id = current_setting('test.ex_p')::uuid))),
  'err:22023', 'the organiser''s own row cannot be removed');
select is((select count(*)::int from private.email_outbox where template = 'E12'), 0,
  'a refused removal queued no E12');
select is(pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)',
  (select id from public.exchange_members where user_id = pg_temp.u(4) and exchange_id = current_setting('test.ex_p')::uuid))),
  'ok:1', 'Ada removes Dayo (who has every toggle off)');
select is(
  (select format('%s/%s/%s/%s/%s', count(*),
     bool_and(o.recipient_user_id = pg_temp.u(4))::text, bool_and(o.sender_id is null)::text,
     bool_and(o.payload = jsonb_build_object('exchange_id', o.exchange_id))::text,
     bool_and(o.cancelled_at is null and o.sent_at is null)::text)
   from private.email_outbox o
   where o.template = 'E12'),
  '1/true/true/true/true',
  'one E12 for Dayo although every toggle is off: no sender, no subject, a one-id payload, not cancelled');
select ok(
  (select not exists (select 1 from private.email_outbox o
     where o.template = 'E12' and (o.payload::text like '%' || pg_temp.u(1)::text || '%' or o.sender_id = pg_temp.u(1)))),
  'E12 does not name the organiser');
select is(
  (select format('%s/%s/%s',
     (select (cancelled_at is not null and sent_at is null)::text from private.email_outbox where dedupe_key = 'T220-p1'),
     (select (cancelled_at is null and sent_at is null)::text from private.email_outbox where dedupe_key = 'T220-p2'),
     (select (cancelled_at is null and sent_at is not null)::text from private.email_outbox where dedupe_key = 'T220-p3'))),
  'true/true/true',
  'removal cancelled Dayo''s unsent row for this exchange, kept the unsent row for another exchange and the sent row');
select is((select count(*)::int from private.email_outbox where template = 'E12' and recipient_user_id <> pg_temp.u(4)), 0,
  'E12 went to the removed person alone');

-- 34-38. No pair, reservation or foreign address in any row the RPCs wrote (AC-2).
select ok(
  not exists (select 1 from private.email_outbox o
    where exists (select 1 from jsonb_object_keys(o.payload) k where k not in ('exchange_id', 'subject_user_id'))),
  'every payload holds only exchange_id and subject_user_id');
select ok(
  not exists (select 1 from private.email_outbox o
    where o.template <> 'E06' and (o.recipient_email is not null or o.payload::text like '%@%')),
  'no address sits in any row except E06''s typed recipient');
select ok(
  not exists (select 1 from private.email_outbox o where o.recipient_user_id::text = o.payload ->> 'subject_user_id'),
  'no row is about its own recipient');
select ok(
  not exists (
    select 1 from pg_proc p
    where p.oid in (
      'public.join_exchange(text)'::regprocedure, 'public.request_to_join(text)'::regprocedure,
      'public.approve_join_request(uuid)'::regprocedure, 'public.remove_member(uuid)'::regprocedure,
      'private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)'::regprocedure,
      'private.cancel_pending_emails(uuid, uuid)'::regprocedure, 'public.claim_due_emails(integer)'::regprocedure,
      'public.mark_email_result(uuid, text)'::regprocedure)
      and (p.prosrc ilike '%assign%' or p.prosrc ilike '%reserv%')),
  'no trigger or sender function reads an assignment or a reservation');
select is((select count(*)::int from private.email_outbox where template = 'E06'), 0,
  'the four RPCs queued no E06 (it comes from the invite function)');

-- 39-44. The writer, as the migration role: skips, dedupes and keeps the table's own rules.
select ok(private.enqueue_email('E09', pg_temp.u(6), null, current_setting('test.ex_p')::uuid, null, null) is null,
  'enqueue_email returns null for an anonymised person');
select is(pg_temp.own($$select private.enqueue_email('E99', null, 'x@example.test', null, null, null)$$), 'err:23514',
  'an unknown template is refused');
do $fx$ begin
  perform set_config('test.dd1',
    (private.enqueue_email('E09', pg_temp.u(2), null, current_setting('test.ex_a')::uuid, null, null, 'T220-dd') is not null)::text, true);
  perform set_config('test.dd2',
    (private.enqueue_email('E09', pg_temp.u(2), null, current_setting('test.ex_a')::uuid, null, null, 'T220-dd') is null)::text, true);
end $fx$;
select is(
  current_setting('test.dd1') || '/' || current_setting('test.dd2') || '/'
  || (select count(*)::text from private.email_outbox where dedupe_key = 'T220-dd'),
  'true/true/1', 'a repeated dedupe key queues nothing: one row');
select is(
  pg_temp.own(format($$insert into private.email_outbox (template, recipient_user_id, recipient_email) values ('E09', %L, 'x@example.test')$$, pg_temp.u(2)))
  || '/' || pg_temp.own($$insert into private.email_outbox (template) values ('E09')$$),
  'err:23514/err:23514', 'a row has exactly one recipient');
select is(pg_temp.own($$insert into private.email_outbox (template, recipient_email) values ('E06', 'not-an-address')$$), 'err:23514',
  'a typed recipient must look like an address');
select ok(private.enqueue_email('E06', null, 'typed-220@example.test', current_setting('test.ex_a')::uuid, pg_temp.u(1), null) is not null,
  'a typed address is queued (E06 has no toggle and no profile check)');

-- 45-60. The sender: claim once, with the one address; mark the result; retry, cancel, give up (AC-13).
-- Setup: a row in the future (not due), and a row for the anonymised Femi (undeliverable).
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, dedupe_key, send_after)
    values ('E09', pg_temp.u(2), current_setting('test.ex_a')::uuid, 'T220-future', now() + interval '1 hour');
  insert into private.email_outbox (template, recipient_user_id, exchange_id, dedupe_key)
    values ('E09', pg_temp.u(6), current_setting('test.ex_p')::uuid, 'T220-femi');
end $fx$;
do $fx$ begin
  perform pg_temp.claim_as_svc(50, 'test.claim1');
end $fx$;

select ok(jsonb_array_length(current_setting('test.claim1')::jsonb) >= 8,
  'the first claim returns the due rows');
select ok(
  not exists (
    select 1 from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
    join private.email_outbox o on o.id = (c ->> 'id')::uuid
    left join auth.users u on u.id = o.recipient_user_id
    where c ->> 'to_email' is distinct from coalesce(u.email::text, o.recipient_email)),
  'every claimed row carries only its own recipient''s address');
select is(
  (select format('%s/%s/%s/%s/%s', c ->> 'to_name', c ->> 'other_name', c ->> 'exchange_name',
                 (c ->> 'invite_token' is null)::text, c ->> 'to_email')
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
   join private.email_outbox o on o.id = (c ->> 'id')::uuid
   where o.template = 'E07' and o.payload ->> 'subject_user_id' = pg_temp.u(2)::text),
  'Ada/Bola/T220 Open/true/u220-1@example.test',
  'E07 shows the organiser''s name and address, the joiner''s name, the exchange name and no invite token');
select is(
  (select format('%s/%s/%s/%s/%s', (c ->> 'to_name' is null)::text, c ->> 'other_name', c ->> 'to_timezone',
                 (c ->> 'invite_token' = (select invite_token from public.exchanges where id = current_setting('test.ex_a')::uuid))::text,
                 c ->> 'to_email')
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
   where c ->> 'template' = 'E06'),
  'true/Ada/Africa/Lagos/true/typed-220@example.test',
  'E06 goes to the typed address with the inviter''s name, the organiser''s zone and the invite token');
select is(
  (select format('%s/%s/%s/%s', c ->> 'to_name', (c ->> 'other_name' is null)::text, (c ->> 'invite_token' is null)::text, c ->> 'to_email')
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
   where c ->> 'template' = 'E12'),
  'Dayo/true/true/u220-4@example.test',
  'E12 carries the removed person''s name and address and no other name or token');
select ok(
  (select bool_and(c ->> 'other_name' is null and c ->> 'invite_token' is null)
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c where c ->> 'template' = 'E09'),
  'E09 carries no other name and no token');
-- Round 3: the claim also carries what E06 shows (budget, join-by, gift day, note). Only E06 gets them.
select is(
  (select format('%s/%s/%s/%s', c ->> 'budget_preset', (c ->> 'join_by_at' is not null)::text,
                 (c ->> 'gift_day' is not null)::text, (c ? 'note')::text)
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
   where c ->> 'template' = 'E06'),
  '10k_20k/true/true/true', 'E06 carries the budget preset, join-by, gift day and the note field');
select ok(
  (select bool_and(c ->> 'budget_preset' is null and c ->> 'join_by_at' is null and c ->> 'gift_day' is null and c ->> 'note' is null)
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c where c ->> 'template' not in ('E06', 'E19', 'E21'))
  and coalesce((select bool_and(c ->> 'join_by_at' is null and c ->> 'note' is null)
       from jsonb_array_elements(current_setting('test.claim1')::jsonb) c where c ->> 'template' in ('E19', 'E21')), true),
  'no other template carries the exchange details; E19 and E21 (slice 10) carry the budget and gift day only');
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('test.claim1')::jsonb) c,
          jsonb_object_keys(c) k
   -- WHY 'revealed' is allowed (slice 12, owner decision Q1 2026-11-24): the claim gains one column, true or false for E24 only,
   -- the reader's OWN reveal flag (no receiver, no giver, no pair). Test 370 pins the exact column list.
   where k not in ('id', 'template', 'to_email', 'to_name', 'to_timezone', 'exchange_id', 'exchange_name', 'other_name',
                   'invite_token', 'attempts', 'budget_preset', 'join_by_at', 'gift_day', 'note', 'draw_mode', 'draw_at', 'people_count', 'revealed')),
  0, 'a claimed row has no column for a draw result, a pair, an assignment, a reservation or a second address');
-- Slice 8 (owner decision 2026-11-18 4): the claim also carries the draw mode and time, for E10 only, and E10 is a known
-- template. They fail until the readiness_and_nudges migration is applied.
select ok(
  (select bool_and(c ->> 'draw_mode' is null and c ->> 'draw_at' is null)
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c where c ->> 'template' <> 'E10'),
  'no template but E10 carries the draw mode or time');
select ok(
  (select pg_get_constraintdef(c.oid) like '%''E10''%' and pg_get_constraintdef(c.oid) like '%''E12''%'
   from pg_constraint c where c.conrelid = 'private.email_outbox'::regclass and c.conname = 'email_outbox_template_known'),
  'E10 is a known template beside E06 to E09 and E12');
select ok(
  not exists (select 1 from jsonb_array_elements(current_setting('test.claim1')::jsonb) c,
                     jsonb_each_text(c) kv
              where kv.key <> 'to_email' and kv.value like '%@%'),
  'no claimed value but to_email holds an address');
select ok(
  not exists (select 1 from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
              where c ->> 'id' in (select id::text from private.email_outbox
                                   where dedupe_key in ('T220-future', 'T220-femi', 'T220-p1', 'T220-p3'))),
  'the claim skips a row that is not due yet, an anonymised person''s row, a cancelled row and a sent row');
select is((select format('%s/%s', last_error_code, (cancelled_at is not null)::text) from private.email_outbox where dedupe_key = 'T220-femi'),
  'no_recipient/true', 'the anonymised person''s row was cancelled by the claim');
select is(
  (select format('%s/%s', min((c ->> 'attempts')::int), max((c ->> 'attempts')::int))
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c),
  '1/1', 'a claim counts one attempt');

-- Exactly once: a second claim in the same minute returns nothing that the first one leased.
do $fx$ begin
  perform pg_temp.claim_as_svc(50, 'test.claim2');
end $fx$;
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('test.claim2')::jsonb) c
   where c ->> 'id' in (select x ->> 'id' from jsonb_array_elements(current_setting('test.claim1')::jsonb) x)),
  0, 'a second claim returns none of the leased rows (exactly once)');

-- Mark a success: the row is sent and never claimed again.
select is(pg_temp.svc(format('select public.mark_email_result(%L)',
  (select id from private.email_outbox where template = 'E12'))), 'ok:1',
  'service_role marks the E12 row sent');
select is((select format('%s/%s/%s', (sent_at is not null)::text, (claimed_until is null)::text, (last_error_code is null)::text)
           from private.email_outbox where template = 'E12'), 'true/true/true',
  'a success sets sent_at and leaves no error');
-- A result for a cancelled row is ignored (the removal cancelled p1).
select is(pg_temp.svc(format('select public.mark_email_result(%L)',
  (select id from private.email_outbox where dedupe_key = 'T220-p1'))),
  'ok:1', 'service_role reports on a cancelled row');
select is((select (sent_at is null and cancelled_at is not null)::text from private.email_outbox where dedupe_key = 'T220-p1'),
  'true', 'the result for a cancelled row is ignored');

-- Mark a failure: the code is kept, the row waits for a retry; the lease then expires and it comes back.
select is(pg_temp.svc(format('select public.mark_email_result(%L, %L)',
  (select id from private.email_outbox where dedupe_key = 'T220-dd'), 'resend_5xx')), 'ok:1',
  'service_role reports a failed send');
select is(
  (select format('%s/%s/%s/%s', (sent_at is null)::text, (cancelled_at is null)::text, last_error_code, (claimed_until > now())::text)
   from private.email_outbox where dedupe_key = 'T220-dd'),
  'true/true/resend_5xx/true', 'a failure keeps the row, records the code and waits before a retry');
do $fx$ begin
  update private.email_outbox set claimed_until = now() - interval '1 minute' where dedupe_key = 'T220-dd';
  perform pg_temp.claim_as_svc(50, 'test.claim3');
end $fx$;
select is(
  (select format('%s/%s', count(*), max((c ->> 'attempts')::int))
   from jsonb_array_elements(current_setting('test.claim3')::jsonb) c
   where c ->> 'id' = (select id::text from private.email_outbox where dedupe_key = 'T220-dd')),
  '1/2', 'after the wait the failed row is claimed again as attempt 2');

-- A fifth failed attempt cancels the row; a row that used its attempts with no result is given up on.
do $fx$ begin
  update private.email_outbox set attempts = 5 where dedupe_key = 'T220-dd';
end $fx$;
select is(pg_temp.svc(format('select public.mark_email_result(%L, %L)',
  (select id from private.email_outbox where dedupe_key = 'T220-dd'), 'resend_5xx')), 'ok:1',
  'service_role reports the fifth failure');
select is((select format('%s/%s', (cancelled_at is not null)::text, (claimed_until is null)::text) from private.email_outbox where dedupe_key = 'T220-dd'),
  'true/true', 'the fifth failure cancels the row');
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, dedupe_key, attempts, claimed_until)
    values ('E09', pg_temp.u(2), current_setting('test.ex_a')::uuid, 'T220-stuck', 5, now() - interval '1 minute');
  perform pg_temp.claim_as_svc(50, 'test.claim4');
end $fx$;
select is(
  (select format('%s/%s/%s', (cancelled_at is not null)::text, last_error_code,
     (select count(*) from jsonb_array_elements(current_setting('test.claim4')::jsonb) c
       where c ->> 'id' = o.id::text))
   from private.email_outbox o where o.dedupe_key = 'T220-stuck'),
  'true/gave_up/0', 'a row with five attempts and no result is cancelled and not returned');

select * from finish();
rollback;
