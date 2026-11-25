-- 390_reminders — slice 12 (GC-026 reminders, GC-007 Activity; plan §5, §6 invariants 9, 11; owner decisions 2026-11-24 Q7, Q8 in
-- docs/tasks/slice-12.md; boards Email-E23 and Email-E24 in docs/tasks/slice-12-boards.md).
-- Covers (AC-6, AC-7, AC-9): the join-by reminder (E23) goes to active members taking part with no list who joined at least 24
-- hours before join-by, while the exchange is open, from 24 hours before join-by (inclusive) until join-by (exclusive), and not
-- after a draw, a cancel, a completion or once join-by has passed; the toggle notify_join_by_reminder is honoured; a person who was
-- already sent a reminder for a later date is skipped. The event reminder (E24) goes only for DRAWN exchanges (Q7), to active
-- members taking part, from 9:00 the day before the gift day until the gift day starts in THE RECIPIENT'S zone (user_settings.timezone,
-- else the organiser's zone), the toggle notify_event_reminder is honoured, two zones in one exchange give two answers, and
-- private.reminder_window gives the right instants across daylight-saving changes. A run after downtime inside a window sends
-- once; a second run sends nothing (dedupe keys joinby:{ex}:{user}:{epoch} and event:{ex}:{user}:{epoch}); an Activity event is
-- written only for a queued email (Q8); no outbox row names anyone but its reader (no sender, no subject, exchange id only); the
-- claim cancels a reminder that is no longer needed (not_needed), carries what the E23 and E24 boards show and nothing else, and
-- E24 carries the reader's own reveal flag; one run queues at most 500 reminders, oldest first.
-- WHY the zones come from the clock: tick uses now(), which a test cannot move. Exchanges are placed relative to now(), and the
-- recipient zones are fixed-offset zones (Etc/GMT...) chosen so that the local hour is right now: noon (inside), 9 (just inside), 8
-- (just before the window opens), 23 (just before it closes) and 0 (just after the gift day began). That tests the 9:00 opening and
-- the midnight closing to the hour on both sides. The daylight-saving and zone arithmetic is tested directly on
-- private.reminder_window with fixed dates, because no real transition can be placed under a frozen now().
-- WHY the other exchanges are parked first: tick looks at every exchange. Every exchange that is not a fixture is cancelled inside
-- this transaction (it rolls back), and unsent outbox rows of other exchanges are cancelled so the claim reads only fixtures.
-- Self-contained: creates its own users inside the transaction (needs the migrations through scheduled_jobs applied, not
-- seed.sql). Everything rolls back. Names are prefixed "T390" because dev holds other data.
-- Written BEFORE the scheduled_jobs migration: until it is applied the first statement that names private.tick fails and the
-- run stops. That is the expected "red".
-- Pass: "ok 1".."ok 14", "1..14", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
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

-- u(n) is persona n (see the fixtures below for who is who).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('39' || lpad(n::text, 3, '0'), 12, '0'))::uuid
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
  values (v, p_org, false, now() - interval '30 days');
  return v;
end $$;

-- mem adds persona p_n to an exchange. A member who left or was removed gets a left_at, as the table check demands.
create function pg_temp.mem(p_ex uuid, p_n int, p_joined timestamptz, p_taking boolean default true,
                            p_state public.exchange_member_state default 'active') returns void
language sql as $$
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
  values (p_ex, pg_temp.u(p_n), p_taking, p_state, p_joined,
          case when p_state = 'active' then null else p_joined + interval '1 hour' end)
$$;

-- ring writes a draw straight into the table: each active member taking part gives to the next. Needs two people or more.
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

-- gd: the date it is now in a zone, plus p_plus days.
create function pg_temp.gd(p_tz text, p_plus int) returns date
language sql as $$
  select (now() at time zone p_tz)::date + p_plus
$$;

create function pg_temp.owner_try(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return sqlstate;
end $$;

-- tickrow: one run of tick as "ran/drawn/blocked/reminders/completed".
create function pg_temp.tickrow() returns text
language sql as $$
  select format('%s/%s/%s/%s/%s', ran::text, drawn, blocked, reminders, completed) from private.tick()
$$;

-- snap: what a run could change across the fixtures: outbox rows, events, assignment rows.
create function pg_temp.snap() returns text
language sql as $$
  select (select count(*) from private.email_outbox o join public.exchanges x on x.id = o.exchange_id where x.name like 'T390%')::text
  || '/' || (select count(*) from public.activity_events ae join public.exchanges x on x.id = ae.exchange_id where x.name like 'T390%')::text
  || '/' || (select count(*) from private.assignments a join public.exchanges x on x.id = a.exchange_id where x.name like 'T390%')::text
$$;

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

-- Fixtures. Personas: 1 Pat (organiser of everything, only organising); join-by group: 2 Bola, 3 Chi, 4 Dayo, 5 Eze, 6 Femi,
-- 7 Gbemi, 8 Hana, 9 Ife, 10 Jide; event group: 11 Kemi, 12 Lola, 13 Mo, 14 Nia, 15 Ola, 16 Quin, 17 Rae, 18 Sam, 19 Tola,
-- 20 Uche, 21 Vic, 22 Wale, 23 Xola, 24 Yemi, 25 Zed.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u390-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Pat', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi', 'Lola', 'Mo', 'Nia',
      'Ola', 'Quin', 'Rae', 'Sam', 'Tola', 'Uche', 'Vic', 'Wale', 'Xola', 'Yemi', 'Zed'])[i]))
  from generate_series(1, 25) i;
end $fx$;

-- JOIN-BY exchanges. All organiser_chooses so the scheduled draw never looks at them. Join-by moments relative to now():
-- J01 +12h (the full member list), J02 +24h1m (window not open), J03 +24h exactly (open, inclusive), J04 now (closed, exclusive),
-- J05 +1m, J06 cancelled, J07 drawn, J08 complete, J10 +1h (a run after downtime: the window opened 23 hours ago), J11 +12h
-- (the person was already sent a reminder for a later date).
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.j01', pg_temp.mkx('T390 J01', pg_temp.u(1), 'organiser_chooses', now() + interval '12 hours', current_date + 10)::text, true);
  perform set_config('test.j02', pg_temp.mkx('T390 J02', pg_temp.u(1), 'organiser_chooses', now() + interval '24 hours 1 minute', current_date + 10)::text, true);
  perform set_config('test.j03', pg_temp.mkx('T390 J03', pg_temp.u(1), 'organiser_chooses', now() + interval '24 hours', current_date + 10)::text, true);
  perform set_config('test.j04', pg_temp.mkx('T390 J04', pg_temp.u(1), 'organiser_chooses', now(), current_date + 10)::text, true);
  perform set_config('test.j05', pg_temp.mkx('T390 J05', pg_temp.u(1), 'organiser_chooses', now() + interval '1 minute', current_date + 10)::text, true);
  perform set_config('test.j06', pg_temp.mkx('T390 J06', pg_temp.u(1), 'organiser_chooses', now() + interval '12 hours', current_date + 10)::text, true);
  perform set_config('test.j07', pg_temp.mkx('T390 J07', pg_temp.u(1), 'organiser_chooses', now() + interval '12 hours', current_date + 10)::text, true);
  perform set_config('test.j08', pg_temp.mkx('T390 J08', pg_temp.u(1), 'organiser_chooses', now() + interval '12 hours', current_date + 10)::text, true);
  perform set_config('test.j10', pg_temp.mkx('T390 J10', pg_temp.u(1), 'organiser_chooses', now() + interval '1 hour', current_date + 10)::text, true);
  perform set_config('test.j11', pg_temp.mkx('T390 J11', pg_temp.u(1), 'organiser_chooses', now() + interval '12 hours', current_date + 10)::text, true);
  -- WHY a guard: report the real problem if a fixture exchange was not written.
  if (select count(*) from public.exchanges where name like 'T390 J%') <> 10 then
    raise exception 'T390 fixture: expected 10 join-by exchanges, found %', (select count(*) from public.exchanges where name like 'T390 J%');
  end if;
end $fx$;

-- J01 members: Bola (a recipient), Chi (has a list), Dayo (joined 23h1m... one minute short of 24 hours before join-by), Eze (reminders
-- off), Femi (not taking part), Gbemi (left), Hana (removed), Ife (anonymised), Jide (joined exactly 24 hours before join-by).
do $fx$ begin
  perform pg_temp.mem(current_setting('test.j01')::uuid, 2, now() - interval '3 days');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 3, now() - interval '3 days');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 4, now() - interval '12 hours' + interval '1 minute');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 5, now() - interval '3 days');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 6, now() - interval '3 days', false);
  perform pg_temp.mem(current_setting('test.j01')::uuid, 7, now() - interval '3 days', true, 'left');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 8, now() - interval '3 days', true, 'removed');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 9, now() - interval '3 days');
  perform pg_temp.mem(current_setting('test.j01')::uuid, 10, now() - interval '12 hours');
  perform pg_temp.mem(current_setting('test.j02')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j02')::uuid, 10, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j03')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j04')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j05')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j06')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j07')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j07')::uuid, 10, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j08')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j10')::uuid, 2, now() - interval '5 days');
  perform pg_temp.mem(current_setting('test.j11')::uuid, 10, now() - interval '5 days');
  perform pg_temp.ring(current_setting('test.j07')::uuid);
  update public.exchanges set cancelled_at = now() where id = current_setting('test.j06')::uuid;
  update public.exchanges set completed_at = now() - interval '1 hour' where id = current_setting('test.j08')::uuid;
  update public.profiles set anonymised_at = now() where id = pg_temp.u(9);
  update public.user_settings set notify_join_by_reminder = false where user_id = pg_temp.u(5);
  -- Chi has a list attached in J01.
  insert into public.wishlists (owner_id, name) values (pg_temp.u(3), 'T390 Chi list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T390 Chi list')
    where exchange_id = current_setting('test.j01')::uuid and user_id = pg_temp.u(3);
  -- Jide was already sent a join-by reminder for J11 for a later date (a day after its join-by): this run must skip him.
  insert into private.email_outbox (template, recipient_user_id, exchange_id, dedupe_key, sent_at, for_at)
  values ('E23', pg_temp.u(10), current_setting('test.j11')::uuid, 'T390-sentlater', now(),
          (select join_by_at + interval '1 day' from public.exchanges where id = current_setting('test.j11')::uuid));
end $fx$;

-- EVENT exchanges. Zones: zn local hour 12, z9 hour 9, z8 hour 8, z23 hour 23, z0 hour 0. All organiser_chooses, all drawn by a ring
-- written into the table except E07 (never drawn). The gift day is tomorrow in the zone (window open now when the local time is
-- 9:00 or later) except E06 (today there: the gift day has begun, the window closed).
--   E01 zn: Kemi (recipient), Lola (reminders off), Mo (left after the draw), Nia (no settings row: the organiser's zone), Ola (not taking part)
--   E02 organiser Lagos: Quin (zn: inside), Rae (z8: before 9:00)         -> two zones, one exchange, two answers
--   E03 z9: Sam, Tola (9:xx there: just inside)    E04 z8: Uche, Vic (8:xx: window not open)
--   E05 z23: Wale, Xola (23:xx: just before closing)    E06 z0: Yemi, Zed (0:xx on the gift day: closed)
--   E07 zn not drawn: Kemi, Ola     E08 zn drawn then cancelled: Kemi, Ola     E09 zn drawn then complete: Kemi, Ola
do $fx$
declare
  v_zn text := pg_temp.zone_at_hour(12);
  v_z9 text := pg_temp.zone_at_hour(9);
  v_z8 text := pg_temp.zone_at_hour(8);
  v_z23 text := pg_temp.zone_at_hour(23);
  v_z0 text := pg_temp.zone_at_hour(0);
begin
  if v_zn is null or v_z9 is null or v_z8 is null or v_z23 is null or v_z0 is null then
    raise exception 'T390 fixture: no zone found for an hour (%, %, %, %, %)', v_zn, v_z9, v_z8, v_z23, v_z0;
  end if;
  perform set_config('test.e01', pg_temp.mkx('T390 E01', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_zn, 1), v_zn)::text, true);
  perform set_config('test.e02', pg_temp.mkx('T390 E02', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_zn, 1), 'Africa/Lagos')::text, true);
  perform set_config('test.e03', pg_temp.mkx('T390 E03', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_z9, 1), v_z9)::text, true);
  perform set_config('test.e04', pg_temp.mkx('T390 E04', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_z8, 1), v_z8)::text, true);
  perform set_config('test.e05', pg_temp.mkx('T390 E05', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_z23, 1), v_z23)::text, true);
  perform set_config('test.e06', pg_temp.mkx('T390 E06', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_z0, 0), v_z0)::text, true);
  perform set_config('test.e07', pg_temp.mkx('T390 E07', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_zn, 1), v_zn)::text, true);
  perform set_config('test.e08', pg_temp.mkx('T390 E08', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_zn, 1), v_zn)::text, true);
  perform set_config('test.e09', pg_temp.mkx('T390 E09', pg_temp.u(1), 'organiser_chooses', now() - interval '3 days', pg_temp.gd(v_zn, 1), v_zn)::text, true);
  if (select count(*) from public.exchanges where name like 'T390 E%') <> 9 then
    raise exception 'T390 fixture: expected 9 event exchanges, found %', (select count(*) from public.exchanges where name like 'T390 E%');
  end if;

  -- Each person's zone. Nia has no settings row at all.
  update public.user_settings set timezone = v_zn where user_id in (pg_temp.u(11), pg_temp.u(12), pg_temp.u(13), pg_temp.u(15), pg_temp.u(16));
  update public.user_settings set timezone = v_z8 where user_id in (pg_temp.u(17), pg_temp.u(20), pg_temp.u(21));
  update public.user_settings set timezone = v_z9 where user_id in (pg_temp.u(18), pg_temp.u(19));
  update public.user_settings set timezone = v_z23 where user_id in (pg_temp.u(22), pg_temp.u(23));
  update public.user_settings set timezone = v_z0 where user_id in (pg_temp.u(24), pg_temp.u(25));
  delete from public.user_settings where user_id = pg_temp.u(14);
  update public.user_settings set notify_event_reminder = false where user_id = pg_temp.u(12);
end $fx$;

do $fx$ begin
  perform pg_temp.mem(current_setting('test.e01')::uuid, 11, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e01')::uuid, 12, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e01')::uuid, 13, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e01')::uuid, 14, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e01')::uuid, 15, now() - interval '10 days', false);
  perform pg_temp.mem(current_setting('test.e02')::uuid, 16, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e02')::uuid, 17, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e03')::uuid, 18, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e03')::uuid, 19, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e04')::uuid, 20, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e04')::uuid, 21, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e05')::uuid, 22, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e05')::uuid, 23, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e06')::uuid, 24, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e06')::uuid, 25, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e07')::uuid, 11, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e07')::uuid, 15, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e08')::uuid, 11, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e08')::uuid, 15, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e09')::uuid, 11, now() - interval '10 days');
  perform pg_temp.mem(current_setting('test.e09')::uuid, 15, now() - interval '10 days');
  perform pg_temp.ring(current_setting('test.e01')::uuid);
  perform pg_temp.ring(current_setting('test.e02')::uuid);
  perform pg_temp.ring(current_setting('test.e03')::uuid);
  perform pg_temp.ring(current_setting('test.e04')::uuid);
  perform pg_temp.ring(current_setting('test.e05')::uuid);
  perform pg_temp.ring(current_setting('test.e06')::uuid);
  perform pg_temp.ring(current_setting('test.e08')::uuid);
  perform pg_temp.ring(current_setting('test.e09')::uuid);
  -- Mo leaves E01 after the draw (his row in the draw stays, as in the app).
  update public.exchange_members set state = 'left', left_at = now()
    where exchange_id = current_setting('test.e01')::uuid and user_id = pg_temp.u(13);
  update public.exchanges set cancelled_at = now() where id = current_setting('test.e08')::uuid;
  update public.exchanges set completed_at = now() - interval '1 hour' where id = current_setting('test.e09')::uuid;
  -- Park every exchange that is not a fixture, and every unsent outbox row that is not a fixture's (this transaction rolls back).
  update public.exchanges set cancelled_at = now() where cancelled_at is null and name not like 'T390%';
  update private.email_outbox o set cancelled_at = now()
   where o.sent_at is null and o.cancelled_at is null
     and not exists (select 1 from public.exchanges x where x.id = o.exchange_id and x.name like 'T390%');
end $fx$;

-- First run. WHY its own statement: everything below reads what it wrote.
do $fx$ begin
  perform set_config('test.t1', pg_temp.tickrow(), true);
end $fx$;

-- 1. AC-6: 5 join-by reminders (Bola four times, Jide once) and 7 event reminders; no draw, no block, no completion.
select is(current_setting('test.t1'), 'true/0/0/12/0', 'the first run queued 12 reminders (5 join-by, 7 event) and did nothing else');

-- 2. AC-6, AC-7: the join-by reminders. Who: active members taking part with no list who joined at least 24 hours before join-by
-- (Jide, exactly 24 hours, yes; Dayo, one minute short, no); not Chi (list), Eze (off), Femi (not taking part), Gbemi (left), Hana
-- (removed), Ife (anonymised). When: J01 +12h, J03 +24h exactly, J05 +1m, J10 +1h; not J02 (+24h1m), J04 (now), J06 (cancelled),
-- J07 (drawn), J08 (complete), J11 (a reminder for a later date was already sent).
select is(
  (select string_agg(x.name || ':' || p.display_name, '|' order by x.name, p.display_name)
   from private.email_outbox o
   join public.exchanges x on x.id = o.exchange_id
   join public.profiles p on p.id = o.recipient_user_id
   where o.template = 'E23' and o.dedupe_key like 'joinby:%' and x.name like 'T390%'),
  'T390 J01:Bola|T390 J01:Jide|T390 J03:Bola|T390 J05:Bola|T390 J10:Bola',
  'join-by reminders go to the right people, inside the window only, and not after a draw, a cancel, a completion or the join-by moment');

-- 3. AC-6, Q7: the event reminders. Kemi and Nia in E01 (Nia has no settings row: the organiser's zone), Quin in E02 (Rae, 8:xx there,
-- is not yet in her window), Sam and Tola in E03 (9:xx), Wale and Xola in E05 (23:xx). Not E04 (8:xx), not E06 (the gift day has
-- begun there), not E07 (never drawn), E08 (cancelled), E09 (complete); not Lola (off), Mo (left), Ola (not taking part).
select is(
  (select string_agg(x.name || ':' || p.display_name, '|' order by x.name, p.display_name)
   from private.email_outbox o
   join public.exchanges x on x.id = o.exchange_id
   join public.profiles p on p.id = o.recipient_user_id
   where o.template = 'E24' and o.dedupe_key like 'event:%' and x.name like 'T390%'),
  'T390 E01:Kemi|T390 E01:Nia|T390 E02:Quin|T390 E03:Sam|T390 E03:Tola|T390 E05:Wale|T390 E05:Xola',
  'event reminders go to people taking part in drawn exchanges, in their own zone, from 9:00 the day before until the gift day begins');

-- 4. AC-7: the exchanges that must have no reminder have none, and the person with a later reminder already sent has no new row.
select is(
  (select count(*)::text from public.exchanges
   where name in ('T390 J02', 'T390 J04', 'T390 J06', 'T390 J07', 'T390 J08', 'T390 J11', 'T390 E04', 'T390 E06', 'T390 E07', 'T390 E08', 'T390 E09'))
  || '/' || (select count(*)::text from private.email_outbox o join public.exchanges x on x.id = o.exchange_id
             where x.name in ('T390 J02', 'T390 J04', 'T390 J06', 'T390 J07', 'T390 J08', 'T390 J11', 'T390 E04', 'T390 E06', 'T390 E07', 'T390 E08', 'T390 E09')
               and (o.dedupe_key like 'joinby:%' or o.dedupe_key like 'event:%')),
  '11/0', 'no reminder is queued before a window opens, after it closes, after a draw, a cancel or a completion, or after a later one was sent');

-- 5. AC-9: every reminder row is to its reader only: no sender, no subject, no typed address, the exchange id as the whole payload, due
-- now, unsent; the dedupe key and for_at are the join-by moment (E23) or the start of the gift day in the person's zone (E24).
select ok(
  (select count(*) = 5 and bool_and(
      o.sender_id is null and o.recipient_email is null and o.cancelled_at is null and o.sent_at is null and o.send_after <= now()
      and o.payload = jsonb_build_object('exchange_id', x.id)
      and o.for_at = x.join_by_at
      and o.dedupe_key = 'joinby:' || x.id::text || ':' || o.recipient_user_id::text || ':' || (extract(epoch from x.join_by_at))::bigint::text)
   from private.email_outbox o join public.exchanges x on x.id = o.exchange_id
   where o.template = 'E23' and o.dedupe_key like 'joinby:%' and x.name like 'T390 J%')
  and (select count(*) = 7 and bool_and(
      o.sender_id is null and o.recipient_email is null and o.cancelled_at is null and o.sent_at is null and o.send_after <= now()
      and o.payload = jsonb_build_object('exchange_id', x.id)
      and o.for_at = (x.gift_day::timestamp at time zone coalesce(s.timezone, x.organiser_tz))
      and o.dedupe_key = 'event:' || x.id::text || ':' || o.recipient_user_id::text || ':' || (extract(epoch from o.for_at))::bigint::text)
   from private.email_outbox o
   join public.exchanges x on x.id = o.exchange_id
   left join public.user_settings s on s.user_id = o.recipient_user_id
   where o.template = 'E24' and o.dedupe_key like 'event:%' and x.name like 'T390 E%'),
  'reminder rows name only their reader: no sender, subject or address; the key and for_at follow the date and the reader''s zone');

-- 6. Q8: an Activity event only where an email was queued: join_by_reminder 4 for Bola and 1 for Jide (none for Eze, who turned it
-- off), event_reminder once for each of the 7; none carries a subject.
select is(
  (select string_agg(t.nm || ':' || t.n, '|' order by t.nm)
   from (select p.display_name as nm, count(*) as n
           from public.activity_events ae join public.profiles p on p.id = ae.user_id join public.exchanges x on x.id = ae.exchange_id
          where ae.kind = 'join_by_reminder' and x.name like 'T390%' group by p.display_name) t)
  || '/' || (select string_agg(t.nm || ':' || t.n, '|' order by t.nm)
   from (select p.display_name as nm, count(*) as n
           from public.activity_events ae join public.profiles p on p.id = ae.user_id join public.exchanges x on x.id = ae.exchange_id
          where ae.kind = 'event_reminder' and x.name like 'T390%' group by p.display_name) t)
  || '/' || (select count(*)::text from public.activity_events ae join public.exchanges x on x.id = ae.exchange_id
             where ae.kind in ('join_by_reminder', 'event_reminder') and ae.subject_user_id is not null and x.name like 'T390%'),
  'Bola:4|Jide:1/Kemi:1|Nia:1|Quin:1|Sam:1|Tola:1|Wale:1|Xola:1/0',
  'a reminder event is written only with a queued email, once per email, and names no one');

-- 7. AC-2: a second run (and so a run after downtime inside the same window) sends nothing more and writes nothing.
do $fx$ begin
  perform set_config('test.snap1', pg_temp.snap(), true);
end $fx$;
do $fx$ begin
  perform set_config('test.t2', pg_temp.tickrow(), true);
end $fx$;
select is(current_setting('test.t2') || '|' || (pg_temp.snap() = current_setting('test.snap1'))::text,
  'true/0/0/0/0|true', 'a second run queues no reminder and writes no event: each reminder is sent once');

-- 8-10. The claim. Changes after the reminders were queued: Bola adds a list in J03, Jide turns the join-by reminder off, J10 is
-- cancelled, E01 is cancelled, Sam leaves E03, E05's gift day moves a day. Tola reveals in E03. Those reminders are no longer needed.
do $fx$ begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T390 Bola list');
  update public.exchange_members set attached_wishlist_id = (select id from public.wishlists where name = 'T390 Bola list')
    where exchange_id = current_setting('test.j03')::uuid and user_id = pg_temp.u(2);
  update public.user_settings set notify_join_by_reminder = false where user_id = pg_temp.u(10);
  update public.exchanges set cancelled_at = now() where id in (current_setting('test.j10')::uuid, current_setting('test.e01')::uuid);
  update public.exchange_members set state = 'left', left_at = now()
    where exchange_id = current_setting('test.e03')::uuid and user_id = pg_temp.u(18);
  update public.exchanges set gift_day = gift_day + 1 where id = current_setting('test.e05')::uuid;
  update private.assignments a set revealed_at = now()
    from public.exchange_members g
   where g.id = a.giver_member_id and a.exchange_id = current_setting('test.e03')::uuid and g.user_id = pg_temp.u(19);
end $fx$;
do $fx$ begin
  perform pg_temp.claim_as_svc(50, 'test.claim1');
end $fx$;

-- 8. AC-6: what the sender receives is only the reminders still needed: Quin in E02, Tola in E03, Bola in J01 and J05.
select is(
  (select string_agg(c ->> 'template' || ':' || (c ->> 'exchange_name') || ':' || (c ->> 'to_name'), '|' order by c ->> 'exchange_name', c ->> 'to_name')
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
   where c ->> 'exchange_name' like 'T390%'),
  'E24:T390 E02:Quin|E24:T390 E03:Tola|E23:T390 J01:Bola|E23:T390 J05:Bola',
  'the claim hands over only the reminders still needed');

-- 9. AC-7: the others were cancelled as not_needed and never claimed: Jide in J01 (turned it off), Bola in J03 (has a list), Bola in
-- J10 and Kemi and Nia in E01 (cancelled), Sam in E03 (left), Wale and Xola in E05 (the date moved).
select is(
  (select string_agg(x.name || ':' || p.display_name, '|' order by x.name, p.display_name)
   from private.email_outbox o
   join public.exchanges x on x.id = o.exchange_id
   join public.profiles p on p.id = o.recipient_user_id
   where o.template in ('E23', 'E24') and o.last_error_code = 'not_needed' and o.cancelled_at is not null and x.name like 'T390%'),
  'T390 E01:Kemi|T390 E01:Nia|T390 E03:Sam|T390 E05:Wale|T390 E05:Xola|T390 J01:Jide|T390 J03:Bola|T390 J10:Bola',
  'a reminder that is no longer needed (left, list added, turned off, cancelled, date moved) is cancelled as not_needed');

-- 10. AC-9, AC-10: E23 carries the join-by moment and nothing else of the exchange; E24 the budget and gift day and the reader's OWN
-- reveal flag (Tola revealed, Quin did not); neither names another person; no value but to_email holds an address; no key beyond the
-- known columns.
select ok(
  (select count(*) = 4 and bool_and(case c ->> 'template'
            when 'E23' then c ->> 'join_by_at' is not null and c ->> 'gift_day' is null and c ->> 'budget_preset' is null
                            and c ->> 'people_count' is null and c ->> 'revealed' is null and c ->> 'other_name' is null
                            and c ->> 'draw_mode' is null and c ->> 'draw_at' is null and c ->> 'note' is null and c ->> 'invite_token' is null
            when 'E24' then c ->> 'gift_day' is not null and c ->> 'budget_preset' is not null and c ->> 'join_by_at' is null
                            and c ->> 'people_count' is null and c ->> 'revealed' is not null and c ->> 'other_name' is null
                            and c ->> 'draw_mode' is null and c ->> 'draw_at' is null and c ->> 'note' is null and c ->> 'invite_token' is null
            else false end)
   from jsonb_array_elements(current_setting('test.claim1')::jsonb) c where c ->> 'exchange_name' like 'T390%')
  and (select string_agg((c ->> 'to_name') || ':' || (c ->> 'revealed'), '|' order by c ->> 'to_name')
       from jsonb_array_elements(current_setting('test.claim1')::jsonb) c
       where c ->> 'template' = 'E24' and c ->> 'exchange_name' like 'T390%') = 'Quin:false|Tola:true'
  and not exists (select 1 from jsonb_array_elements(current_setting('test.claim1')::jsonb) c, jsonb_object_keys(c) k
                  where k not in ('id', 'template', 'to_email', 'to_name', 'to_timezone', 'exchange_id', 'exchange_name', 'other_name',
                                  'invite_token', 'attempts', 'budget_preset', 'join_by_at', 'gift_day', 'note', 'draw_mode', 'draw_at',
                                  'people_count', 'revealed'))
  and not exists (select 1 from jsonb_array_elements(current_setting('test.claim1')::jsonb) c, jsonb_each_text(c) kv
                  where kv.key <> 'to_email' and kv.value like '%@%'),
  'E23 and E24 carry only what their boards show, E24 the reader''s own reveal flag, no other person and no other address');

-- 11. AC-10: the window across daylight-saving changes and zones (fixed dates, tested on the function tick and the claim share).
-- New York, spring forward 14 March 2027 and fall back 7 November 2027; London, spring forward 28 March 2027; Lagos has no change.
select is(
  (select format('%s|%s', (w.opens_at at time zone 'UTC')::text, (w.closes_at at time zone 'UTC')::text) from private.reminder_window(date '2027-03-15', 'America/New_York') w)
  || '/' || (select format('%s|%s', (w.opens_at at time zone 'UTC')::text, (w.closes_at at time zone 'UTC')::text) from private.reminder_window(date '2027-03-14', 'America/New_York') w)
  || '/' || (select format('%s|%s', (w.opens_at at time zone 'UTC')::text, (w.closes_at at time zone 'UTC')::text) from private.reminder_window(date '2027-11-07', 'America/New_York') w)
  || '/' || (select format('%s|%s', (w.opens_at at time zone 'UTC')::text, (w.closes_at at time zone 'UTC')::text) from private.reminder_window(date '2027-11-08', 'America/New_York') w)
  || '/' || (select format('%s|%s', (w.opens_at at time zone 'UTC')::text, (w.closes_at at time zone 'UTC')::text) from private.reminder_window(date '2027-03-29', 'Europe/London') w)
  || '/' || (select format('%s|%s', (w.opens_at at time zone 'UTC')::text, (w.closes_at at time zone 'UTC')::text) from private.reminder_window(date '2027-06-10', 'Africa/Lagos') w),
  '2027-03-14 13:00:00|2027-03-15 04:00:00'
  || '/2027-03-13 14:00:00|2027-03-14 05:00:00'
  || '/2027-11-06 13:00:00|2027-11-07 04:00:00'
  || '/2027-11-07 14:00:00|2027-11-08 05:00:00'
  || '/2027-03-28 08:00:00|2027-03-28 23:00:00'
  || '/2027-06-09 08:00:00|2027-06-09 23:00:00',
  'the event window is 9:00 the day before to midnight at the start of the gift day in the zone, across daylight-saving changes');

-- 12. The writer honours each reminder toggle by itself (the row is due tomorrow, so no run or claim sees it): Eze has the join-by
-- reminder off, Lola the event reminder off, Bola has both on.
do $fx$ begin
  perform set_config('test.direct', coalesce(private.enqueue_email('E23', pg_temp.u(5), null, current_setting('test.j01')::uuid, null, null, 'T390-direct-1', now() + interval '1 day')::text, '-')
    || '/' || (private.enqueue_email('E23', pg_temp.u(2), null, current_setting('test.j01')::uuid, null, null, 'T390-direct-2', now() + interval '1 day') is not null)::text
    || '/' || coalesce(private.enqueue_email('E24', pg_temp.u(12), null, current_setting('test.e01')::uuid, null, null, 'T390-direct-3', now() + interval '1 day')::text, '-')
    || '/' || (private.enqueue_email('E24', pg_temp.u(2), null, current_setting('test.e01')::uuid, null, null, 'T390-direct-4', now() + interval '1 day') is not null)::text, true);
end $fx$;
select is(
  current_setting('test.direct')
  || '/' || (select count(*)::text from private.email_outbox where dedupe_key like 'T390-direct-%'),
  '-/true/-/true/2', 'E23 and E24 are not queued for a person who turned that reminder off, and are for one who did not');

-- 13-14. AC-6: bounded work. 510 people with no list are in an exchange whose join-by is in 10 hours. One run queues at most 500
-- reminders, the next the last 10, the one after that none; every person gets one reminder and one event.
do $fx$ begin
  update public.exchanges set cancelled_at = now() where name like 'T390%' and cancelled_at is null;
  perform pg_temp.mk_user(pg_temp.u(n), 'u390-' || n || '@example.test', jsonb_build_object('first_name', 'Bulk'))
    from generate_series(100, 609) n;
  perform set_config('test.bulk', pg_temp.mkx('T390 BULK', pg_temp.u(1), 'organiser_chooses', now() + interval '10 hours', current_date + 10)::text, true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.bulk')::uuid, pg_temp.u(n), true, now() - interval '30 days' from generate_series(100, 609) n;
end $fx$;
do $fx$ begin
  perform set_config('test.b1', pg_temp.tickrow(), true);
end $fx$;
select is(current_setting('test.b1'), 'true/0/0/500/0', 'one run queues at most 500 reminders');
do $fx$ begin
  perform set_config('test.b2', pg_temp.tickrow(), true);
  perform set_config('test.b3', pg_temp.tickrow(), true);
end $fx$;
select is(
  current_setting('test.b2') || '|' || current_setting('test.b3')
  || '|' || (select count(*)::text from private.email_outbox where template = 'E23' and exchange_id = current_setting('test.bulk')::uuid)
  || '|' || (select count(distinct recipient_user_id)::text from private.email_outbox where template = 'E23' and exchange_id = current_setting('test.bulk')::uuid)
  || '|' || (select count(*)::text from public.activity_events where kind = 'join_by_reminder' and exchange_id = current_setting('test.bulk')::uuid),
  'true/0/0/10/0|true/0/0/0/0|510|510|510', 'the next run queues the last 10, the one after nothing, and each person has one reminder and one event');

select * from finish();
rollback;
