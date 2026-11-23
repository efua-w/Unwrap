-- 310_draw_names — slice 10 (GCO-011 manual draw, GCO-012 names drawn, GC-007 Names drawn event, GC-012 requests closed by the
-- draw; plan §5, §6 invariants 1-5, 7, 9, 10; owner decisions 2026-11-22 Q1-Q12 in docs/tasks/slice-10.md).
-- Covers: the six new public functions are SECURITY DEFINER with an empty search_path, closed to a visitor (42501) and open
-- to signed-in people (AC-2); only the organiser can draw, anyone else gets P0002 (AC-6); fewer than three people is
-- refused (22023 'few'), an impossible set of pairs is refused (22023 'exclusions'), a cancelled or finished exchange is
-- refused, and nothing is written on any refusal; the draw writes exactly one current row per person taking part forming a
-- permutation with no self and no excluded pair, bumps draw_round and clears draw_blocked_reason, works before join-by
-- (Q2) and is idempotent: a second call writes and queues nothing (AC-7); afterwards the state is 'drawn' and join, ask,
-- approve, remove, save pairs, nudge, invite and attach are all refused (AC-8); pending requests close with decided_at and
-- unsent E10 nudges are cancelled (AC-9, Q12); E19 is queued for each person taking part who has the toggle on, E21 for an
-- organiser just organising, and no email row names anyone but the reader and the organiser (AC-10); a names_drawn
-- activity event goes to each person taking part and carries no subject (Q6); the asker sees a closed request and can
-- dismiss it (Q5); an organiser just organising reads no assignment (AC-3); an organiser taking part reads exactly their
-- own (AC-4); each member reads only the person they give to and no function returns a giver (AC-5).
-- Self-contained: creates its own users inside the transaction (needs the migrations through the draw_and_reveal one
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T310" because dev holds other data.
-- Written BEFORE the draw_and_reveal migration: until it is applied the first statement that names a draw function fails
-- and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 37", "1..37", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(37);

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

-- val_as returns one value read as a persona (null = anon), or 'err:<SQLSTATE>:<hint>'.
create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
  h text;
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
    get stacked diagnostics h = pg_exception_hint;
    reset role;
    return 'err:' || sqlstate || ':' || coalesce(h, '');
  end;
end $$;

-- run_as runs a statement that returns no useful value (a void function) as a persona: '1' or 'err:<SQLSTATE>:<hint>'.
create function pg_temp.run_as(who uuid, stmt text) returns text
language sql as $$
  select pg_temp.val_as(who, format('(select count(*) from (%s) s)', stmt))
$$;

-- owner_try runs a statement as the migration role (no role switch) and returns the SQLSTATE or 'ok'.
create function pg_temp.owner_try(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return sqlstate;
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

create function pg_temp.mk(p_name text, p_taking boolean) returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, %s, true)',
    p_name, '10k_20k', 'organiser_chooses', '18:00', 'Africa/Lagos', p_taking::text)
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

-- u(n) is persona n: 1 Ada (organiser of P, takes part), 2 Bola, 3 Chi, 4 Dayo, 5 Eze (members of P; Eze has Names are
-- drawn emails off), 6 Gbemi (organiser of Q, only organising), 7 Hana, 8 Ife, 9 Jide, 10 Kemi (members of Q),
-- 11 Lola (organiser of X), 12 Mo (outsider to P and Q, member of X), 13 Nia (asked to join P), 14 Ola (asked to join Q),
-- 15 Pat (member of X).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('31' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.mid(ex text, nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = ex::uuid and p.display_name = nm and m.state = 'active'
$$;

-- recip_check: for every current assignment of an exchange, the GIVER reads the name of their own RECEIVER through
-- get_my_recipient. Returns "<givers checked>/<mismatches>". WHY the rows are copied to a variable first: the persona
-- switch inside val_as must not happen under an open scan of the table.
create function pg_temp.recip_check(ex text) returns text
language plpgsql as $$
declare
  v jsonb;
  r record;
  n int := 0;
  bad int := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('uid', gm.user_id, 'expected', rp.display_name)), '[]'::jsonb) into v
    from private.assignments a
    join public.exchange_members gm on gm.id = a.giver_member_id
    join public.exchange_members rm on rm.id = a.receiver_member_id
    join public.profiles rp on rp.id = rm.user_id
   where a.exchange_id = ex::uuid and a.superseded_at is null;
  for r in select (x ->> 'uid')::uuid as uid, x ->> 'expected' as expected from jsonb_array_elements(v) x loop
    n := n + 1;
    if pg_temp.val_as(r.uid, format('(select coalesce(string_agg(display_name, ''|''), ''none'') from public.get_my_recipient(%L))', ex))
       is distinct from r.expected then
      bad := bad + 1;
    end if;
  end loop;
  return n || '/' || bad;
end $$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u310-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi', 'Lola', 'Mo', 'Nia', 'Ola', 'Pat'])[i]))
  from generate_series(1, 15) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T310 Pool', true));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T310 Quiet', false));
  perform pg_temp.try_as(pg_temp.u(11), pg_temp.mk('T310 Few', true));
  -- WHY a guard: try_as swallows errors, so a failed create would otherwise show only as a uuid error much later.
  -- It adds no assertion; it reports the real SQLSTATE if an exchange was not created.
  if (select count(*) from public.exchanges where name in ('T310 Pool', 'T310 Quiet', 'T310 Few')) <> 3 then
    raise exception 'T310 fixture: exchanges not created; create_exchange gave Pool=%, Quiet=%, Few=%',
      pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T310 Pool', true)),
      pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T310 Quiet', false)),
      pg_temp.try_as(pg_temp.u(11), pg_temp.mk('T310 Few', true));
  end if;
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T310 Pool'), true);
  perform set_config('test.ex_q', (select id::text from public.exchanges where name = 'T310 Quiet'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T310 Few'), true);
  perform set_config('test.tok_p', (select invite_token from public.exchanges where name = 'T310 Pool'), true);
  perform set_config('test.tok_q', (select invite_token from public.exchanges where name = 'T310 Quiet'), true);
  perform set_config('test.tok_x', (select invite_token from public.exchanges where name = 'T310 Few'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3, 4, 5]) n;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_q')::uuid, pg_temp.u(n), true, now() - make_interval(days => 20 - n) from unnest(array[7, 8, 9, 10]) n;
  -- Q has already closed joining; P is still open (the draw may come before join-by, owner decision Q2).
  update public.exchanges set join_by_at = now() - interval '1 hour', draw_blocked_reason = 'x' where id = current_setting('test.ex_q')::uuid;
  update public.user_settings set notify_names_drawn = false where user_id = pg_temp.u(5);
end $fx$;

-- Two people ask to join, as the app does (both exchanges ask for approval).
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(13), format('select public.request_to_join(%L)', current_setting('test.tok_p')));
  perform pg_temp.try_as(pg_temp.u(14), format('select public.request_to_join(%L)', current_setting('test.tok_q')));
end $fx$;

-- Pairs in P: Bola and Chi never draw each other, nor do Dayo and Eze.
do $fx$ begin
  insert into public.exclusions (exchange_id, first_member_id, second_member_id) values
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Bola'), pg_temp.mid(current_setting('test.ex_p'), 'Chi')),
    (current_setting('test.ex_p')::uuid, pg_temp.mid(current_setting('test.ex_p'), 'Dayo'), pg_temp.mid(current_setting('test.ex_p'), 'Eze'));
end $fx$;

-- Unsent nudges: Bola in P (to be cancelled), Chi in P already sent (stays), Hana in Q (stays until Q is drawn).
do $fx$ begin
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key, sent_at) values
    ('E10', pg_temp.u(3), current_setting('test.ex_p')::uuid, pg_temp.u(1), 'T310-chi-sent', now());
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key, send_after) values
    ('E10', pg_temp.u(2), current_setting('test.ex_p')::uuid, pg_temp.u(1), 'T310-bola', now() + interval '1 day'),
    ('E10', pg_temp.u(7), current_setting('test.ex_q')::uuid, pg_temp.u(6), 'T310-hana', now() + interval '1 day');
end $fx$;

-- 1. Shape: the six new public functions are SECURITY DEFINER with an empty search_path (040 checks all schemas).
select ok(
  (select count(*) = 6 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('draw_names', 'get_draw_summary', 'get_my_assignment', 'get_my_recipient', 'mark_assignment_revealed', 'dismiss_join_request')),
  'the six new public functions are SECURITY DEFINER with an empty search_path');

-- 2. AC-2 grants: anon cannot execute any of them (and so is not on the 030 allowlist); signed-in people can.
select ok(
  not has_function_privilege('anon', 'public.draw_names(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_draw_summary(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_assignment(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_recipient(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.mark_assignment_revealed(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.dismiss_join_request(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.draw_names(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_draw_summary(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_assignment(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_recipient(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.mark_assignment_revealed(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.dismiss_join_request(uuid)', 'execute'),
  'anon cannot execute the draw functions and signed-in people can');

-- 3. What is returned. WHY exact strings: a column that could hold a giver or a pair must be added on purpose, with this
-- test changed in the open. The assignment id is the giver's own row id (not a member or person id).
select is(
  pg_get_function_result('public.draw_names(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.get_draw_summary(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.get_my_assignment(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.get_my_recipient(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.mark_assignment_revealed(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.dismiss_join_request(uuid)'::regprocedure),
  'TABLE(people_count integer, pairs_excluded integer, emails_queued integer, drawn_now boolean)'
  || '/' || 'TABLE(people_count integer, drawn_at timestamp with time zone, emails_queued integer)'
  || '/' || 'TABLE(assignment_id uuid, revealed boolean)'
  || '/' || 'TABLE(display_name text, avatar_path text, list_state text, most_wanted jsonb)'
  || '/' || 'timestamp with time zone'
  || '/' || 'void',
  'the draw functions return counts, times, the giver''s own row id, and the receiver''s name and list only');

-- 4. AC-2: a visitor is refused (42501) on all six.
select is(
  pg_temp.try_as(null, format('select * from public.draw_names(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.get_draw_summary(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.get_my_assignment(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.get_my_recipient(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select public.mark_assignment_revealed(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select public.dismiss_join_request(%L)', gen_random_uuid())),
  'err:42501/err:42501/err:42501/err:42501/err:42501/err:42501',
  'a visitor is refused (42501) on every draw function');

-- 5. AC-6: only the organiser can draw. A member, an outsider, another exchange's organiser and a person who asked get
-- P0002, and nothing is written.
select is(
  pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(12), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(6), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(13), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_p')))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || private.exchange_status(current_setting('test.ex_p')::uuid)::text,
  'err:P0002:/err:P0002:/err:P0002:/err:P0002:/0/open',
  'only the organiser can draw: everyone else gets P0002 and nothing is written');

-- 6-7. Fewer than three people taking part is refused with the hint few. X holds Lola alone, then Lola and Mo.
select is(
  pg_temp.val_as(pg_temp.u(11), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_x'))),
  'err:22023:few', 'one person is not enough to draw (22023, few)');
do $fx$ begin
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_x')::uuid, pg_temp.u(12), true, now() - interval '1 day');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(11), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_x'))),
  'err:22023:few', 'two people are not enough to draw (22023, few)');

-- 8. A third person, but Lola is excluded from both: no fair draw exists (22023, exclusions). Nothing is written.
do $fx$ begin
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_x')::uuid, pg_temp.u(15), true, now() - interval '1 hour');
  insert into public.exclusions (exchange_id, first_member_id, second_member_id) values
    (current_setting('test.ex_x')::uuid, pg_temp.mid(current_setting('test.ex_x'), 'Lola'), pg_temp.mid(current_setting('test.ex_x'), 'Mo')),
    (current_setting('test.ex_x')::uuid, pg_temp.mid(current_setting('test.ex_x'), 'Lola'), pg_temp.mid(current_setting('test.ex_x'), 'Pat'));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(11), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_x')))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_x')::uuid)
  || '/' || (select draw_round::text from public.exchanges where id = current_setting('test.ex_x')::uuid)
  || '/' || (select count(*)::text from private.email_outbox where exchange_id = current_setting('test.ex_x')::uuid)
  || '/' || (select count(*)::text from public.activity_events where exchange_id = current_setting('test.ex_x')::uuid),
  'err:22023:exclusions/0/0/0/0', 'an impossible set of pairs is refused (22023, exclusions) and nothing is written or queued');

-- 9. A cancelled exchange and a finished one cannot be drawn.
do $fx$ begin
  update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_x')::uuid;
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(11), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_x'))),
  'err:22023:cancelled', 'a cancelled exchange cannot be drawn (22023, cancelled)');
do $fx$ begin
  update public.exchanges set cancelled_at = null, completed_at = now() where id = current_setting('test.ex_x')::uuid;
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(11), format('(select count(*) from public.draw_names(%L))', current_setting('test.ex_x'))),
  'err:22023:closed', 'a finished exchange cannot be drawn (22023, closed)');

-- 10. AC-7: Ada draws P while joining is still open. Five people, two pairs, four emails (Eze has them off).
select is(
  pg_temp.val_as(pg_temp.u(1), format($q$(select people_count::text || '/' || pairs_excluded::text || '/' || emails_queued::text || '/' || drawn_now::text
    from public.draw_names(%L))$q$, current_setting('test.ex_p'))),
  '5/2/4/true', 'the organiser draws: 5 people, 2 pairs, 4 emails queued, drawn now');

-- 11. AC-8, Q2: the state is drawn although the join-by moment is still ahead.
select is(
  private.exchange_status(current_setting('test.ex_p')::uuid)::text
  || '/' || (select (join_by_at > now())::text from public.exchanges where id = current_setting('test.ex_p')::uuid)
  || '/' || pg_temp.val_as(pg_temp.u(2), format('public.exchange_state(%L)', current_setting('test.ex_p'))),
  'drawn/true/drawn', 'the exchange is drawn before join-by, and a member reads the state as drawn');

-- 12. AC-7: exactly one current row per person taking part, a permutation, no self, no excluded pair, one draw round.
select ok(
  (select count(*) = 5
      and count(distinct a.giver_member_id) = 5 and count(distinct a.receiver_member_id) = 5
      and bool_and(a.giver_member_id <> a.receiver_member_id and a.kind = 'full' and a.draw_round = 1
                   and a.superseded_at is null and a.revealed_at is null)
      and array_agg(a.giver_member_id order by a.giver_member_id)
          = (select array_agg(m.id order by m.id) from public.exchange_members m
             where m.exchange_id = a.exchange_id and m.state = 'active' and m.taking_part)
      and array_agg(a.receiver_member_id order by a.receiver_member_id)
          = (select array_agg(m.id order by m.id) from public.exchange_members m
             where m.exchange_id = a.exchange_id and m.state = 'active' and m.taking_part)
   from private.assignments a where a.exchange_id = current_setting('test.ex_p')::uuid group by a.exchange_id)
  and not exists (
    select 1 from private.assignments a join public.exclusions x on x.exchange_id = a.exchange_id
     where a.exchange_id = current_setting('test.ex_p')::uuid
       and ((a.giver_member_id = x.first_member_id and a.receiver_member_id = x.second_member_id)
         or (a.giver_member_id = x.second_member_id and a.receiver_member_id = x.first_member_id)))
  and (select draw_round = 1 and draw_blocked_reason is null from public.exchanges where id = current_setting('test.ex_p')::uuid),
  'the draw wrote 5 rows forming a permutation of the people taking part, no self, no excluded pair, round 1');

-- 13. AC-7: a second call is idempotent. It reports the existing draw, writes nothing and queues nothing.
select is(
  pg_temp.val_as(pg_temp.u(1), format($q$(select people_count::text || '/' || pairs_excluded::text || '/' || emails_queued::text || '/' || drawn_now::text
    from public.draw_names(%L))$q$, current_setting('test.ex_p')))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || (select count(*)::text from private.email_outbox where template = 'E19' and exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || (select count(*)::text from public.activity_events where kind = 'names_drawn' and exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || (select draw_round::text from public.exchanges where id = current_setting('test.ex_p')::uuid),
  '5/2/0/false/5/4/5/1', 'a second draw writes nothing and queues nothing, and the round stays 1');

-- 14. AC-8: once drawn, joining, asking, approving, removing, changing pairs and nudging are all refused (22023,
-- hint closed). A pending request is written directly for Mo so approve has something to refuse.
-- WHY no invite here (owner decision 2026-11-23): send_email_invite is revoked from signed-in users (20261117213330), so it
-- answers 42501 before any state check; test 230 covers that.
do $fx$ begin
  insert into public.join_requests (exchange_id, user_id) values (current_setting('test.ex_p')::uuid, pg_temp.u(12));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(12), format('public.join_exchange(%L)', current_setting('test.tok_p')))
  || '/' || pg_temp.val_as(pg_temp.u(15), format('public.request_to_join(%L)', current_setting('test.tok_p')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.approve_join_request(%L)',
      (select id from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(12) and status = 'pending')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.remove_member(%L)', pg_temp.mid(current_setting('test.ex_p'), 'Bola')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select public.save_exclusions(%L, array[]::uuid[], array[]::uuid[])', current_setting('test.ex_p')))
  || '/' || pg_temp.run_as(pg_temp.u(1), format('select count(*) from public.send_nudge(%L, array[%L]::uuid[])', current_setting('test.ex_p'), pg_temp.mid(current_setting('test.ex_p'), 'Bola'))),
  'err:22023:closed/err:22023:closed/err:22023:closed/err:22023:closed/err:22023:closed/err:22023:closed',
  'after the draw join, ask, approve, remove, save pairs and nudge are refused (22023, closed)');

-- 15. AC-8: attaching a list or switching to ideas is refused too (P0002, as for any closed exchange), and nothing changes.
do $fx$ begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T310 Bola list');
end $fx$;
select is(
  pg_temp.run_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_p'),
    (select id from public.wishlists where name = 'T310 Bola list')))
  || '/' || pg_temp.run_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_p')))
  || '/' || (select count(*)::text from public.exchange_members where exchange_id = current_setting('test.ex_p')::uuid and attached_wishlist_id is not null),
  'err:P0002:/err:P0002:/0', 'attaching a list or using ideas after the draw is refused and attaches nothing');

-- 16. AC-9: the request that was pending is closed with a decision time; the unsent nudge is cancelled, the sent one is
-- left alone, and another exchange's nudge is untouched.
select is(
  (select r.status::text || ':' || (r.decided_at is not null)::text
   from public.join_requests r where r.exchange_id = current_setting('test.ex_p')::uuid and r.user_id = pg_temp.u(13))
  || '/' || (select (o.cancelled_at is not null)::text from private.email_outbox o where o.dedupe_key = 'T310-bola')
  || '/' || (select (o.sent_at is not null and o.cancelled_at is null)::text from private.email_outbox o where o.dedupe_key = 'T310-chi-sent')
  || '/' || (select (o.cancelled_at is null)::text from private.email_outbox o where o.dedupe_key = 'T310-hana'),
  'closed:true/true/true/true', 'the draw closes pending requests and cancels unsent nudges for this exchange only');

-- 17. Q5: Nia sees the closed request with the organiser's name, and only she does.
select is(
  pg_temp.val_as(pg_temp.u(13), $$(select string_agg(format('%s:%s:%s', exchange_name, organiser_name, status::text), '|') from public.list_my_join_requests())$$)
  || '/' || pg_temp.val_as(pg_temp.u(2), $$(select count(*) from public.list_my_join_requests())$$)
  || '/' || pg_temp.val_as(pg_temp.u(14), $$(select string_agg(exchange_name, '|') from public.list_my_join_requests())$$),
  'T310 Pool:Ada:closed/0/T310 Quiet',
  'the asker sees their request on the drawn exchange as closed; nobody else does; Ola''s is still pending');

-- 18. Q5: Dismiss. Only the asker's own closed request: someone else's is P0002, a pending one is refused (22023, status).
-- WHY the dismissals are their own statement: the dismissed_at read below must see what they wrote (same-statement trap).
do $fx$ begin
  perform set_config('test.dismiss', pg_temp.run_as(pg_temp.u(14), format('select public.dismiss_join_request(%L)',
    (select id from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(13))))
  || '/' || pg_temp.run_as(pg_temp.u(14), format('select public.dismiss_join_request(%L)',
    (select id from public.join_requests where exchange_id = current_setting('test.ex_q')::uuid and user_id = pg_temp.u(14))))
  || '/' || pg_temp.run_as(pg_temp.u(13), format('select public.dismiss_join_request(%L)',
    (select id from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(13))))
  || '/' || pg_temp.run_as(pg_temp.u(13), format('select public.dismiss_join_request(%L)',
    (select id from public.join_requests where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(13)))), true);
end $fx$;
select is(
  current_setting('test.dismiss')
  || '/' || pg_temp.val_as(pg_temp.u(13), $$(select count(*) from public.list_my_join_requests())$$)
  || '/' || (select (dismissed_at is not null)::text from public.join_requests
             where exchange_id = current_setting('test.ex_p')::uuid and user_id = pg_temp.u(13)),
  'err:P0002:/err:22023:status/1/1/0/true',
  'a request can be dismissed by its asker once it is closed, again is harmless, and it leaves their list');

-- 19. AC-10: E19 for each person taking part with the toggle on (Eze turned it off), from the organiser.
select is(
  (select string_agg(p.display_name, '|' order by p.display_name)
   from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
   where o.template = 'E19' and o.exchange_id = current_setting('test.ex_p')::uuid and o.cancelled_at is null and o.sent_at is null),
  'Ada|Bola|Chi|Dayo', 'E19 is queued for everyone taking part except the person who turned it off');

-- 20. AC-10: an E19 or E21 row holds the exchange id only: no second person, no address, no pair; E19 is from the organiser.
select ok(
  not exists (
    select 1 from private.email_outbox o join public.exchanges e on e.id = o.exchange_id
    where o.template in ('E19', 'E21') and o.exchange_id = current_setting('test.ex_p')::uuid
      and (o.payload <> jsonb_build_object('exchange_id', o.exchange_id)
           or o.payload::text like '%@%' or o.recipient_email is not null
           or o.sender_id is distinct from e.organiser_id))
  and (select count(*) = 4 from private.email_outbox o where o.template in ('E19', 'E21') and o.exchange_id = current_setting('test.ex_p')::uuid)
  and (select pg_get_constraintdef(c.oid) like '%''E19''%' and pg_get_constraintdef(c.oid) like '%''E21''%' and pg_get_constraintdef(c.oid) like '%''E12''%'
       from pg_constraint c where c.conrelid = 'private.email_outbox'::regclass and c.conname = 'email_outbox_template_known'),
  'E19 and E21 are known templates and their rows hold the exchange id and the organiser as sender, nobody else');

-- 21. AC-10, GCO-012, Q1c: the organiser of Q only organises. Hana, Ife, Jide and Kemi take part; the draw clears the
-- blocked reason.
-- WHY the draw is its own statement: the round, blocked reason and state read below must see what it wrote.
do $fx$ begin
  perform set_config('test.draw_q', pg_temp.val_as(pg_temp.u(6), format($q$(select people_count::text || '/' || pairs_excluded::text || '/' || emails_queued::text || '/' || drawn_now::text
    from public.draw_names(%L))$q$, current_setting('test.ex_q'))), true);
end $fx$;
select is(
  current_setting('test.draw_q')
  || '/' || (select draw_round::text || ':' || coalesce(draw_blocked_reason, '-') from public.exchanges where id = current_setting('test.ex_q')::uuid)
  || '/' || private.exchange_status(current_setting('test.ex_q')::uuid)::text,
  '4/0/4/true/1:-/drawn', 'an organiser just organising draws: 4 people, 4 emails, round 1, blocked reason cleared, state drawn');

-- 22. AC-10: E19 for the four people, E21 for the organiser (from nobody), none for the organiser as E19.
select is(
  (select string_agg(o.template || ':' || p.display_name || ':' || coalesce(o.sender_id::text, '-'), '|' order by o.template, p.display_name)
   from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
   where o.template in ('E19', 'E21') and o.exchange_id = current_setting('test.ex_q')::uuid),
  'E19:Hana:' || pg_temp.u(6) || '|E19:Ife:' || pg_temp.u(6) || '|E19:Jide:' || pg_temp.u(6) || '|E19:Kemi:' || pg_temp.u(6)
  || '|E21:Gbemi:-',
  'E19 goes to the four people taking part, E21 to the organiser who only organises, and E21 names nobody');

-- 23. The Names are drawn toggle is honoured for E21 as it is for E19 (a person with it off is queued nothing).
do $fx$ begin
  update public.user_settings set notify_names_drawn = false where user_id = pg_temp.u(6);
end $fx$;
select is(
  coalesce((select private.enqueue_email('E21', pg_temp.u(6), null, current_setting('test.ex_q')::uuid, null, null, 'T310-e21-off'))::text, '-')
  || '/' || (select count(*)::text from private.email_outbox where dedupe_key = 'T310-e21-off'),
  '-/0', 'E21 is not queued for an organiser who turned Names are drawn off');

-- 24. The sender's claim carries what E19 and E21 show, for those two only: budget preset, gift day, people count, and the
-- organiser's name on E19. Nobody's pair.
do $fx$ begin
  perform pg_temp.claim_as_svc(50, 'test.claim_draw');
end $fx$;
select is(
  (select string_agg(format('%s:%s:%s:%s:%s:%s', c ->> 'template', c ->> 'to_name', coalesce(c ->> 'other_name', '-'),
                            c ->> 'budget_preset', (c ->> 'gift_day' is not null)::text, c ->> 'people_count'), '|'
                     order by c ->> 'exchange_name', c ->> 'template', c ->> 'to_name')
   from jsonb_array_elements(current_setting('test.claim_draw')::jsonb) c
   where c ->> 'template' in ('E19', 'E21') and c ->> 'exchange_name' in ('T310 Pool', 'T310 Quiet')),
  'E19:Ada:Ada:10k_20k:true:5|E19:Bola:Ada:10k_20k:true:5|E19:Chi:Ada:10k_20k:true:5|E19:Dayo:Ada:10k_20k:true:5'
  || '|E19:Hana:Gbemi:10k_20k:true:4|E19:Ife:Gbemi:10k_20k:true:4|E19:Jide:Gbemi:10k_20k:true:4|E19:Kemi:Gbemi:10k_20k:true:4'
  || '|E21:Gbemi:-:10k_20k:true:4',
  'E19 carries the organiser''s name, the budget, the gift day and the people count; E21 the same without a name');
select ok(
  coalesce((select bool_and(c ->> 'people_count' is null) from jsonb_array_elements(current_setting('test.claim_draw')::jsonb) c
   where c ->> 'template' not in ('E19', 'E21')), true)
  and not exists (select 1 from jsonb_array_elements(current_setting('test.claim_draw')::jsonb) c, jsonb_object_keys(c) k
   where k not in ('id', 'template', 'to_email', 'to_name', 'to_timezone', 'exchange_id', 'exchange_name', 'other_name',
                   'invite_token', 'attempts', 'budget_preset', 'join_by_at', 'gift_day', 'note', 'draw_mode', 'draw_at', 'people_count')),
  'only E19 and E21 carry a people count, and a claimed row has no column for a pair or an assignment');

-- 26. Q6: a names_drawn event for each person taking part (Eze too: the email toggle does not stop it), none for the
-- organiser who only organises or for someone who only asked, and no subject.
select is(
  (select string_agg(p.display_name, '|' order by p.display_name) from public.activity_events ae join public.profiles p on p.id = ae.user_id
   where ae.kind = 'names_drawn' and ae.exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || (select string_agg(p.display_name, '|' order by p.display_name) from public.activity_events ae join public.profiles p on p.id = ae.user_id
   where ae.kind = 'names_drawn' and ae.exchange_id = current_setting('test.ex_q')::uuid)
  || '/' || (select count(*)::text from public.activity_events where kind = 'names_drawn' and subject_user_id is not null
             and exchange_id in (current_setting('test.ex_p')::uuid, current_setting('test.ex_q')::uuid))
  || '/' || pg_temp.val_as(pg_temp.u(2), $$(select string_agg(kind::text || ':' || coalesce(subject_name, '-'), '|') from public.get_my_activity())$$),
  'Ada|Bola|Chi|Dayo|Eze/Hana|Ife|Jide|Kemi/0/names_drawn:-',
  'each person taking part gets a Names drawn event with no subject; the organiser who only organises does not');

-- 27. AC-3: Gbemi only organises Q: she reads no assignment and no recipient, cannot reveal, and has no row of her own.
select is(
  pg_temp.val_as(pg_temp.u(6), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_q')))
  || '/' || pg_temp.val_as(pg_temp.u(6), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_q')))
  || '/' || pg_temp.run_as(pg_temp.u(6), format('select public.mark_assignment_revealed(%L)', current_setting('test.ex_q')))
  || '/' || (select count(*)::text from private.assignments a join public.exchange_members m on m.id in (a.giver_member_id, a.receiver_member_id)
             where a.exchange_id = current_setting('test.ex_q')::uuid and m.user_id = pg_temp.u(6))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_q')::uuid and revealed_at is not null),
  '0/0/err:P0002:/0/0', 'an organiser just organising reads zero rows from the assignment functions and is in no pair');

-- 28. The organiser reads the summary of the draw (counts and a time), nobody else does.
select is(
  pg_temp.val_as(pg_temp.u(6), format($q$(select people_count::text || ':' || emails_queued::text || ':' || (drawn_at is not null)::text from public.get_draw_summary(%L))$q$, current_setting('test.ex_q')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format($q$(select people_count::text || ':' || emails_queued::text from public.get_draw_summary(%L))$q$, current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.get_draw_summary(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(12), format('(select count(*) from public.get_draw_summary(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.get_draw_summary(%L))', current_setting('test.ex_q')))
  || '/' || pg_temp.val_as(pg_temp.u(11), format('(select count(*) from public.get_draw_summary(%L))', current_setting('test.ex_x'))),
  '4:4:true/5:4/0/0/0/0',
  'the organiser reads people, emails and the time; a member, an outsider and another organiser read nothing; so does an undrawn exchange');

-- 29. AC-4: Ada organises P and takes part: exactly one assignment row and one recipient row, and they are her own.
select is(
  pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select display_name from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || (select p.display_name from private.assignments a
             join public.exchange_members gm on gm.id = a.giver_member_id and gm.user_id = pg_temp.u(1)
             join public.exchange_members rm on rm.id = a.receiver_member_id
             join public.profiles p on p.id = rm.user_id
             where a.exchange_id = current_setting('test.ex_p')::uuid),
  '1/1/' || (select p.display_name from private.assignments a
             join public.exchange_members gm on gm.id = a.giver_member_id and gm.user_id = pg_temp.u(1)
             join public.exchange_members rm on rm.id = a.receiver_member_id
             join public.profiles p on p.id = rm.user_id
             where a.exchange_id = current_setting('test.ex_p')::uuid)
  || '/' || (select p.display_name from private.assignments a
             join public.exchange_members gm on gm.id = a.giver_member_id and gm.user_id = pg_temp.u(1)
             join public.exchange_members rm on rm.id = a.receiver_member_id
             join public.profiles p on p.id = rm.user_id
             where a.exchange_id = current_setting('test.ex_p')::uuid),
  'an organiser who takes part reads exactly their own assignment and their own recipient');

-- 30. AC-5: in P each of the five givers reads the name of their own receiver and nobody else's; in Q the same for four.
select is(
  pg_temp.recip_check(current_setting('test.ex_p')) || '/' || pg_temp.recip_check(current_setting('test.ex_q')),
  '5/0/4/0', 'every giver reads exactly the name of the person they give to');

-- 31. AC-5: a person who is not a giver in the exchange reads nothing: an outsider, someone who only asked, another exchange's
-- organiser, and a member of the other exchange.
select is(
  pg_temp.val_as(pg_temp.u(12), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(13), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(6), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_q')))
  || '/' || pg_temp.val_as(pg_temp.u(7), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.run_as(pg_temp.u(12), format('select public.mark_assignment_revealed(%L)', current_setting('test.ex_p'))),
  '0/0/0/0/0/err:P0002:', 'outsiders, requesters and other exchanges'' people read no assignment and cannot reveal');

-- 32. AC-5: no function returns a giver, a receiver, a member id or a person id.
select ok(
  (select bool_and(pg_get_function_result(p.oid) not ilike '%giver%' and pg_get_function_result(p.oid) not ilike '%receiver%'
                   and pg_get_function_result(p.oid) not ilike '%member%' and pg_get_function_result(p.oid) not ilike '%user_id%'
                   and pg_get_function_result(p.oid) not ilike '%@%')
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('draw_names', 'get_draw_summary', 'get_my_assignment', 'get_my_recipient', 'mark_assignment_revealed', 'dismiss_join_request')),
  'no draw function returns a giver, a receiver, a member id, a person id or an address column');

-- 33. The organiser of a drawn exchange still cannot read the assignments, taking part or not: a direct read is refused
-- (the table is closed to every API role), and so is a member's.
select is(
  pg_temp.try_as(pg_temp.u(1), 'select count(*) from private.assignments')
  || '/' || pg_temp.try_as(pg_temp.u(6), 'select count(*) from private.assignments')
  || '/' || pg_temp.try_as(pg_temp.u(2), 'select count(*) from private.assignments'),
  'err:42501/err:42501/err:42501', 'organisers and members are refused (42501) reading the assignments directly');

-- 34. Q10 / the shared rule: a drawn exchange is still readable by its members (state) and the draw did not move joining
-- for the other exchange: X was not drawn by any refused call.
select is(
  (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_x')::uuid)
  || '/' || (select draw_round::text from public.exchanges where id = current_setting('test.ex_x')::uuid)
  || '/' || pg_temp.val_as(pg_temp.u(11), format('public.exchange_state(%L)', current_setting('test.ex_x'))),
  '0/0/complete', 'refused draws left X undrawn (still complete, no rows, round 0)');

-- 35. AC-7, never-do 7: no retry loop. The engine is called once, under the exchange row lock the other writers take.
select ok(
  (select (length(p.prosrc) - length(replace(p.prosrc, 'compute_matching', ''))) / length('compute_matching') = 1
          and p.prosrc ilike '%for update%'
          and p.prosrc not ilike '%while%'
   from pg_proc p where p.oid = 'public.draw_names(uuid)'::regprocedure),
  'draw_names calls the engine exactly once, takes the row lock and has no retry loop');

-- 36. A refused draw never half-writes: Q's pending request and nudge went through the draw atomically, and X shows no
-- closed requests or cancelled nudges from the refusals.
select is(
  (select r.status::text from public.join_requests r where r.exchange_id = current_setting('test.ex_q')::uuid and r.user_id = pg_temp.u(14))
  || '/' || (select (o.cancelled_at is not null)::text from private.email_outbox o where o.dedupe_key = 'T310-hana')
  || '/' || (select count(*)::text from public.join_requests where exchange_id = current_setting('test.ex_x')::uuid and status = 'closed'),
  'closed/true/0', 'drawing Q closed its pending request and cancelled its nudge; the refused draws on X changed nothing');

select * from finish();
rollback;
