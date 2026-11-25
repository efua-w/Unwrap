-- 380_scheduled_draw — slice 12 (GCO-011 the scheduled draw and its blocked state, GCO-012, GC-007 Names drawn event; plan §5, §6
-- invariants 1-5, 9, 11; owner decisions 2026-11-24 Q1-Q5 in docs/tasks/slice-12.md).
-- Covers (AC-2, AC-3, AC-4, AC-5, AC-9): private.tick draws an exchange only when it is at_join_by, its state is exactly
-- joining_closed, draw_round is 0 and no blocked reason is set (also on the gift day itself, never after it); a due exchange gets
-- one current row per person taking part forming a permutation with no self and no excluded pair, plus Names are drawn
-- events, E19 and E21, closed requests and cancelled E10 nudges exactly as a manual draw (compare 310); fewer than 3 people or no
-- fair draw writes no assignment, sets the blocked reason to few or exclusions and queues exactly one E15 to the organiser with
-- the dedupe key blocked:{exchange}:{join-by epoch}; a second and third run write nothing more, even after the cause is fixed
-- (the engine is called once per attempt and never retried, never-do 7); an organiser_chooses, open, cancelled, event-passed,
-- complete or already-blocked exchange is never drawn; the manual draw still works on a blocked exchange and clears the reason;
-- members, outsiders and anon cannot read the blocked reason, the organiser can, through get_draw_blocked_reason only; the
-- reason can only be few or exclusions; a run draws at most 20 exchanges, oldest first; an exchange whose draw fails does not
-- stop the others and leaves nothing half written.
-- WHY the other exchanges are parked first: tick looks at every exchange. Every exchange that is not a fixture is cancelled
-- inside this transaction (it rolls back), so a run here draws only the fixtures, and dev data is never touched for real.
-- The draw itself is covered for the organiser by 310 (run through run_draw since slice 12).
-- Self-contained: creates its own users inside the transaction (needs the migrations through scheduled_jobs applied, not
-- seed.sql). Everything rolls back. Names are prefixed "T380" because dev holds other data.
-- Written BEFORE the scheduled_jobs migration: until it is applied the first statement that names private.tick fails and the
-- run stops. That is the expected "red".
-- Pass: "ok 1".."ok 21", "1..21", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

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

-- owner_try runs a statement as the migration role (no role switch) and returns the SQLSTATE or 'ok'.
create function pg_temp.owner_try(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return sqlstate;
end $$;

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

-- u(n) is persona n: 1 Ada (organiser of A, takes part), 2 Bola, 3 Chi, 4 Dayo, 5 Eze (members of A; Eze has Names are drawn
-- emails off), 6 Gbemi (organiser of B, only organising), 7 Hana, 8 Ife, 9 Jide (members of B and of every other fixture
-- exchange), 10 Kemi (organiser of C), 11 Lola (member of C), 12 Mo (organiser of D), 13 Nia, 14 Ola (members of D; Nia asked to
-- join A), 15 Pat (organiser of every other fixture exchange, only organising).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('38' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- mkx writes an exchange and its organiser's member row straight into the tables (as the migration role), so the dates can be
-- set relative to now() without the create_exchange rules. draw_at follows the draw mode, as the table check demands.
create function pg_temp.mkx(p_name text, p_org uuid, p_taking boolean, p_mode public.exchange_draw_mode,
                            p_join_by timestamptz, p_gift date, p_tz text default 'Africa/Lagos') returns uuid
language plpgsql as $$
declare
  v uuid;
begin
  insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, gift_day, organiser_tz, tint)
  values (p_org, p_name, '10k_20k', p_join_by, p_mode, case when p_mode = 'at_join_by' then p_join_by end, p_gift, p_tz, 'clay')
  returning id into v;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
  values (v, p_org, p_taking, now() - interval '30 days');
  return v;
end $$;

-- add_members adds persona numbers as active members taking part, joined 10 days ago.
create function pg_temp.add_members(p_ex uuid, p_nums int[]) returns void
language sql as $$
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
  select p_ex, pg_temp.u(n), true, now() - interval '10 days' from unnest(p_nums) n
$$;

create function pg_temp.mid(ex text, nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = ex::uuid and p.display_name = nm and m.state = 'active'
$$;

-- snap: what a run could change across the fixtures: assignment rows, outbox rows, events, and blocked reasons.
create function pg_temp.snap() returns text
language sql as $$
  select (select count(*) from private.assignments a join public.exchanges x on x.id = a.exchange_id where x.name like 'T380%')::text
  || '/' || (select count(*) from private.email_outbox o join public.exchanges x on x.id = o.exchange_id where x.name like 'T380%')::text
  || '/' || (select count(*) from public.activity_events ae join public.exchanges x on x.id = ae.exchange_id where x.name like 'T380%')::text
  || '/' || (select count(*) from public.exchanges where name like 'T380%' and draw_blocked_reason is not null)::text
$$;

-- tickrow: one run of tick as "ran/drawn/blocked/reminders/completed".
create function pg_temp.tickrow() returns text
language sql as $$
  select format('%s/%s/%s/%s/%s', ran::text, drawn, blocked, reminders, completed) from private.tick()
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u380-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi', 'Lola', 'Mo', 'Nia', 'Ola', 'Pat'])[i]))
  from generate_series(1, 15) i;
end $fx$;

-- A: due, 5 people, two pairs, a pending request, unsent nudges. B: due, organiser only organises. C: due, 2 people. D: due, 3
-- people but the organiser may give to nobody. N: due on the gift day itself (allowed). The rest must never be drawn.
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_a', pg_temp.mkx('T380 Due', pg_temp.u(1), true, 'at_join_by', now() - interval '3 hours', current_date + 10)::text, true);
  perform set_config('test.ex_b', pg_temp.mkx('T380 Quiet', pg_temp.u(6), false, 'at_join_by', now() - interval '2 hours', current_date + 10)::text, true);
  perform set_config('test.ex_c', pg_temp.mkx('T380 Few', pg_temp.u(10), true, 'at_join_by', now() - interval '90 minutes', current_date + 10)::text, true);
  perform set_config('test.ex_d', pg_temp.mkx('T380 Impossible', pg_temp.u(12), true, 'at_join_by', now() - interval '80 minutes', current_date + 10)::text, true);
  perform set_config('test.ex_e', pg_temp.mkx('T380 Chooses', pg_temp.u(15), false, 'organiser_chooses', now() - interval '1 day', current_date + 10)::text, true);
  perform set_config('test.ex_f', pg_temp.mkx('T380 Open', pg_temp.u(15), false, 'at_join_by', now() + interval '30 days', current_date + 40)::text, true);
  perform set_config('test.ex_g', pg_temp.mkx('T380 Cancelled', pg_temp.u(15), false, 'at_join_by', now() - interval '1 day', current_date + 10)::text, true);
  perform set_config('test.ex_i', pg_temp.mkx('T380 Passed', pg_temp.u(15), false, 'at_join_by', now() - interval '5 days', current_date - 3)::text, true);
  perform set_config('test.ex_j', pg_temp.mkx('T380 Complete', pg_temp.u(15), false, 'at_join_by', now() - interval '1 day', current_date + 10)::text, true);
  perform set_config('test.ex_k', pg_temp.mkx('T380 Reason', pg_temp.u(15), false, 'at_join_by', now() - interval '4 hours', current_date + 10)::text, true);
  -- WHY the gift day is today in Lagos and the join-by an hour before that day began: joining is closed, the gift day has not ended.
  perform set_config('test.ex_n', pg_temp.mkx('T380 GiftDay', pg_temp.u(15), false, 'at_join_by',
    ((now() at time zone 'Africa/Lagos')::date::timestamp at time zone 'Africa/Lagos') - interval '1 hour',
    (now() at time zone 'Africa/Lagos')::date, 'Africa/Lagos')::text, true);
  -- WHY a guard: report the real problem if a fixture exchange was not written.
  if (select count(*) from public.exchanges where name like 'T380%') <> 11 then
    raise exception 'T380 fixture: expected 11 exchanges, found %', (select count(*) from public.exchanges where name like 'T380%');
  end if;
end $fx$;

do $fx$ begin
  perform pg_temp.add_members(current_setting('test.ex_a')::uuid, array[2, 3, 4, 5]);
  perform pg_temp.add_members(current_setting('test.ex_b')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_c')::uuid, array[11]);
  perform pg_temp.add_members(current_setting('test.ex_d')::uuid, array[13, 14]);
  perform pg_temp.add_members(current_setting('test.ex_e')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_f')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_g')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_i')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_j')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_k')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_n')::uuid, array[7, 8, 9]);
  update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_g')::uuid;
  update public.exchanges set completed_at = now() - interval '1 hour' where id = current_setting('test.ex_j')::uuid;
  update public.exchanges set draw_blocked_reason = 'few' where id = current_setting('test.ex_k')::uuid;
  update public.user_settings set notify_names_drawn = false where user_id = pg_temp.u(5);
  -- Park every exchange that is not a fixture (this transaction rolls back).
  update public.exchanges set cancelled_at = now() where cancelled_at is null and name not like 'T380%';
end $fx$;

-- Pairs in A: Bola and Chi never draw each other, nor do Dayo and Eze. In D: Mo may give to nobody (Nia and Ola are both ruled out).
do $fx$ begin
  insert into public.exclusions (exchange_id, first_member_id, second_member_id) values
    (current_setting('test.ex_a')::uuid, pg_temp.mid(current_setting('test.ex_a'), 'Bola'), pg_temp.mid(current_setting('test.ex_a'), 'Chi')),
    (current_setting('test.ex_a')::uuid, pg_temp.mid(current_setting('test.ex_a'), 'Dayo'), pg_temp.mid(current_setting('test.ex_a'), 'Eze')),
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Mo'), pg_temp.mid(current_setting('test.ex_d'), 'Nia')),
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Mo'), pg_temp.mid(current_setting('test.ex_d'), 'Ola'));
  -- Nia asked to join A, and A has unsent nudges (Bola) and a sent one (Chi); F has an unsent nudge that must stay.
  insert into public.join_requests (exchange_id, user_id) values (current_setting('test.ex_a')::uuid, pg_temp.u(13));
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key, sent_at) values
    ('E10', pg_temp.u(3), current_setting('test.ex_a')::uuid, pg_temp.u(1), 'T380-chi-sent', now());
  insert into private.email_outbox (template, recipient_user_id, exchange_id, sender_id, dedupe_key, send_after) values
    ('E10', pg_temp.u(2), current_setting('test.ex_a')::uuid, pg_temp.u(1), 'T380-bola', now() + interval '1 day'),
    ('E10', pg_temp.u(7), current_setting('test.ex_f')::uuid, pg_temp.u(15), 'T380-hana-f', now() + interval '1 day');
end $fx$;

-- First run. WHY its own statement: everything below reads what it wrote.
do $fx$ begin
  perform set_config('test.t1', pg_temp.tickrow(), true);
end $fx$;

-- 1. AC-3, AC-4: A, B and the gift-day exchange N were drawn; C (2 people) and D (impossible) were blocked; nothing else ran.
select is(current_setting('test.t1'), 'true/3/2/0/0', 'the first run drew 3 exchanges, blocked 2, and queued no reminder and completed nothing');

-- 2. AC-3: A has one current row per person taking part, a permutation, no self, no excluded pair, round 1, no blocked reason.
select ok(
  (select count(*) = 5
      and count(distinct a.giver_member_id) = 5 and count(distinct a.receiver_member_id) = 5
      and bool_and(a.giver_member_id <> a.receiver_member_id and a.kind = 'full' and a.draw_round = 1 and a.superseded_at is null)
      and array_agg(a.giver_member_id order by a.giver_member_id)
          = (select array_agg(m.id order by m.id) from public.exchange_members m
             where m.exchange_id = a.exchange_id and m.state = 'active' and m.taking_part)
      and array_agg(a.receiver_member_id order by a.receiver_member_id)
          = (select array_agg(m.id order by m.id) from public.exchange_members m
             where m.exchange_id = a.exchange_id and m.state = 'active' and m.taking_part)
   from private.assignments a where a.exchange_id = current_setting('test.ex_a')::uuid group by a.exchange_id)
  and not exists (
    select 1 from private.assignments a join public.exclusions x on x.exchange_id = a.exchange_id
     where a.exchange_id = current_setting('test.ex_a')::uuid
       and ((a.giver_member_id = x.first_member_id and a.receiver_member_id = x.second_member_id)
         or (a.giver_member_id = x.second_member_id and a.receiver_member_id = x.first_member_id)))
  and (select draw_round = 1 and draw_blocked_reason is null from public.exchanges where id = current_setting('test.ex_a')::uuid)
  and private.exchange_status(current_setting('test.ex_a')::uuid) = 'drawn',
  'the scheduled draw wrote 5 rows forming a permutation of the people taking part, no self, no excluded pair, round 1');

-- 3. AC-3: B (3 people, organiser only organising) and N (drawn on the gift day itself) have their 3 rows each and are drawn.
select is(
  (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_b')::uuid and draw_round = 1)
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_n')::uuid and draw_round = 1)
  || '/' || private.exchange_status(current_setting('test.ex_b')::uuid)::text
  || '/' || private.exchange_status(current_setting('test.ex_n')::uuid)::text,
  '3/3/drawn/drawn', 'an exchange with 3 people and one due on the gift day itself are drawn');

-- 4. AC-3: E19 for each person taking part with the toggle on, E21 for the organiser who only organises, a Names drawn event for
-- everyone taking part (Eze too: the email toggle does not stop it) and none naming a person. All from the organiser or nobody.
select is(
  (select string_agg(p.display_name, '|' order by p.display_name)
   from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
   where o.template = 'E19' and o.exchange_id = current_setting('test.ex_a')::uuid)
  || '/' || (select string_agg(o.template || ':' || p.display_name || ':' || coalesce(o.sender_id::text, '-'), '|' order by o.template, p.display_name)
   from private.email_outbox o join public.profiles p on p.id = o.recipient_user_id
   where o.template in ('E19', 'E21') and o.exchange_id = current_setting('test.ex_b')::uuid)
  || '/' || (select string_agg(p.display_name, '|' order by p.display_name) from public.activity_events ae join public.profiles p on p.id = ae.user_id
   where ae.kind = 'names_drawn' and ae.exchange_id = current_setting('test.ex_a')::uuid)
  || '/' || (select count(*)::text from public.activity_events where kind = 'names_drawn' and subject_user_id is not null
             and exchange_id in (current_setting('test.ex_a')::uuid, current_setting('test.ex_b')::uuid)),
  'Ada|Bola|Chi|Dayo/E19:Hana:' || pg_temp.u(6) || '|E19:Ife:' || pg_temp.u(6) || '|E19:Jide:' || pg_temp.u(6) || '|E21:Gbemi:-'
  || '/Ada|Bola|Chi|Dayo|Eze/0',
  'the scheduled draw queues E19 and E21 and writes Names drawn events exactly as the manual draw does');

-- 5. AC-3: the pending request closes with a decision time, the unsent nudge is cancelled, the sent one and another exchange's
-- nudge are untouched.
select is(
  (select r.status::text || ':' || (r.decided_at is not null)::text
   from public.join_requests r where r.exchange_id = current_setting('test.ex_a')::uuid and r.user_id = pg_temp.u(13))
  || '/' || (select (o.cancelled_at is not null and o.last_error_code = 'drawn')::text from private.email_outbox o where o.dedupe_key = 'T380-bola')
  || '/' || (select (o.sent_at is not null and o.cancelled_at is null)::text from private.email_outbox o where o.dedupe_key = 'T380-chi-sent')
  || '/' || (select (o.cancelled_at is null)::text from private.email_outbox o where o.dedupe_key = 'T380-hana-f'),
  'closed:true/true/true/true', 'the scheduled draw closes pending requests and cancels unsent nudges for this exchange only');

-- 6. AC-4: C (fewer than 3 people): no assignment, reason few, still round 0 and still joining closed, no Names drawn email or event.
select is(
  (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_c')::uuid)
  || '/' || (select draw_round::text || ':' || draw_blocked_reason from public.exchanges where id = current_setting('test.ex_c')::uuid)
  || '/' || private.exchange_status(current_setting('test.ex_c')::uuid)::text
  || '/' || (select count(*)::text from private.email_outbox where exchange_id = current_setting('test.ex_c')::uuid and template <> 'E15')
  || '/' || (select count(*)::text from public.activity_events where exchange_id = current_setting('test.ex_c')::uuid),
  '0/0:few/joining_closed/0/0', 'fewer than 3 people: no rows, reason few, no Names drawn email or event');

-- 7. AC-4: D (no fair draw): no assignment, reason exclusions, nothing else written.
select is(
  (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_d')::uuid)
  || '/' || (select draw_round::text || ':' || draw_blocked_reason from public.exchanges where id = current_setting('test.ex_d')::uuid)
  || '/' || private.exchange_status(current_setting('test.ex_d')::uuid)::text
  || '/' || (select count(*)::text from private.email_outbox where exchange_id = current_setting('test.ex_d')::uuid and template <> 'E15')
  || '/' || (select count(*)::text from public.activity_events where exchange_id = current_setting('test.ex_d')::uuid),
  '0/0:exclusions/joining_closed/0/0', 'no fair draw: no rows, reason exclusions, no Names drawn email or event');

-- 8. AC-4, AC-9: each blocked exchange has exactly one E15, to its organiser, with the dedupe key blocked:{exchange}:{join-by
-- epoch}, no sender, no subject, and a payload holding the exchange id only.
select is(
  (select string_agg(x.name || ':' || p.display_name || ':' || (o.dedupe_key = 'blocked:' || x.id::text || ':' || (extract(epoch from x.join_by_at))::bigint::text)::text
                     || ':' || (o.sender_id is null and o.recipient_email is null and o.cancelled_at is null and o.sent_at is null
                                and o.payload = jsonb_build_object('exchange_id', x.id))::text, '|' order by x.name)
   from private.email_outbox o
   join public.exchanges x on x.id = o.exchange_id
   join public.profiles p on p.id = o.recipient_user_id and p.id = x.organiser_id
   where o.template = 'E15' and x.name like 'T380%')
  || '/' || (select count(*)::text from private.email_outbox where template = 'E15' and exchange_id in (current_setting('test.ex_c')::uuid, current_setting('test.ex_d')::uuid)),
  'T380 Few:Kemi:true:true|T380 Impossible:Mo:true:true/2',
  'each blocked exchange has one E15 to its organiser with the right dedupe key, no sender and the exchange id only');

-- 9. AC-5: never drawn: organiser_chooses (E), open (F), cancelled (G), event passed (I), complete (J) and one that already has a
-- blocked reason (K, three people, so a draw would have worked). No rows, round 0, no draw or blocked email, K's reason unchanged.
select is(
  (select string_agg(x.name || ':' || x.draw_round || ':' || (select count(*) from private.assignments a where a.exchange_id = x.id), '|' order by x.name)
   from public.exchanges x
   where x.id in (current_setting('test.ex_e')::uuid, current_setting('test.ex_f')::uuid, current_setting('test.ex_g')::uuid,
                  current_setting('test.ex_i')::uuid, current_setting('test.ex_j')::uuid, current_setting('test.ex_k')::uuid))
  || '/' || (select count(*)::text from private.email_outbox
             where template in ('E15', 'E19', 'E21')
               and exchange_id in (current_setting('test.ex_e')::uuid, current_setting('test.ex_f')::uuid, current_setting('test.ex_g')::uuid,
                                   current_setting('test.ex_i')::uuid, current_setting('test.ex_j')::uuid, current_setting('test.ex_k')::uuid))
  || '/' || (select draw_blocked_reason from public.exchanges where id = current_setting('test.ex_k')::uuid),
  'T380 Cancelled:0:0|T380 Chooses:0:0|T380 Complete:0:0|T380 Open:0:0|T380 Passed:0:0|T380 Reason:0:0/0/few',
  'organiser_chooses, open, cancelled, event-passed, complete and already-blocked exchanges are never drawn and nothing is queued');

-- 10. Q5: the organiser reads the reason through the function; a member, an outsider, another exchange's organiser and the
-- organiser of an exchange that is not blocked read nothing; a visitor is refused. (Reasons are still set here.)
select is(
  pg_temp.val_as(pg_temp.u(10), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_c')))
  || '/' || pg_temp.val_as(pg_temp.u(12), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_d')))
  || '/' || pg_temp.val_as(pg_temp.u(11), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_c')))
  || '/' || pg_temp.val_as(pg_temp.u(7), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_c')))
  || '/' || pg_temp.val_as(pg_temp.u(13), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_d')))
  || '/' || pg_temp.val_as(pg_temp.u(12), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_c')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_a')))
  || '/' || pg_temp.val_as(null, format($q$(select coalesce(string_agg(reason, '|'), '-') from public.get_draw_blocked_reason(%L))$q$, current_setting('test.ex_c'))),
  'few/exclusions/-/-/-/-/-/err:42501:',
  'only the organiser reads why the draw was blocked; a member, an outsider, another organiser and a visitor learn nothing');

-- 11. Q5: nobody reads the column itself, organiser included: the grant is gone and the view has no such column; the rest of the
-- exchange stays readable through the view.
select is(
  pg_temp.try_as(pg_temp.u(11), format('select draw_blocked_reason from public.exchanges where id = %L', current_setting('test.ex_c')))
  || '/' || pg_temp.try_as(pg_temp.u(10), format('select draw_blocked_reason from public.exchanges where id = %L', current_setting('test.ex_c')))
  || '/' || pg_temp.try_as(pg_temp.u(11), format('select draw_blocked_reason from public.exchanges_visible where id = %L', current_setting('test.ex_c')))
  || '/' || pg_temp.try_as(pg_temp.u(11), format('select * from public.exchanges_visible where id = %L', current_setting('test.ex_c')))
  || '/' || pg_temp.try_as(pg_temp.u(10), format('select * from public.exchanges_visible where id = %L', current_setting('test.ex_c'))),
  'err:42501/err:42501/err:42703/ok:1/ok:1',
  'the blocked reason is not readable from exchanges or exchanges_visible by a member or the organiser, and the view still works');

-- 12. The reason can only be few or exclusions (a check on new and changed rows).
select is(
  pg_temp.owner_try(format('update public.exchanges set draw_blocked_reason = %L where id = %L', 'bogus', current_setting('test.ex_f')))
  || '/' || pg_temp.owner_try(format('update public.exchanges set draw_blocked_reason = %L where id = %L', 'exclusions', current_setting('test.ex_f')))
  || '/' || pg_temp.owner_try(format('update public.exchanges set draw_blocked_reason = null where id = %L', current_setting('test.ex_f'))),
  '23514/ok/ok', 'the blocked reason accepts few, exclusions or nothing, and refuses free text (23514)');

-- 13. AC-2: a second run writes nothing. WHY the snapshot is taken in its own statement, and the run in the next.
do $fx$ begin
  perform set_config('test.snap1', pg_temp.snap(), true);
end $fx$;
do $fx$ begin
  perform set_config('test.t2', pg_temp.tickrow(), true);
end $fx$;
select is(current_setting('test.t2') || '|' || (pg_temp.snap() = current_setting('test.snap1'))::text,
  'true/0/0/0/0|true', 'a second run draws, blocks, queues and writes nothing more');

-- 14. AC-4, never-do 7: no retry. The causes are fixed (D's pairs removed, a third person in C) and a third run still leaves both
-- blocked: the reason stops the draw query, so the engine is not called again. One E15 each still.
do $fx$ begin
  delete from public.exclusions where exchange_id = current_setting('test.ex_d')::uuid;
  perform pg_temp.add_members(current_setting('test.ex_c')::uuid, array[7]);
end $fx$;
do $fx$ begin
  perform set_config('test.snap2', pg_temp.snap(), true);
end $fx$;
do $fx$ begin
  perform set_config('test.t3', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.t3')
  || '/' || (pg_temp.snap() = current_setting('test.snap2'))::text
  || '/' || (select count(*)::text from private.assignments where exchange_id in (current_setting('test.ex_c')::uuid, current_setting('test.ex_d')::uuid))
  || '/' || (select count(*)::text from private.email_outbox where template = 'E15' and exchange_id in (current_setting('test.ex_c')::uuid, current_setting('test.ex_d')::uuid)),
  'true/0/0/0/0/true/0/2',
  'after the cause is fixed a later run still does not retry: no rows and still one E15 each');

-- 15. Never-do 7: one engine call, no retry loop. run_draw calls the engine exactly once under the row lock and has no loop that
-- could try again; tick never calls the engine and never uses a session user; draw_names only authorises and calls run_draw.
select ok(
  (select (length(p.prosrc) - length(replace(p.prosrc, 'compute_matching', ''))) / length('compute_matching') = 1
          and p.prosrc ilike '%for update%' and p.prosrc not ilike '%while%' and p.prosrc not ilike '%auth.uid%'
   from pg_proc p where p.oid = 'private.run_draw(uuid)'::regprocedure)
  and (select p.prosrc not ilike '%compute_matching%' and p.prosrc ilike '%run_draw%' and p.prosrc not ilike '%auth.uid%'
              and p.prosrc not ilike '%draw_names%'
       from pg_proc p where p.oid = 'private.tick()'::regprocedure)
  and (select p.prosrc ilike '%private.run_draw%' and p.prosrc not ilike '%compute_matching%' and p.prosrc ilike '%for update%'
       from pg_proc p where p.oid = 'public.draw_names(uuid)'::regprocedure),
  'run_draw calls the engine once, tick never calls it, and draw_names only authorises and calls run_draw');

-- 16. Q3: once the cause is fixed the organiser can still draw by hand, and the draw clears the reason. C now has 3 people (Kemi,
-- Lola, Hana), D has 3 and no pairs.
do $fx$ begin
  perform set_config('test.manual', pg_temp.val_as(pg_temp.u(10), format($q$(select people_count::text || '/' || pairs_excluded::text || '/' || emails_queued::text || '/' || drawn_now::text
      from public.draw_names(%L))$q$, current_setting('test.ex_c')))
    || '|' || pg_temp.val_as(pg_temp.u(12), format($q$(select people_count::text || '/' || pairs_excluded::text || '/' || emails_queued::text || '/' || drawn_now::text
      from public.draw_names(%L))$q$, current_setting('test.ex_d'))), true);
end $fx$;
select is(
  current_setting('test.manual')
  || '/' || (select count(*)::text from private.assignments where exchange_id in (current_setting('test.ex_c')::uuid, current_setting('test.ex_d')::uuid))
  || '/' || (select count(*)::text from public.exchanges where id in (current_setting('test.ex_c')::uuid, current_setting('test.ex_d')::uuid)
                                                        and draw_blocked_reason is null and draw_round = 1),
  '3/0/3/true|3/0/3/true/6/2', 'a blocked exchange can still be drawn by hand once fixed, and the draw clears the reason');

-- 17. AC-5: a draw that is already done is not drawn again by a run, and nothing about the gift-day exchange N was a second draw:
-- every fixture exchange that was drawn has exactly one draw round.
select is(
  (select string_agg(x.name || ':' || x.draw_round || ':' || (select count(distinct a.draw_round) from private.assignments a where a.exchange_id = x.id), '|' order by x.name)
   from public.exchanges x where x.id in (current_setting('test.ex_a')::uuid, current_setting('test.ex_b')::uuid, current_setting('test.ex_n')::uuid)),
  'T380 Due:1:1|T380 GiftDay:1:1|T380 Quiet:1:1', 'a drawn exchange has exactly one draw round after every run');

-- 18. AC-2: bounded work. 22 more exchanges are due at once; a run draws 20, the oldest first, the next run the last 2.
do $fx$ begin
  perform pg_temp.add_members(
    pg_temp.mkx('T380 Bulk ' || lpad(n::text, 2, '0'), pg_temp.u(15), false, 'at_join_by', now() - interval '2 days' + n * interval '1 minute', current_date + 10),
    array[7, 8, 9])
  from generate_series(1, 22) n;
end $fx$;
do $fx$ begin
  perform set_config('test.b1', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.b1')
  || '/' || (select string_agg(name, ',' order by name) from public.exchanges where name like 'T380 Bulk%' and draw_round = 0),
  'true/20/0/0/0/T380 Bulk 21,T380 Bulk 22', 'a run draws at most 20 exchanges, oldest join-by first');
do $fx$ begin
  perform set_config('test.b2', pg_temp.tickrow(), true);
  perform set_config('test.b3', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.b2') || '|' || current_setting('test.b3') || '|'
  || (select count(*)::text from public.exchanges where name like 'T380 Bulk%' and draw_round = 1),
  'true/2/0/0/0|true/0/0/0/0|22', 'the next run draws the last 2, and the one after that has nothing left');

-- 19. One bad exchange does not stop the others, and a failed draw leaves nothing. Boom is older than Calm; a trigger makes the
-- assignments insert fail for Boom only. The run draws Calm, leaves Boom with no rows, no event, no email and no reason (a bug is
-- not a block); once the fault is gone the next run draws Boom.
do $fx$ begin
  perform set_config('test.ex_boom', pg_temp.mkx('T380 Boom', pg_temp.u(15), false, 'at_join_by', now() - interval '3 hours', current_date + 10)::text, true);
  perform set_config('test.ex_calm', pg_temp.mkx('T380 Calm', pg_temp.u(15), false, 'at_join_by', now() - interval '2 hours', current_date + 10)::text, true);
  perform pg_temp.add_members(current_setting('test.ex_boom')::uuid, array[7, 8, 9]);
  perform pg_temp.add_members(current_setting('test.ex_calm')::uuid, array[7, 8, 9]);
end $fx$;
create function private.zz_t380_boom() returns trigger
language plpgsql as $$
begin
  if new.exchange_id = current_setting('test.ex_boom')::uuid then
    raise exception 'boom' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger zz_t380_boom before insert on private.assignments
  for each row execute function private.zz_t380_boom();
do $fx$ begin
  perform set_config('test.x1', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.x1')
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_boom')::uuid)
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_calm')::uuid)
  || '/' || (select count(*)::text from public.activity_events where exchange_id = current_setting('test.ex_boom')::uuid)
  || '/' || (select count(*)::text from private.email_outbox where exchange_id = current_setting('test.ex_boom')::uuid)
  || '/' || (select coalesce(draw_blocked_reason, '-') from public.exchanges where id = current_setting('test.ex_boom')::uuid),
  'true/1/0/0/0/0/3/0/0/-', 'a draw that fails leaves nothing behind and does not stop the next exchange');
drop trigger zz_t380_boom on private.assignments;
do $fx$ begin
  perform set_config('test.x2', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.x2') || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_boom')::uuid),
  'true/1/0/0/0/3', 'once the fault is gone the next run draws the exchange that failed');

select * from finish();
rollback;
