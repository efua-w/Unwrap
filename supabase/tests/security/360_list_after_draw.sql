-- 360_list_after_draw — slice 11 (GC-010 the exchange list after the draw; plan implementation-plan slice 11; owner decisions
-- 2026-11-23 Q1, Q5, Q7 in docs/tasks/slice-11.md).
-- Covers: before the draw attach_wishlist and use_exchange_ideas behave exactly as slice 5 (test 180) expects: anything can be
-- attached or switched while the exchange is open or joining has closed; after the draw (drawn) and after the gift day
-- (event_passed) they work ONLY when nothing is attached, where "nothing" is what the giver would read as list state none (no
-- list, or an ideas list with no live items); with something attached (a personal list, an ideas list with items, a kept
-- list) they are refused with P0002 and the hint attached; complete and cancelled refuse both as before. detach_wishlist is
-- new: a member who takes part removes their PERSONAL list from the exchange after the draw (drawn and event_passed only);
-- an ideas list is refused (22023, hint ideas, Q7), a kept list is refused (22023, hint kept), nothing attached, a non-member
-- and a complete or cancelled exchange are P0002, a visitor is refused outright, and before the draw it is refused too; the
-- list itself, its items and the giver's marks are untouched by a detach, and attaching the same list again (Undo) puts
-- everything back.
-- D is drawn (assignments written directly; the draw is covered by 310): Ada organises and takes part. O is a separate open
-- exchange (Femi organises) for the before-the-draw checks.
-- Self-contained: creates its own users inside the transaction (needs the migrations through recipient_list_and_marks
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T360" because dev holds other data.
-- Written BEFORE the recipient_list_and_marks migration: until it is applied the first statement that names detach_wishlist
-- fails and the run stops. That is the expected "red".
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

-- hint_as runs a statement as a signed-in persona: 'ok', or 'err:<SQLSTATE>/<hint>' (hint empty when there is none).
create function pg_temp.hint_as(who uuid, stmt text) returns text
language plpgsql as $$
declare
  h text;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
  begin
    execute stmt;
    reset role;
    return 'ok';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    reset role;
    return 'err:' || sqlstate || '/' || coalesce(h, '');
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

-- u(n) is persona n: 1 Ada (organiser of D, takes part), 2 Bola (member of D and O), 3 Chi, 4 Dayo, 5 Eze (members of D),
-- 6 Mo (outsider), 7 Femi (organiser of O).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('36' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

create function pg_temp.mid(ex text, nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = ex::uuid and p.display_name = nm and m.state = 'active'
$$;

-- The attached list of a person in an exchange, as the migration role.
create function pg_temp.attached(ex text, uid uuid) returns uuid
language sql as $$
  select m.attached_wishlist_id from public.exchange_members m where m.exchange_id = ex::uuid and m.user_id = uid and m.state = 'active'
$$;

create function pg_temp.wl(nm text) returns uuid
language sql as $$
  select w.id from public.wishlists w where w.name = nm
$$;

create function pg_temp.item(nm text) returns uuid
language sql as $$
  select i.id from public.wishlist_items i where i.name = nm
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u360-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Mo', 'Femi'])[i]))
  from generate_series(1, 7) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T360 Drawn'));
  perform pg_temp.try_as(pg_temp.u(7), pg_temp.mk('T360 Open'));
  -- WHY a guard: try_as swallows errors, so a failed create would otherwise show only as a uuid error much later.
  if (select count(*) from public.exchanges where name in ('T360 Drawn', 'T360 Open')) <> 2 then
    raise exception 'T360 fixture: exchanges not created';
  end if;
end $fx$;

-- Members and the ring in D (Ada to Bola to Chi to Dayo to Eze to Ada), written as the migration role.
do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_d', (select id::text from public.exchanges where name = 'T360 Drawn'), true);
  perform set_config('test.ex_o', (select id::text from public.exchanges where name = 'T360 Open'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_d')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3, 4, 5]) n;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_o')::uuid, pg_temp.u(2), true, now() - interval '5 days');
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind) values
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Ada'), pg_temp.mid(current_setting('test.ex_d'), 'Bola'), 1, 'full'),
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Bola'), pg_temp.mid(current_setting('test.ex_d'), 'Chi'), 1, 'full'),
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Chi'), pg_temp.mid(current_setting('test.ex_d'), 'Dayo'), 1, 'full'),
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Dayo'), pg_temp.mid(current_setting('test.ex_d'), 'Eze'), 1, 'full'),
    (current_setting('test.ex_d')::uuid, pg_temp.mid(current_setting('test.ex_d'), 'Eze'), pg_temp.mid(current_setting('test.ex_d'), 'Ada'), 1, 'full');
  if private.exchange_status(current_setting('test.ex_d')::uuid) <> 'drawn'
     or private.exchange_status(current_setting('test.ex_o')::uuid) <> 'open' then
    raise exception 'T360 fixture: D must read drawn and O open';
  end if;
end $fx$;

-- Personal lists, written as the migration role. Bola L1 (two items) and L2; Chi LC; Dayo LD; Eze LE and LE2.
do $fx$
declare
  v_l1 uuid;
begin
  insert into public.wishlists (owner_id, name) values (pg_temp.u(2), 'T360 L1') returning id into v_l1;
  insert into public.wishlists (owner_id, name) values
    (pg_temp.u(2), 'T360 L2'), (pg_temp.u(3), 'T360 LC'), (pg_temp.u(4), 'T360 LD'), (pg_temp.u(5), 'T360 LE'), (pg_temp.u(5), 'T360 LE2');
  insert into public.wishlist_items (wishlist_id, name, priority) values
    (v_l1, 'T360 X', 'most_wanted'), (v_l1, 'T360 Y', 'nice_to_have');
  if (select count(*) from public.wishlists where name like 'T360 L%') <> 6 then
    raise exception 'T360 fixture: six lists expected';
  end if;
end $fx$;

-- 1. The three list functions are SECURITY DEFINER with an empty search_path, one signature each.
select ok(
  (select count(*) = 3 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('attach_wishlist', 'use_exchange_ideas', 'detach_wishlist')),
  'attach_wishlist, use_exchange_ideas and detach_wishlist are SECURITY DEFINER with an empty search_path, one signature each');

-- 2. Closed to anon, open to signed-in people.
select ok(
  not has_function_privilege('anon', 'public.attach_wishlist(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.use_exchange_ideas(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.detach_wishlist(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.attach_wishlist(uuid,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.use_exchange_ideas(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.detach_wishlist(uuid)', 'execute'),
  'anon cannot execute any list function and signed-in people can');

-- 3. The shapes: the replaced functions keep their signature and result; detach takes the exchange only and returns nothing.
select is(
  (select proargnames::text from pg_proc where oid = 'public.detach_wishlist(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.detach_wishlist(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.attach_wishlist(uuid,uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.use_exchange_ideas(uuid)'::regprocedure),
  '{p_exchange}/void/void/uuid', 'detach_wishlist takes the exchange only and the replaced functions keep their results');

-- 4. Before the draw (O is open) nothing changed: a list can be attached, switched, replaced by ideas and attached again.
select is(
  pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_o'), pg_temp.wl('T360 L1')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_o'), pg_temp.wl('T360 L2')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_o')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_o'), pg_temp.wl('T360 L1'))),
  'ok/ok/ok/ok', 'before the draw a list can be attached, switched and replaced freely, as in slice 5');

-- 5. Before the draw there is nothing to remove yet: detach is refused (P0002) and the attached list stays.
select is(
  pg_temp.hint_as(pg_temp.u(2), format('select public.detach_wishlist(%L)', current_setting('test.ex_o')))
  || '/' || (pg_temp.attached(current_setting('test.ex_o'), pg_temp.u(2)) = pg_temp.wl('T360 L1'))::text,
  'err:P0002//true', 'detach is refused before the draw and the attached list is unchanged');

-- 6. Once joining has closed (still before the draw) attaching and ideas still work.
do $fx$ begin
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_o')::uuid;
  if private.exchange_status(current_setting('test.ex_o')::uuid) <> 'joining_closed' then
    raise exception 'T360 fixture: O should read joining_closed';
  end if;
end $fx$;
select is(
  pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_o'), pg_temp.wl('T360 L2')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_o'))),
  'ok/ok', 'once joining has closed, attaching and ideas still work before the draw');

-- 7. After the draw: a member with nothing attached can attach a personal list.
do $fx$ begin
  perform set_config('test.t7', pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 L1'))), true);
end $fx$;
select is(
  current_setting('test.t7') || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) = pg_temp.wl('T360 L1'))::text,
  'ok/true', 'after the draw a member with nothing attached can attach a list');

-- 8. After the draw a member with something attached cannot change it: attach and ideas are refused (P0002, hint attached).
select is(
  pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 L2')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_d')))
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) = pg_temp.wl('T360 L1'))::text,
  'err:P0002/attached/err:P0002/attached/true', 'after the draw switching a list that is attached is refused, and the list stays');

-- 9. After the draw a member with nothing attached can start their ideas list and add an item to it.
do $fx$
declare
  v_ideas uuid;
begin
  perform set_config('test.t9a', pg_temp.hint_as(pg_temp.u(3), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_d'))), true);
  select w.id into v_ideas from public.wishlists w
    where w.owner_id = pg_temp.u(3) and w.kind = 'exchange_ideas' and w.exchange_id = current_setting('test.ex_d')::uuid;
  perform set_config('test.ideas_chi', v_ideas::text, true);
  perform set_config('test.t9b', pg_temp.hint_as(pg_temp.u(3),
    format($q$insert into public.wishlist_items (wishlist_id, name, priority) values (%L, 'T360 Idea', 'nice_to_have')$q$, v_ideas)), true);
end $fx$;
select is(
  current_setting('test.t9a') || '/' || current_setting('test.t9b')
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(3)) = current_setting('test.ideas_chi')::uuid)::text,
  'ok/ok/true', 'after the draw a member with nothing attached can start ideas and add an item');

-- 10. An ideas list WITH items counts as something attached: a personal list cannot replace it.
select is(
  pg_temp.hint_as(pg_temp.u(3), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 LC')))
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(3)) = current_setting('test.ideas_chi')::uuid)::text,
  'err:P0002/attached/true', 'after the draw an ideas list with items cannot be replaced by a personal list');

-- 11. Once the ideas are removed one by one the list reads as nothing, and a personal list can be attached.
do $fx$ begin
  perform set_config('test.t11a', pg_temp.hint_as(pg_temp.u(3), format('select public.remove_wishlist_item(%L)', pg_temp.item('T360 Idea'))), true);
  perform set_config('test.t11b', pg_temp.hint_as(pg_temp.u(3), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 LC'))), true);
end $fx$;
select is(
  current_setting('test.t11a') || '/' || current_setting('test.t11b')
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(3)) = pg_temp.wl('T360 LC'))::text,
  'ok/ok/true', 'after the draw an ideas list with no live items counts as nothing and a personal list can be attached');

-- 12. Q7: an ideas list cannot be removed with Remove wishlist (22023, hint ideas); its items go one by one.
do $fx$ begin
  perform set_config('test.t12a', pg_temp.hint_as(pg_temp.u(4), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_d'))), true);
  perform set_config('test.t12b', pg_temp.hint_as(pg_temp.u(4), format('select public.detach_wishlist(%L)', current_setting('test.ex_d'))), true);
end $fx$;
select is(
  current_setting('test.t12a') || '/' || current_setting('test.t12b')
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(4)) is not null)::text,
  'ok/err:22023/ideas/true', 'an ideas list cannot be detached and stays attached');

-- 13. A kept list (the attached list was deleted) cannot be detached (22023, hint kept) and still counts as attached.
do $fx$ begin
  perform set_config('test.t13a', pg_temp.hint_as(pg_temp.u(5), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 LE'))), true);
  perform set_config('test.t13b', pg_temp.hint_as(pg_temp.u(5), format('select public.delete_wishlist(%L)', pg_temp.wl('T360 LE'))), true);
end $fx$;
select is(
  current_setting('test.t13a') || '/' || current_setting('test.t13b')
  || '/' || pg_temp.hint_as(pg_temp.u(5), format('select public.detach_wishlist(%L)', current_setting('test.ex_d')))
  || '/' || pg_temp.hint_as(pg_temp.u(5), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 LE2')))
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(5)) = pg_temp.wl('T360 LE'))::text,
  'ok/ok/err:22023/kept/err:P0002/attached/true', 'a kept list cannot be detached or replaced, and stays attached');

-- 14. Nothing attached: detach is "not found" (Ada, the organiser who takes part, has attached nothing).
select is(
  pg_temp.hint_as(pg_temp.u(1), format('select public.detach_wishlist(%L)', current_setting('test.ex_d'))),
  'err:P0002/', 'detach with nothing attached is not found');

-- 15. A non-member is "not found"; a visitor is refused outright.
select is(
  pg_temp.hint_as(pg_temp.u(6), format('select public.detach_wishlist(%L)', current_setting('test.ex_d')))
  || '/' || pg_temp.try_as(null, format('select public.detach_wishlist(%L)', current_setting('test.ex_d'))),
  'err:P0002//err:42501', 'detach is "not found" for an outsider and refused (42501) for a visitor');

-- 16. Detach (Q7, personal list): the list stays and keeps its items, and the giver's mark is kept. Ada gives to Bola and has
-- marked X as got; the mark is written directly (the function that writes it is covered by 350).
do $fx$ begin
  insert into private.gift_marks (assignment_id, item_id)
    select a.id, pg_temp.item('T360 X') from private.assignments a
    where a.giver_member_id = pg_temp.mid(current_setting('test.ex_d'), 'Ada') and a.superseded_at is null;
  perform set_config('test.t16', pg_temp.hint_as(pg_temp.u(2), format('select public.detach_wishlist(%L)', current_setting('test.ex_d'))), true);
end $fx$;
select is(
  current_setting('test.t16')
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) is null)::text
  || '/' || (select (w.deleted_at is null)::text from public.wishlists w where w.id = pg_temp.wl('T360 L1'))
  || '/' || (select count(*)::text from public.wishlist_items i where i.wishlist_id = pg_temp.wl('T360 L1') and i.deleted_at is null)
  || '/' || (select count(*)::text from private.gift_marks gm where gm.assignment_id in (select a.id from private.assignments a where a.exchange_id = current_setting('test.ex_d')::uuid)),
  'ok/true/true/2/1', 'detaching a personal list keeps the list, its items and the giver''s mark');

-- 17. Undo is attaching the same list again: it is attached, and the mark is still the one mark.
do $fx$ begin
  perform set_config('test.t17', pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 L1'))), true);
end $fx$;
select is(
  current_setting('test.t17')
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) = pg_temp.wl('T360 L1'))::text
  || '/' || (select count(*)::text from private.gift_marks gm where gm.assignment_id in (select a.id from private.assignments a where a.exchange_id = current_setting('test.ex_d')::uuid)),
  'ok/true/1', 'attaching the list again restores it and the mark is still there');

-- 18. After the gift day (event_passed): the same rule. Bola (L1 attached) cannot switch; Dayo (an empty ideas list, so nothing)
-- can attach.
do $fx$ begin
  update public.exchanges set join_by_at = now() - interval '3 days',
    gift_day = (now() at time zone 'Africa/Lagos')::date - 1
    where id = current_setting('test.ex_d')::uuid;
  if private.exchange_status(current_setting('test.ex_d')::uuid) <> 'event_passed' then
    raise exception 'T360 fixture: D should read event_passed';
  end if;
  perform set_config('test.t18a', pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 L2'))), true);
  perform set_config('test.t18b', pg_temp.hint_as(pg_temp.u(4), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 LD'))), true);
end $fx$;
select is(
  current_setting('test.t18a') || '/' || current_setting('test.t18b')
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(4)) = pg_temp.wl('T360 LD'))::text,
  'err:P0002/attached/ok/true', 'after the gift day attaching works only when nothing is attached');

-- 19. After the gift day Remove wishlist still works.
do $fx$ begin
  perform set_config('test.t19', pg_temp.hint_as(pg_temp.u(2), format('select public.detach_wishlist(%L)', current_setting('test.ex_d'))), true);
end $fx$;
select is(
  current_setting('test.t19') || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) is null)::text,
  'ok/true', 'after the gift day a personal list can still be detached');

-- 20. Complete: attach, ideas and detach are all "not found" and nothing changes (Bola has nothing attached, Chi has LC).
do $fx$ begin
  update public.exchanges set completed_at = now() where id = current_setting('test.ex_d')::uuid;
  if private.exchange_status(current_setting('test.ex_d')::uuid) <> 'complete' then
    raise exception 'T360 fixture: D should read complete';
  end if;
end $fx$;
select is(
  pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 L1')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_d')))
  || '/' || pg_temp.hint_as(pg_temp.u(3), format('select public.detach_wishlist(%L)', current_setting('test.ex_d')))
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) is null)::text
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(3)) = pg_temp.wl('T360 LC'))::text,
  'err:P0002//err:P0002//err:P0002//true/true', 'a complete exchange refuses attach, ideas and detach, and nothing changes');

-- 21. Cancelled: the same.
do $fx$ begin
  update public.exchanges set completed_at = null, cancelled_at = now() where id = current_setting('test.ex_d')::uuid;
  if private.exchange_status(current_setting('test.ex_d')::uuid) <> 'cancelled' then
    raise exception 'T360 fixture: D should read cancelled';
  end if;
end $fx$;
select is(
  pg_temp.hint_as(pg_temp.u(2), format('select public.attach_wishlist(%L, %L)', current_setting('test.ex_d'), pg_temp.wl('T360 L1')))
  || '/' || pg_temp.hint_as(pg_temp.u(2), format('select public.use_exchange_ideas(%L)', current_setting('test.ex_d')))
  || '/' || pg_temp.hint_as(pg_temp.u(3), format('select public.detach_wishlist(%L)', current_setting('test.ex_d')))
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(2)) is null)::text
  || '/' || (pg_temp.attached(current_setting('test.ex_d'), pg_temp.u(3)) = pg_temp.wl('T360 LC'))::text,
  'err:P0002//err:P0002//err:P0002//true/true', 'a cancelled exchange refuses attach, ideas and detach, and nothing changes');

select * from finish();
rollback;
