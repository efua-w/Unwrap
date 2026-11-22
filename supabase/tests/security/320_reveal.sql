-- 320_reveal — slice 10 (GC-014 reveal, GC-013 exchange page after the draw; plan §5, §6 invariants 1, 2, 4, 5, 12; owner
-- decisions 2026-11-22 Q1e, Q7, Q9 in docs/tasks/slice-10.md).
-- Covers (AC-5, AC-13): get_my_assignment returns the giver's own row id and whether it was revealed, never a name;
-- mark_assignment_revealed stamps revealed_at once and keeps the first time on every later call, for the caller's own row
-- only (anyone else gets P0002); get_my_recipient returns the person the caller gives to BEFORE and after the reveal (the page
-- loads it before the tap, GC-014) with up to three Most wanted items, recently changed first, each as an opaque reference
-- (md5 of the row's salt and the item id) with a name and a price, and never a list name, a link, a note, a raw item id or
-- a reservation; the list state says none, empty or items; only CURRENT rows count (a superseded row reads as nothing and
-- a new row reads as its own, with a new salt); get_draw_summary gives the organiser counts and a time and no pair.
-- The rows are written directly (the draw is covered by 310) so each giver and receiver is known in advance:
-- Ada gives to Bola, Bola to Chi, Chi to Dayo, Dayo to Ada.
-- Self-contained: creates its own users inside the transaction (needs the migrations through the draw_and_reveal one
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T320" because dev holds other data.
-- Written BEFORE the draw_and_reveal migration: until it is applied the first statement that names private.assignments
-- fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 17", "1..17", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

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

create function pg_temp.mk(p_name text) returns text
language sql as $$
  select format('select public.create_exchange(%L, null, %L, current_date + 10, %L, %L, current_date + 20, %L, true, false)',
    p_name, '10k_20k', 'organiser_chooses', '18:00', 'Africa/Lagos')
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

-- u(n) is persona n: 1 Ada (organiser, takes part), 2 Bola, 3 Chi, 4 Dayo (members), 5 Mo (outsider).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('32' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.mid(nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = current_setting('test.ex_p')::uuid and p.display_name = nm and m.state = 'active'
$$;

-- The current assignment id of a giver, by first name.
create function pg_temp.aid(nm text) returns uuid
language sql as $$
  select a.id from private.assignments a where a.giver_member_id = pg_temp.mid(nm) and a.superseded_at is null
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u320-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Mo'])[i]))
  from generate_series(1, 5) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T320 Reveal'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T320 Reveal'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3, 4]) n;
  update public.profiles set avatar_path = 'T320/chi.jpg' where id = pg_temp.u(3);

  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Ada'), pg_temp.mid('Bola'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Bola'), pg_temp.mid('Chi'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Chi'), pg_temp.mid('Dayo'), 1, 'full'),
    (current_setting('test.ex_p')::uuid, pg_temp.mid('Dayo'), pg_temp.mid('Ada'), 1, 'full');
end $fx$;

-- Lists. Chi: four Most wanted (A oldest to D newest), one deleted Most wanted (newest of all), one Nice to have, all with
-- a link and a note that must never leave. Bola: Nice to have only. Ada: an empty personal list. Dayo: nothing attached.
do $fx$
declare
  v_chi uuid;
  v_bola uuid;
  v_ada uuid;
begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(3), 'T320 Chi secret list name') returning id into v_chi;
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T320 Bola list') returning id into v_bola;
  insert into public.wishlists (owner_id, name) values (pg_temp.u(1), 'T320 Ada list') returning id into v_ada;
  insert into public.wishlist_items (wishlist_id, name, price_kobo, priority, link, note, updated_at, deleted_at) values
    (v_chi, 'T320 Item A', 1000000, 'most_wanted', 'https://example.test/a', 'note a', now() - interval '4 days', null),
    (v_chi, 'T320 Item B', 2000000, 'most_wanted', 'https://example.test/b', 'note b', now() - interval '3 days', null),
    (v_chi, 'T320 Item C', null, 'most_wanted', 'https://example.test/c', 'note c', now() - interval '2 days', null),
    (v_chi, 'T320 Item D', 4000000, 'most_wanted', 'https://example.test/d', 'note d', now() - interval '1 day', null),
    (v_chi, 'T320 Item E gone', 5000000, 'most_wanted', null, null, now(), now()),
    (v_chi, 'T320 Item F nice', 6000000, 'nice_to_have', null, null, now() - interval '12 hours', null);
  insert into public.wishlist_items (wishlist_id, name, price_kobo, priority) values
    (v_bola, 'T320 Bola nice', 700000, 'nice_to_have');
  update public.exchange_members set attached_wishlist_id = v_chi where id = pg_temp.mid('Chi');
  update public.exchange_members set attached_wishlist_id = v_bola where id = pg_temp.mid('Bola');
  update public.exchange_members set attached_wishlist_id = v_ada where id = pg_temp.mid('Ada');
  perform set_config('test.chi_list', v_chi::text, true);
end $fx$;

-- 1. Before the tap: the giver reads their own row, not revealed, and the row is the one the owner knows. No name in it.
select is(
  pg_temp.val_as(pg_temp.u(2), format($q$(select assignment_id::text || ':' || revealed::text from public.get_my_assignment(%L))$q$, current_setting('test.ex_p'))),
  pg_temp.aid('Bola')::text || ':false', 'a giver reads their own assignment id and that it is not revealed yet');

-- 2. AC-13: reveal stamps the time once; a later call returns the first time and changes nothing.
do $fx$ begin
  perform set_config('test.rev1', pg_temp.val_as(pg_temp.u(2), format('public.mark_assignment_revealed(%L)', current_setting('test.ex_p'))), true);
  perform pg_sleep(0.05);
  perform set_config('test.rev2', pg_temp.val_as(pg_temp.u(2), format('public.mark_assignment_revealed(%L)', current_setting('test.ex_p'))), true);
end $fx$;
select is(
  (select (current_setting('test.rev1') = current_setting('test.rev2'))::text
          || '/' || (current_setting('test.rev1') not like 'err:%')::text
          || '/' || (a.revealed_at::text = current_setting('test.rev1'))::text
   from private.assignments a where a.id = pg_temp.aid('Bola')),
  'true/true/true', 'reveal stamps the time once; a second call returns the first time and changes nothing');

-- 3. After the tap the same row reads revealed, and only the caller's own row was stamped.
select is(
  pg_temp.val_as(pg_temp.u(2), format($q$(select assignment_id::text || ':' || revealed::text from public.get_my_assignment(%L))$q$, current_setting('test.ex_p')))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid and revealed_at is not null),
  pg_temp.aid('Bola')::text || ':true/1', 'the giver reads revealed; the other three rows are untouched');

-- 4. Only a giver can reveal: an outsider and a null exchange get P0002 and nothing changes; reads give zero rows.
select is(
  pg_temp.val_as(pg_temp.u(5), format('public.mark_assignment_revealed(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(5), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(2), '(select count(*) from public.get_my_recipient(null))')
  || '/' || pg_temp.val_as(pg_temp.u(2), 'public.mark_assignment_revealed(null)')
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid and revealed_at is not null),
  'err:P0002:/0/0/err:P0002:/1', 'an outsider or a null exchange cannot reveal and reads nothing');

-- 5. GC-014: the person is read BEFORE the tap (the page loads it, the tap only stamps the time). Chi has not revealed:
-- reading the recipient reveals nothing and stamps nothing. Dayo has no list attached.
select is(
  pg_temp.val_as(pg_temp.u(3), format($q$(select display_name || ':' || coalesce(avatar_path, '-') || ':' || list_state || ':' || most_wanted::text
    from public.get_my_recipient(%L))$q$, current_setting('test.ex_p')))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid and revealed_at is not null),
  'Dayo:-:none:[]/1', 'the recipient is readable before the reveal, with no list state "none", and reading stamps nothing');

-- 6. The tap changes nothing about what is read: the same answer after Chi reveals.
do $fx$ begin
  perform pg_temp.val_as(pg_temp.u(3), format('public.mark_assignment_revealed(%L)', current_setting('test.ex_p')));
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(3), format($q$(select display_name || ':' || coalesce(avatar_path, '-') || ':' || list_state || ':' || most_wanted::text
    from public.get_my_recipient(%L))$q$, current_setting('test.ex_p')))
  || '/' || (select count(*)::text from private.assignments where exchange_id = current_setting('test.ex_p')::uuid and revealed_at is not null),
  'Dayo:-:none:[]/2', 'the recipient reads the same after the reveal');

-- 7. Bola gives to Chi: the name, the photo path and a list with items; at most three Most wanted.
select is(
  pg_temp.val_as(pg_temp.u(2), format($q$(select display_name || ':' || coalesce(avatar_path, '-') || ':' || list_state || ':' || jsonb_array_length(most_wanted)::text
    from public.get_my_recipient(%L))$q$, current_setting('test.ex_p'))),
  'Chi:T320/chi.jpg:items:3', 'the giver reads the name, the photo path, a list state and at most three Most wanted items');

-- 8. Recently changed first, Most wanted only (not Nice to have, not the deleted one, not the oldest of the four), and a
-- missing price stays missing.
select is(
  pg_temp.val_as(pg_temp.u(2), format($q$(select string_agg((x ->> 'name') || '=' || coalesce(x ->> 'price_kobo', '-'), '|' order by t.o)
    from public.get_my_recipient(%L) r, jsonb_array_elements(r.most_wanted) with ordinality t(x, o))$q$, current_setting('test.ex_p'))),
  'T320 Item D=4000000|T320 Item C=-|T320 Item B=2000000', 'Most wanted items come recently changed first, three at most, with their price in kobo');

-- 9. Each item is an opaque reference and nothing else: exactly name, price_kobo and ref, and ref is md5(salt || item id).
select is(
  pg_temp.val_as(pg_temp.u(2), format($q$(select string_agg(distinct k, ',' order by k)
    from public.get_my_recipient(%L) r, jsonb_array_elements(r.most_wanted) x, jsonb_object_keys(x) k)$q$, current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format($q$(select string_agg(x ->> 'ref', '|' order by t.o)
    from public.get_my_recipient(%L) r, jsonb_array_elements(r.most_wanted) with ordinality t(x, o))$q$, current_setting('test.ex_p'))),
  'name,price_kobo,ref/' || (select string_agg(md5(a.ref_salt || i.id::text), '|' order by i.updated_at desc)
    from private.assignments a, public.wishlist_items i
    where a.id = pg_temp.aid('Bola') and i.wishlist_id = current_setting('test.chi_list')::uuid
      and i.name in ('T320 Item B', 'T320 Item C', 'T320 Item D')),
  'each item is a name, a price and a reference made from the row''s salt and the item id');

-- 10. Nothing else leaves: no list name, link, note, list id, item id or address anywhere in the answer.
do $fx$ begin
  perform set_config('test.recip_json', pg_temp.val_as(pg_temp.u(2), format('(select to_jsonb(r) from public.get_my_recipient(%L) r)', current_setting('test.ex_p'))), true);
end $fx$;
select ok(
  current_setting('test.recip_json') not like 'err:%'
  and current_setting('test.recip_json') not ilike '%secret list name%'
  and current_setting('test.recip_json') not like '%example.test%'
  and current_setting('test.recip_json') not like '%note %'
  and current_setting('test.recip_json') not like '%' || current_setting('test.chi_list') || '%'
  and not exists (select 1 from public.wishlist_items i where current_setting('test.recip_json') like '%' || i.id::text || '%')
  and not exists (select 1 from public.exchange_members m where current_setting('test.recip_json') like '%' || m.id::text || '%')
  and not exists (select 1 from auth.users u where current_setting('test.recip_json') like '%' || u.id::text || '%'),
  'the recipient answer holds no list name, link, note, list id, item id, member id or person id');

-- 11. A list with only Nice to have items is "items" with nothing Most wanted (the section is hidden); an empty list is
-- "empty".
select is(
  pg_temp.val_as(pg_temp.u(1), format($q$(select display_name || ':' || list_state || ':' || jsonb_array_length(most_wanted)::text
    from public.get_my_recipient(%L))$q$, current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(4), format($q$(select display_name || ':' || list_state || ':' || jsonb_array_length(most_wanted)::text
    from public.get_my_recipient(%L))$q$, current_setting('test.ex_p'))),
  'Bola:items:0/Ada:empty:0', 'a list of Nice to have items reads items with no Most wanted; an empty list reads empty');

-- 12. The organiser's summary is counts and a time only: four people, a time, no email queued here (the rows were written
-- directly); a member reads nothing.
select is(
  pg_temp.val_as(pg_temp.u(1), format($q$(select people_count::text || ':' || (drawn_at is not null)::text || ':' || emails_queued::text
    from public.get_draw_summary(%L))$q$, current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(2), format('(select count(*) from public.get_draw_summary(%L))', current_setting('test.ex_p'))),
  '4:true:0/0', 'the organiser reads the people count and the time; a member reads nothing');

-- 13. WHY a source check: the giver functions never touch a reservation, and the assignment read never joins a profile (it
-- cannot return a name).
select ok(
  (select bool_and(p.prosrc not ilike '%reserv%')
   from pg_proc p where p.oid in ('public.get_my_assignment(uuid)'::regprocedure, 'public.get_my_recipient(uuid)'::regprocedure,
     'public.mark_assignment_revealed(uuid)'::regprocedure, 'public.get_draw_summary(uuid)'::regprocedure))
  and (select p.prosrc not ilike '%profiles%' and p.prosrc not ilike '%display_name%'
       from pg_proc p where p.oid = 'public.get_my_assignment(uuid)'::regprocedure)
  and (select p.prosrc not ilike '%profiles%' and p.prosrc not ilike '%receiver%'
       from pg_proc p where p.oid = 'public.get_draw_summary(uuid)'::regprocedure),
  'the giver and summary functions read no reservation, and the assignment read and the summary join no profile and no receiver');

-- 14-15. Only CURRENT rows count. Dayo's row is superseded and a new one written to Chi (a re-match, slice 14): Dayo
-- reads the new id, unrevealed, and the new person; the new row has its own salt, so the same items get new references.
do $fx$ begin
  perform set_config('test.old_dayo', pg_temp.aid('Dayo')::text, true);
  perform set_config('test.refs_bola', pg_temp.val_as(pg_temp.u(2), format($q$(select string_agg(x ->> 'ref', '|' order by t.o)
    from public.get_my_recipient(%L) r, jsonb_array_elements(r.most_wanted) with ordinality t(x, o))$q$, current_setting('test.ex_p'))), true);
  update private.assignments set superseded_at = now() where id = current_setting('test.old_dayo')::uuid;
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind)
    values (current_setting('test.ex_p')::uuid, pg_temp.mid('Dayo'), pg_temp.mid('Chi'), 2, 'rematch');
  perform set_config('test.refs_dayo', pg_temp.val_as(pg_temp.u(4), format($q$(select string_agg(x ->> 'ref', '|' order by t.o)
    from public.get_my_recipient(%L) r, jsonb_array_elements(r.most_wanted) with ordinality t(x, o))$q$, current_setting('test.ex_p'))), true);
  perform set_config('test.refs_bola2', pg_temp.val_as(pg_temp.u(2), format($q$(select string_agg(x ->> 'ref', '|' order by t.o)
    from public.get_my_recipient(%L) r, jsonb_array_elements(r.most_wanted) with ordinality t(x, o))$q$, current_setting('test.ex_p'))), true);
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(4), format($q$(select (assignment_id = %L)::text || ':' || (assignment_id <> %L)::text || ':' || revealed::text
    from public.get_my_assignment(%L))$q$, pg_temp.aid('Dayo'), current_setting('test.old_dayo'), current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(4), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(4), format('(select display_name from public.get_my_recipient(%L))', current_setting('test.ex_p'))),
  'true:true:false/1/Chi', 'a superseded row reads as nothing and the new row reads as its own, unrevealed');
select ok(
  current_setting('test.refs_bola') = current_setting('test.refs_bola2')
  and current_setting('test.refs_bola') not like 'err:%' and current_setting('test.refs_dayo') not like 'err:%'
  and (select count(*) = 3 from unnest(string_to_array(current_setting('test.refs_dayo'), '|')))
  and not exists (
    select 1 from unnest(string_to_array(current_setting('test.refs_bola'), '|')) x
    join unnest(string_to_array(current_setting('test.refs_dayo'), '|')) y on x = y),
  'the same items get the same references for one giver on every read and different references for another giver');

-- 16. A giver whose only row is superseded (nothing replaces it) reads nothing and cannot reveal.
do $fx$ begin
  update private.assignments set superseded_at = now() where id = pg_temp.aid('Chi');
end $fx$;
select is(
  pg_temp.val_as(pg_temp.u(3), format('(select count(*) from public.get_my_assignment(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(3), format('(select count(*) from public.get_my_recipient(%L))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(3), format('public.mark_assignment_revealed(%L)', current_setting('test.ex_p'))),
  '0/0/err:P0002:', 'a giver with no current row reads nothing and cannot reveal');

-- 17. The summary counts current rows only: Chi's superseded row is out, Dayo's new one is in.
select is(
  pg_temp.val_as(pg_temp.u(1), format($q$(select people_count::text from public.get_draw_summary(%L))$q$, current_setting('test.ex_p'))),
  '3', 'the summary counts current assignments only');

select * from finish();
rollback;
