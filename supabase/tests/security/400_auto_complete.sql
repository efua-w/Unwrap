-- 400_auto_complete — slice 12 (GCO-015 automatic completion, GC-007 Activity, GC-015 reads after completion; plan §6 invariant
-- 12; owner decisions 2026-11-24 Q9 in docs/tasks/slice-12.md).
-- Covers (AC-8): private.tick completes a DRAWN exchange (a current assignment exists) that is not cancelled and not complete, at or after
-- (gift day + 8) at midnight in the organiser's zone, not before; it sets completed_at, writes one exchange_completed event for every
-- ACTIVE member (the organiser, someone not taking part, everyone; not someone who left) with no subject, and queues no email;
-- never-drawn, cancelled, already complete and open exchanges are not completed; a second run writes nothing and keeps the first
-- completed_at; afterwards exchange_status is complete and the giver's reads refuse: get_my_recipient and open_recipient_list return
-- nothing and set_gift_mark answers P0002 (they all worked just before); a run completes at most 100 exchanges, oldest gift day first.
-- WHY the boundary is tested to the hour and not to the minute: now() is frozen in a test, and an exchange's boundary is a local
-- midnight, so the nearest boundaries available are those of fixed-offset zones, an hour apart. One exchange has its boundary
-- just passed (local hour 0 there) and one just ahead (local hour 23); the test also asserts how far each boundary is from now().
-- WHY the other exchanges are parked first: tick looks at every exchange. Every exchange that is not a fixture is cancelled inside this
-- transaction (it rolls back), so a run here completes only the fixtures.
-- Self-contained: creates its own users inside the transaction (needs the migrations through scheduled_jobs applied, not seed.sql).
-- Everything rolls back. Names are prefixed "T400" because dev holds other data.
-- Written BEFORE the scheduled_jobs migration: until it is applied the first statement that names private.tick fails and the run
-- stops. That is the expected "red".
-- Pass: "ok 1".."ok 8", "1..8", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
  h text;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
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

-- u(n) is persona n: 1 Ada, 2 Bola, 3 Chi (take part), 4 Dayo (active, not taking part), 5 Eze (left), 6 Pat (organiser, only organising).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('40' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- mkx writes an exchange and its organiser's member row (not taking part) straight into the tables, so the dates can be set
-- relative to now() without the create_exchange rules.
create function pg_temp.mkx(p_name text, p_org uuid, p_mode public.exchange_draw_mode,
                            p_join_by timestamptz, p_gift date, p_tz text default 'Africa/Lagos') returns uuid
language plpgsql as $$
declare
  v uuid;
begin
  insert into public.exchanges (organiser_id, name, budget_preset, join_by_at, draw_mode, draw_at, gift_day, organiser_tz, tint)
  values (p_org, p_name, '10k_20k', p_join_by, p_mode, case when p_mode = 'at_join_by' then p_join_by end, p_gift, p_tz, 'clay')
  returning id into v;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
  values (v, p_org, false, now() - interval '300 days');
  return v;
end $$;

create function pg_temp.mem(p_ex uuid, p_n int, p_joined timestamptz, p_taking boolean default true,
                            p_state public.exchange_member_state default 'active') returns void
language sql as $$
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
  values (p_ex, pg_temp.u(p_n), p_taking, p_state, p_joined,
          case when p_state = 'active' then null else p_joined + interval '1 hour' end)
$$;

-- ring writes a draw straight into the table: each active member taking part gives to the next, in join order.
create function pg_temp.ring(p_ex uuid) returns void
language sql as $$
  with ms as (
    select m.id, row_number() over (order by m.joined_at, m.id) as rn, count(*) over () as n
      from public.exchange_members m
     where m.exchange_id = p_ex and m.state = 'active' and m.taking_part
  )
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind)
  select p_ex, a.id, b.id, 1, 'full' from ms a join ms b on b.rn = (a.rn % a.n) + 1
$$;

-- zone_at_hour: a fixed-offset zone whose local hour is p_hour right now (there is always one among UTC-12 to UTC+14).
create function pg_temp.zone_at_hour(p_hour int) returns text
language sql as $$
  select s.z
  from (
    select o, format('Etc/GMT%s', case when o > 0 then '-' || o::text when o < 0 then '+' || (-o)::text else '' end) as z
    from generate_series(-12, 14) o
  ) s
  where extract(hour from now() at time zone s.z) = p_hour
  order by s.o
  limit 1
$$;

create function pg_temp.gd(p_tz text, p_plus int) returns date
language sql as $$
  select (now() at time zone p_tz)::date + p_plus
$$;

-- tickrow: one run of tick as "ran/drawn/blocked/reminders/completed".
create function pg_temp.tickrow() returns text
language sql as $$
  select format('%s/%s/%s/%s/%s', ran::text, drawn, blocked, reminders, completed) from private.tick()
$$;

-- snap: what a run could change across the fixtures: completion times, events, outbox rows.
create function pg_temp.snap() returns text
language sql as $$
  select coalesce((select string_agg(x.name || '=' || coalesce(x.completed_at::text, '-'), ',' order by x.name) from public.exchanges x where x.name like 'T400%'), '')
  || '/' || (select count(*) from public.activity_events ae join public.exchanges x on x.id = ae.exchange_id where x.name like 'T400%')::text
  || '/' || (select count(*) from private.email_outbox o join public.exchanges x on x.id = o.exchange_id where x.name like 'T400%')::text
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u400-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Pat'])[i]))
  from generate_series(1, 6) i;
end $fx$;

-- C01 gift day eight days before the zone's today: its boundary (gift day + 8 at local midnight) is today 00:00 in a zone where it is
-- 0:xx now, so it has just passed. C02 the same, in a zone where it is 23:xx: the boundary is tomorrow 00:00, an hour or less away.
-- C03 never drawn; C04 drawn then cancelled; C05 drawn and already complete; C06 open (gift day in ten days). All organiser_chooses.
do $fx$
declare
  v_zp text := pg_temp.zone_at_hour(0);
  v_zf text := pg_temp.zone_at_hour(23);
begin
  if v_zp is null or v_zf is null then
    raise exception 'T400 fixture: no zone found (%, %)', v_zp, v_zf;
  end if;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.c01', pg_temp.mkx('T400 C01 Passed', pg_temp.u(6), 'organiser_chooses', now() - interval '20 days', pg_temp.gd(v_zp, -8), v_zp)::text, true);
  perform set_config('test.c02', pg_temp.mkx('T400 C02 NotYet', pg_temp.u(6), 'organiser_chooses', now() - interval '20 days', pg_temp.gd(v_zf, -7), v_zf)::text, true);
  perform set_config('test.c03', pg_temp.mkx('T400 C03 NeverDrawn', pg_temp.u(6), 'organiser_chooses', now() - interval '20 days', pg_temp.gd(v_zp, -8), v_zp)::text, true);
  perform set_config('test.c04', pg_temp.mkx('T400 C04 Cancelled', pg_temp.u(6), 'organiser_chooses', now() - interval '20 days', pg_temp.gd(v_zp, -8), v_zp)::text, true);
  perform set_config('test.c05', pg_temp.mkx('T400 C05 AlreadyDone', pg_temp.u(6), 'organiser_chooses', now() - interval '20 days', pg_temp.gd(v_zp, -8), v_zp)::text, true);
  perform set_config('test.c06', pg_temp.mkx('T400 C06 Open', pg_temp.u(6), 'organiser_chooses', now() + interval '5 days', current_date + 10, 'Africa/Lagos')::text, true);
  -- WHY a guard: report the real problem if a fixture exchange was not written.
  if (select count(*) from public.exchanges where name like 'T400 C%') <> 6 then
    raise exception 'T400 fixture: expected 6 exchanges, found %', (select count(*) from public.exchanges where name like 'T400 C%');
  end if;
end $fx$;

-- Members, distinct join times so the ring is known: Ada gives to Bola, Bola to Chi, Chi to Ada. C01 also has Dayo (active, not
-- taking part) and Eze (left).
do $fx$ begin
  perform pg_temp.mem(current_setting('test.c01')::uuid, 1, now() - interval '100 days');
  perform pg_temp.mem(current_setting('test.c01')::uuid, 2, now() - interval '99 days');
  perform pg_temp.mem(current_setting('test.c01')::uuid, 3, now() - interval '98 days');
  perform pg_temp.mem(current_setting('test.c01')::uuid, 4, now() - interval '97 days', false);
  perform pg_temp.mem(current_setting('test.c01')::uuid, 5, now() - interval '96 days', true, 'left');
  perform pg_temp.mem(current_setting('test.c02')::uuid, 1, now() - interval '100 days');
  perform pg_temp.mem(current_setting('test.c02')::uuid, 2, now() - interval '99 days');
  perform pg_temp.mem(current_setting('test.c02')::uuid, 3, now() - interval '98 days');
  perform pg_temp.mem(current_setting('test.c03')::uuid, 1, now() - interval '100 days');
  perform pg_temp.mem(current_setting('test.c03')::uuid, 2, now() - interval '99 days');
  perform pg_temp.mem(current_setting('test.c03')::uuid, 3, now() - interval '98 days');
  perform pg_temp.mem(current_setting('test.c04')::uuid, 1, now() - interval '100 days');
  perform pg_temp.mem(current_setting('test.c04')::uuid, 2, now() - interval '99 days');
  perform pg_temp.mem(current_setting('test.c04')::uuid, 3, now() - interval '98 days');
  perform pg_temp.mem(current_setting('test.c05')::uuid, 1, now() - interval '100 days');
  perform pg_temp.mem(current_setting('test.c05')::uuid, 2, now() - interval '99 days');
  perform pg_temp.mem(current_setting('test.c05')::uuid, 3, now() - interval '98 days');
  perform pg_temp.mem(current_setting('test.c06')::uuid, 1, now() - interval '100 days');
  perform pg_temp.mem(current_setting('test.c06')::uuid, 2, now() - interval '99 days');
  perform pg_temp.mem(current_setting('test.c06')::uuid, 3, now() - interval '98 days');
  perform pg_temp.ring(current_setting('test.c01')::uuid);
  perform pg_temp.ring(current_setting('test.c02')::uuid);
  perform pg_temp.ring(current_setting('test.c04')::uuid);
  perform pg_temp.ring(current_setting('test.c05')::uuid);
  update public.exchanges set cancelled_at = now() where id = current_setting('test.c04')::uuid;
  update public.exchanges set completed_at = now() - interval '2 days' where id = current_setting('test.c05')::uuid;
  -- Park every exchange that is not a fixture (this transaction rolls back).
  update public.exchanges set cancelled_at = now() where cancelled_at is null and name not like 'T400%';
end $fx$;

-- Bola has revealed in C01, and Chi, who she gives to, has a list with one item attached there.
do $fx$ begin
  update private.assignments a set revealed_at = now()
    from public.exchange_members g
   where g.id = a.giver_member_id and a.exchange_id = current_setting('test.c01')::uuid and g.user_id = pg_temp.u(2);
  insert into public.wishlists (owner_id, name) values (pg_temp.u(3), 'T400 Chi list');
  insert into public.wishlist_items (wishlist_id, name, priority)
    values ((select id from public.wishlists where name = 'T400 Chi list'), 'T400 Item', 'most_wanted');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T400 Chi list')
    where exchange_id = current_setting('test.c01')::uuid and user_id = pg_temp.u(3);
end $fx$;

-- Just before completion the exchange is event_passed and Bola's reads work: her recipient, her list, and marking an item.
-- WHY the item reference is read here as the migration role: it is md5(row salt || item id), and a signed-in person cannot read the
-- assignments table directly (the function below does it for them).
do $fx$ begin
  perform set_config('test.ref', (
    select md5(a.ref_salt || i.id::text)
      from private.assignments a
      join public.exchange_members g on g.id = a.giver_member_id and g.user_id = pg_temp.u(2)
      cross join public.wishlist_items i
     where a.exchange_id = current_setting('test.c01')::uuid and a.superseded_at is null and i.name = 'T400 Item'), true);
end $fx$;
do $fx$ begin
  perform set_config('test.pre', pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.c01')))
    || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.c01')))
    || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from (select public.set_gift_mark(%L, %L, true)) s)', current_setting('test.c01'), current_setting('test.ref')))
    || '/' || private.exchange_status(current_setting('test.c01')::uuid)::text, true);
end $fx$;

-- First run. WHY its own statement: everything below reads what it wrote.
do $fx$ begin
  perform set_config('test.t1', pg_temp.tickrow(), true);
end $fx$;

-- 1. AC-8: exactly one exchange was completed, and nothing was drawn, blocked or reminded.
select is(current_setting('test.t1'), 'true/0/0/0/1', 'the first run completed one exchange and did nothing else');

-- 2. AC-8: only C01 (boundary just passed) and C05 (already complete before) are complete; C02 (boundary ahead), the never-drawn, the
-- cancelled and the open exchange are not. C05's time is the old one, C01's is now.
select is(
  (select string_agg(x.name || ':' || (x.completed_at is not null)::text, '|' order by x.name) from public.exchanges x where x.name like 'T400 C%')
  || '/' || (select (completed_at = now())::text from public.exchanges where id = current_setting('test.c01')::uuid)
  || '/' || (select (completed_at < now() - interval '1 day')::text from public.exchanges where id = current_setting('test.c05')::uuid),
  'T400 C01 Passed:true|T400 C02 NotYet:false|T400 C03 NeverDrawn:false|T400 C04 Cancelled:false|T400 C05 AlreadyDone:true|T400 C06 Open:false/true/true',
  'a drawn exchange past its boundary is completed; one before it, never drawn, cancelled or open is not; a complete one keeps its time');

-- 3. AC-8: the boundary really is on the two sides. C01's boundary (gift day + 8 at local midnight) is at most an hour before now; C02's
-- is at most an hour after.
select ok(
  (select ((x.gift_day + 8)::timestamp at time zone x.organiser_tz) <= now()
          and ((x.gift_day + 8)::timestamp at time zone x.organiser_tz) > now() - interval '1 hour'
   from public.exchanges x where x.id = current_setting('test.c01')::uuid)
  and (select ((x.gift_day + 8)::timestamp at time zone x.organiser_tz) > now()
          and ((x.gift_day + 8)::timestamp at time zone x.organiser_tz) <= now() + interval '1 hour'
   from public.exchanges x where x.id = current_setting('test.c02')::uuid),
  'C01 is completed with its boundary just passed and C02 is not with its boundary just ahead (within the hour on both sides)');

-- 4. AC-8: one exchange_completed event per ACTIVE member of C01 (the organiser who only organises, someone not taking part, and
-- everyone taking part; not Eze, who left), none for any other exchange, none with a subject, and no email of any kind.
select is(
  (select string_agg(p.display_name, '|' order by p.display_name)
   from public.activity_events ae join public.profiles p on p.id = ae.user_id
   where ae.kind = 'exchange_completed' and ae.exchange_id = current_setting('test.c01')::uuid)
  || '/' || (select count(*)::text from public.activity_events ae join public.exchanges x on x.id = ae.exchange_id
             where x.name like 'T400 C%' and x.id <> current_setting('test.c01')::uuid)
  || '/' || (select count(*)::text from public.activity_events where kind = 'exchange_completed' and subject_user_id is not null
             and exchange_id = current_setting('test.c01')::uuid)
  || '/' || (select count(*)::text from private.email_outbox o join public.exchanges x on x.id = o.exchange_id where x.name like 'T400%'),
  'Ada|Bola|Chi|Dayo|Pat/0/0/0',
  'completion writes one event per active member, names no one, and sends no email');

-- 5. Invariant 12: afterwards the exchange is complete for everyone, and the giver's reads refuse. Before it, the same reads worked
-- (recipient 1 row, list 1 row, a mark accepted, state event_passed).
select is(
  current_setting('test.pre')
  || '/' || private.exchange_status(current_setting('test.c01')::uuid)::text
  || '/' || pg_temp.val_as(pg_temp.u(2), format('public.exchange_state(%L)', current_setting('test.c01')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.c01')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.open_recipient_list(%L))', current_setting('test.c01')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from (select public.set_gift_mark(%L, %L, false)) s)', current_setting('test.c01'), current_setting('test.ref'))),
  '1/1/1/event_passed/complete/complete/0/0/err:P0002:',
  'after completion the exchange reads complete and the recipient, the list and the marks refuse; just before, they worked');

-- 6. AC-8: a second run writes nothing, and keeps the first completion time.
do $fx$ begin
  perform set_config('test.snap1', pg_temp.snap(), true);
  perform set_config('test.t2', pg_temp.tickrow(), true);
end $fx$;
select is(current_setting('test.t2') || '|' || (pg_temp.snap() = current_setting('test.snap1'))::text,
  'true/0/0/0/0|true', 'a second run completes nothing, writes nothing and keeps the completion time');

-- 7-8. AC-2: bounded work. 105 drawn exchanges are past their boundary (gift days from 119 to 15 days ago); a run completes 100, the
-- oldest gift day first, the next run the last 5, the one after nothing; each has three active members and so three events.
do $fx$
declare
  v uuid;
  n int;
begin
  for n in 1 .. 105 loop
    v := pg_temp.mkx('T400 Z' || lpad(n::text, 3, '0'), pg_temp.u(6), 'organiser_chooses', now() - interval '200 days', current_date - 120 + n, 'UTC');
    perform pg_temp.mem(v, 2, now() - interval '100 days');
    perform pg_temp.mem(v, 3, now() - interval '99 days');
    perform pg_temp.ring(v);
  end loop;
end $fx$;
do $fx$ begin
  perform set_config('test.b1', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.b1')
  || '/' || (select string_agg(name, ',' order by name) from public.exchanges where name like 'T400 Z%' and completed_at is null),
  'true/0/0/0/100/T400 Z101,T400 Z102,T400 Z103,T400 Z104,T400 Z105',
  'a run completes at most 100 exchanges, the oldest gift day first');
do $fx$ begin
  perform set_config('test.b2', pg_temp.tickrow(), true);
  perform set_config('test.b3', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.b2') || '|' || current_setting('test.b3')
  || '|' || (select count(*)::text from public.exchanges where name like 'T400 Z%' and completed_at is not null)
  || '|' || (select count(*)::text from public.activity_events ae join public.exchanges x on x.id = ae.exchange_id
             where ae.kind = 'exchange_completed' and x.name like 'T400 Z%'),
  'true/0/0/0/5|true/0/0/0/0|105|315',
  'the next run completes the last 5, the one after nothing, and each exchange has one event per active member');

select * from finish();
rollback;
