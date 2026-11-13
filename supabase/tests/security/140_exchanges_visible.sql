-- 140_exchanges_visible — audit finding 6 (2026-11-13; GC-008, GC-013, GCO-004).
-- The app reads exchanges through public.exchanges_visible: a security_invoker view over exactly the
-- columns signed-in people may read, so `select *` is safe and the invite token is out by construction.
-- Self-contained: creates its own users and exchanges inside the transaction (needs the exchanges,
-- gift_day_date_only and exchanges_visible migrations applied). Everything rolls back.
-- Pass: "ok 1".."ok 9", "1..9", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

-- Same helpers as 130 (inline so the file runs on its own); nothing is left in `public`.
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

-- Ada organises one exchange, Bola is a member of it, Cleo is an outsider.
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001401', 'ada-140@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001402', 'bola-140@example.test', '{"first_name":"Bola"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000001403', 'cleo-140@example.test', '{"first_name":"Cleo"}');
-- WHY `do ... perform`: a bare select would print "ok:1", which pg_prove reads as a TAP line.
do $fx$ begin perform pg_temp.try_as('b0000000-0000-4000-8000-000000001401',
  $$select public.create_exchange('T140', null, '10k_20k', current_date + 10, 'at_join_by', '18:00', current_date + 20, 'Africa/Lagos', true, false)$$); end $fx$;
insert into public.exchange_members (exchange_id, user_id, taking_part)
select id, 'b0000000-0000-4000-8000-000000001402', true from public.exchanges where name = 'T140';

-- 1-3. Shape: a view, security_invoker, and no invite token.
select has_view('public', 'exchanges_visible', 'public.exchanges_visible exists');
select ok(
  (select coalesce(c.reloptions, '{}') && array['security_invoker=true', 'security_invoker=on']
   from pg_class c where c.oid = 'public.exchanges_visible'::regclass),
  'exchanges_visible is security_invoker, so the caller''s grants and Row Level Security apply');
select hasnt_column('public', 'exchanges_visible', 'invite_token', 'exchanges_visible has no invite_token column');

-- 4. WHY this guard: the view names columns of public.exchanges. If one is named without a column
-- grant to authenticated, every read of the view fails with 42501 and every exchange page shows its
-- error state. This catches that in CI instead.
select is(
  (select coalesce(string_agg(a.attname, ', ' order by a.attname), '')
   from pg_attribute a
   where a.attrelid = 'public.exchanges_visible'::regclass and a.attnum > 0 and not a.attisdropped
     and not has_column_privilege('authenticated', 'public.exchanges', a.attname, 'select')),
  '', 'every column of exchanges_visible is a column signed-in people may read on exchanges');

-- 5-8. Row Level Security still applies through the view.
select is(pg_temp.try_as(null, 'select 1 from public.exchanges_visible'), 'err:42501', 'anon cannot read exchanges_visible');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001401', $$select * from public.exchanges_visible where name = 'T140'$$),
  'ok:1', 'the organiser reads their exchange with select *');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001402', $$select * from public.exchanges_visible where name = 'T140'$$),
  'ok:1', 'a member reads the exchange with select *');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000001403', $$select * from public.exchanges_visible where name = 'T140'$$),
  'ok:0', 'an outsider sees no row');

-- 9. Self-check for test 4: a column without a grant is detected by the same query.
create view public.zz_selfcheck_exchanges_view with (security_invoker = true) as
  select id, invite_token from public.exchanges;
select is(
  (select coalesce(string_agg(a.attname, ', '), '')
   from pg_attribute a
   where a.attrelid = 'public.zz_selfcheck_exchanges_view'::regclass and a.attnum > 0 and not a.attisdropped
     and not has_column_privilege('authenticated', 'public.exchanges', a.attname, 'select')),
  'invite_token', 'self-check: a view column with no grant (invite_token) is detected');

select * from finish();
rollback;
