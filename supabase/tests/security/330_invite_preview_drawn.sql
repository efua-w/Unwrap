-- 330_invite_preview_drawn — slice 10 round 3 (GCO-012, GC-002; owner decision 2026-11-22 Q2, review finding R1-1).
-- Covers: after an early draw the invite preview's closed_at is the DRAW moment (the earliest created_at among the
-- exchange's current assignments), never the future join-by date; an exchange whose joining simply closed still reports
-- join-by as before; an open exchange reports none; the preview carries exactly the same keys as before, so no pair, giver
-- or member appears in it; the private helper that reads the draw moment is closed to anon and signed-in people.
-- Self-contained: creates its own users inside the transaction (needs the migrations through invite_preview_drawn
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T330" because dev holds other data.
-- Written BEFORE the invite_preview_drawn migration: until it is applied, assertions 1, 3, 4, 5 and 9 fail. That is the
-- expected "red".
-- Pass: "ok 1".."ok 9", "1..9", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

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

-- u(n) is persona n: 1 Ada (organiser of D, takes part), 2 Bola, 3 Chi (members of D), 4 Gbemi (organiser of C, joining
-- closed, not drawn), 5 Lola (organiser of O, still open).
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('33' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- preview(token) reads the invite preview as a visitor and keeps it as text.
create function pg_temp.preview(tok text) returns jsonb
language plpgsql as $$
declare
  v jsonb;
begin
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';
  begin
    select public.get_invite_preview(tok) into v;
  exception when others then
    reset role;
    raise;
  end;
  reset role;
  return v;
end $$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u330-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Gbemi', 'Lola'])[i]))
  from generate_series(1, 5) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T330 Drawn', true));
  perform pg_temp.try_as(pg_temp.u(4), pg_temp.mk('T330 Closed', false));
  perform pg_temp.try_as(pg_temp.u(5), pg_temp.mk('T330 Open', false));
  -- WHY a guard: try_as swallows errors, so a failed create would otherwise show only as a uuid error much later.
  if (select count(*) from public.exchanges where name in ('T330 Drawn', 'T330 Closed', 'T330 Open')) <> 3 then
    raise exception 'T330 fixture: exchanges not created';
  end if;
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_d', (select id::text from public.exchanges where name = 'T330 Drawn'), true);
  perform set_config('test.ex_c', (select id::text from public.exchanges where name = 'T330 Closed'), true);
  perform set_config('test.ex_o', (select id::text from public.exchanges where name = 'T330 Open'), true);
  perform set_config('test.tok_d', (select invite_token from public.exchanges where name = 'T330 Drawn'), true);
  perform set_config('test.tok_c', (select invite_token from public.exchanges where name = 'T330 Closed'), true);
  perform set_config('test.tok_o', (select invite_token from public.exchanges where name = 'T330 Open'), true);
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_d')::uuid, pg_temp.u(n), true, now() - make_interval(days => 5 - n) from unnest(array[2, 3]) n;
  -- C closed joining an hour ago and was never drawn. D and O keep join-by ten days ahead.
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_c')::uuid;
  -- WHY: mk always asks for approval, which makes the preview status 'approval'. O must be a plain open exchange.
  update public.exchanges set approval_required = false where id = current_setting('test.ex_o')::uuid;
end $fx$;

-- The draw happens before join-by (owner decision Q2), in its own block after the members exist.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), format('select * from public.draw_names(%L)', current_setting('test.ex_d')));
  -- WHY a guard: try_as swallows errors; without it a failed draw would make every assertion below meaningless.
  if (select count(*) from private.assignments where exchange_id = current_setting('test.ex_d')::uuid and superseded_at is null) <> 3 then
    raise exception 'T330 fixture: draw did not write three assignments';
  end if;
end $fx$;

-- 1. The private helper that reads the draw moment is SECURITY DEFINER with an empty search_path and closed to everyone
-- but the owner. WHY: assignments are never readable; only this moment leaves the table.
select ok(
  (select count(*) = 1 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace and p.proname = 'exchange_drawn_at')
  and not has_function_privilege('anon', 'private.exchange_drawn_at(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.exchange_drawn_at(uuid)', 'execute'),
  'exchange_drawn_at is SECURITY DEFINER with an empty search_path and closed to anon and signed-in people');

-- 2. A drawn exchange previews as closed, to a visitor.
select is(
  pg_temp.preview(current_setting('test.tok_d')) ->> 'status',
  'closed', 'a drawn exchange previews as closed to a visitor');

-- 3. Its closed_at is the draw moment, the earliest current assignment.
select is(
  (pg_temp.preview(current_setting('test.tok_d')) ->> 'closed_at')::timestamptz,
  (select min(a.created_at) from private.assignments a
    where a.exchange_id = current_setting('test.ex_d')::uuid and a.superseded_at is null),
  'closed_at of a drawn exchange is the draw moment');

-- 4. And it is before the future join-by date, which is no longer what the page says.
select ok(
  (pg_temp.preview(current_setting('test.tok_d')) ->> 'closed_at')::timestamptz
    < (select e.join_by_at from public.exchanges e where e.id = current_setting('test.ex_d')::uuid),
  'closed_at of a drawn exchange is earlier than its join-by date');

-- 5. The preview keeps exactly the same keys, so it carries no pair, giver, member or assignment.
select is(
  (select string_agg(k, ',' order by k collate "C") from jsonb_object_keys(pg_temp.preview(current_setting('test.tok_d'))) k),
  'budget_preset,can_ask,cancelled_at,closed_at,draw_at,draw_mode,exchange_name,gift_day,inviter_name,join_by_at,joined_count,status,tint',
  'the drawn preview carries the same keys as before');

-- 6. No member's name or id appears anywhere in it (the inviter is the organiser and is allowed).
select ok(
  (select pg_temp.preview(current_setting('test.tok_d'))::text
     !~ ('Bola|Chi|' || string_agg(m.id::text || '|' || m.user_id::text, '|'))
   from public.exchange_members m where m.exchange_id = current_setting('test.ex_d')::uuid and m.user_id <> pg_temp.u(1)),
  'the drawn preview names no member and carries no member id');

-- 7. An exchange whose joining closed without a draw still reports its join-by date.
select is(
  (pg_temp.preview(current_setting('test.tok_c')) ->> 'status')
  || '/' || ((pg_temp.preview(current_setting('test.tok_c')) ->> 'closed_at')::timestamptz
    = (select e.join_by_at from public.exchanges e where e.id = current_setting('test.ex_c')::uuid))::text,
  'closed/true', 'an undrawn exchange with joining closed still reports join-by as closed_at');

-- 8. An open exchange is unchanged: open, no closed_at.
select is(
  (pg_temp.preview(current_setting('test.tok_o')) ->> 'status')
  || '/' || coalesce(pg_temp.preview(current_setting('test.tok_o')) ->> 'closed_at', 'null'),
  'open/null', 'an open exchange is unchanged');

-- 9. The helper returns nothing for an exchange with no current assignments.
select is(
  (select private.exchange_drawn_at(current_setting('test.ex_o')::uuid))::text,
  null, 'the helper returns null for an undrawn exchange');

select * from finish();
rollback;
