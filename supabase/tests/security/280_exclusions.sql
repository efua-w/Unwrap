-- 280_exclusions — slice 9 (GCO-009 exclusions; plan §5, §6 invariants 2 and 11; owner decisions 2026-11-22 in
-- docs/tasks/slice-9.md).
-- Covers: public.exclusions is closed to both API roles (no grant, RLS on, no policy: 42501, not zero rows); the three
-- public functions (get_exclusions, check_exclusions, save_exclusions) are organiser-only (everyone else gets zero rows
-- on reads and P0002 on save, a visitor 42501); a pair works both ways and is stored once; save is a diff that keeps
-- the rows that stay (so "most recently added" survives), and new rows keep the draft's order; a draft that blocks the
-- draw is still saved (AC-7); a bad draft is refused with a hint; saving is refused once the exchange is cancelled or
-- over; reading is not; a pair vanishes from the organiser's list when either person leaves; check_exclusions names the
-- LAST pair of the draft that fixes an impossible draw, or none when no single pair does; and nothing here reads an
-- assignment or a reservation. The 'drawn' state does not exist yet (slice 10 adds it to private.exchange_status), so
-- its refusal is covered there: it is the same `not in (open, joining_closed)` branch tested here with `complete`.
-- Self-contained: creates its own users inside the transaction (needs the migrations through the exclusions one
-- applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under `supabase test db`.
-- Everything rolls back. Names are prefixed "T280" because dev holds other data.
-- Written BEFORE the exclusions migration: until it is applied the first statement that names an exclusions function
-- fails and the run stops. That is the expected "red".
-- Pass: "ok 1".."ok 33", "1..33", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(33);

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

-- u(n) is persona n: 1 Ada (organiser of P), 2 Bola, 3 Chi, 4 Dayo, 5 Eze (members of P), 6 Femi (organiser of X, alone),
-- 7 Gbemi (outsider), 8 Hana (removed from P), 9 Ife (member of P, not taking part), 10 Jide (left P),
-- 11 Kemi, 12 Lola (members of P). P therefore has seven people taking part: Ada Bola Chi Dayo Eze Kemi Lola.
create function pg_temp.u(n int) returns uuid
language sql immutable as $$
  select ('b0000000-0000-4000-8000-' || lpad('28' || lpad(n::text, 2, '0'), 12, '0'))::uuid
$$;

-- A member id by first name within one exchange (any state, so a removed person can be named).
create function pg_temp.mid(ex text, nm text) returns uuid
language sql as $$
  select m.id from public.exchange_members m join public.profiles p on p.id = m.user_id
  where m.exchange_id = ex::uuid and p.display_name = nm
$$;

-- The argument list for a pairs call from a spec like 'Bola-Chi,Dayo-Eze' (first-second, in draft order). An unknown
-- name becomes a NULL element, which is how the bad-input cases are built.
create function pg_temp.args(ex text, spec text) returns text
language sql as $$
  select format('%L, array[%s]::uuid[], array[%s]::uuid[]', ex,
    coalesce((select string_agg(format('%L', pg_temp.mid(ex, split_part(s, '-', 1))), ',' order by o)
              from unnest(string_to_array(nullif(spec, ''), ',')) with ordinality t(s, o)), ''),
    coalesce((select string_agg(format('%L', pg_temp.mid(ex, split_part(s, '-', 2))), ',' order by o)
              from unnest(string_to_array(nullif(spec, ''), ',')) with ordinality t(s, o)), ''))
$$;

-- Member ids in a result replaced by first names, so the expected strings read as people.
create function pg_temp.named(s text, ex text) returns text
language plpgsql as $$
declare
  r record;
begin
  if s is null then
    return null;
  end if;
  for r in select m.id, p.display_name from public.exchange_members m join public.profiles p on p.id = m.user_id
           where m.exchange_id = ex::uuid loop
    s := replace(s, r.id::text, r.display_name);
  end loop;
  return s;
end $$;

create function pg_temp.save(who uuid, ex text, spec text) returns text
language sql as $$
  select pg_temp.val_as(who, format('public.save_exclusions(%s)', pg_temp.args(ex, spec)))
$$;

-- people_count:feasible:relax_first:relax_second, as names.
create function pg_temp.chk(who uuid, ex text, spec text) returns text
language sql as $$
  select pg_temp.named(pg_temp.val_as(who, format(
    $q$(select people_count::text || ':' || feasible::text || ':' || coalesce(relax_first::text, '-') || ':' || coalesce(relax_second::text, '-')
        from public.check_exclusions(%s))$q$, pg_temp.args(ex, spec))), ex)
$$;

-- The organiser's saved pairs as "First+Second" in the order returned.
create function pg_temp.xline(who uuid, ex text) returns text
language sql as $$
  select pg_temp.val_as(who, format(
    $q$(select string_agg(g.first_name || '+' || g.second_name, '|' order by g.ord)
        from public.get_exclusions(%L) with ordinality as g(id, first_member_id, first_name, second_member_id, second_name, created_at, ord))$q$, ex))
$$;

-- Fixtures. WHY do-blocks: pg_prove reads any fixture select output as TAP lines.
do $fx$ begin
  perform pg_temp.mk_user(pg_temp.u(i), 'u280-' || i || '@example.test',
    jsonb_build_object('first_name', (array['Ada', 'Bola', 'Chi', 'Dayo', 'Eze', 'Femi', 'Gbemi', 'Hana', 'Ife', 'Jide', 'Kemi', 'Lola'])[i]))
  from generate_series(1, 12) i;
end $fx$;

do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), pg_temp.mk('T280 Exclusions'));
  perform pg_temp.try_as(pg_temp.u(6), pg_temp.mk('T280 Other'));
end $fx$;

do $fx$ begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('test.ex_p', (select id::text from public.exchanges where name = 'T280 Exclusions'), true);
  perform set_config('test.ex_x', (select id::text from public.exchanges where name = 'T280 Other'), true);
end $fx$;

-- Members written as the migration role. Hana and Jide are inserted active and then ended, because a membership is
-- active exactly when it has not ended (a check on the table).
do $fx$ begin
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    select current_setting('test.ex_p')::uuid, pg_temp.u(n), true, now() - make_interval(days => 10 - n) from unnest(array[2, 3, 4, 5, 11, 12]) n;
  insert into public.exchange_members (exchange_id, user_id, taking_part, joined_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(9), false, now() - interval '1 day');
  insert into public.exchange_members (exchange_id, user_id, taking_part, state, joined_at, left_at)
    values (current_setting('test.ex_p')::uuid, pg_temp.u(8), true, 'removed', now() - interval '9 days', now() - interval '8 days'),
           (current_setting('test.ex_p')::uuid, pg_temp.u(10), true, 'left', now() - interval '9 days', now() - interval '8 days');
end $fx$;

-- 1. Shape: the three public functions are SECURITY DEFINER with an empty search_path (040 checks all schemas); the four
-- private helpers exist.
select ok(
  (select count(*) = 3 and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('get_exclusions', 'check_exclusions', 'save_exclusions'))
  and (select count(*) = 4 from pg_proc p
       where p.pronamespace = 'private'::regnamespace
         and p.proname in ('compute_matching', 'matching_feasible', 'draw_people', 'exclusion_pairs')),
  'the three public functions are SECURITY DEFINER with an empty search_path, and the four private helpers exist');

-- 2. The table is closed: a read or a write by either API role is refused (42501), not an empty result.
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from public.exclusions')
  || '/' || pg_temp.try_as(null, 'select * from public.exclusions')
  || '/' || pg_temp.try_as(pg_temp.u(1), format('insert into public.exclusions (exchange_id, first_member_id, second_member_id) values (%L, %L, %L)',
      current_setting('test.ex_p'), pg_temp.mid(current_setting('test.ex_p'), 'Bola'), pg_temp.mid(current_setting('test.ex_p'), 'Chi'))),
  'err:42501/err:42501/err:42501',
  'the organiser and a visitor are refused (42501) reading public.exclusions, and the organiser writing it');

-- 3. Defence in depth: no grant for either role, RLS on, and no policy that could open it later by accident.
select ok(
  not has_any_column_privilege('anon', 'public.exclusions', 'select, insert, update, references')
  and not has_any_column_privilege('authenticated', 'public.exclusions', 'select, insert, update, references')
  and not has_table_privilege('authenticated', 'public.exclusions', 'delete, truncate')
  and (select relrowsecurity from pg_class where oid = 'public.exclusions'::regclass)
  and not exists (select 1 from pg_policy where polrelid = 'public.exclusions'::regclass),
  'public.exclusions has no grant for anon or authenticated, RLS is on, and it has no policy');

-- 4. Grants: anon cannot execute any of the three; signed-in people can.
select ok(
  not has_function_privilege('anon', 'public.get_exclusions(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.check_exclusions(uuid, uuid[], uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.save_exclusions(uuid, uuid[], uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.get_exclusions(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.check_exclusions(uuid, uuid[], uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.save_exclusions(uuid, uuid[], uuid[])', 'execute'),
  'anon cannot execute the exclusions functions and signed-in people can');

-- 5. The private helpers refuse both API roles outright (42501 on the private schema).
select is(
  pg_temp.try_as(pg_temp.u(1), 'select * from private.compute_matching(null, null, null, null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select private.matching_feasible(null, null, null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select private.draw_people(null)')
  || '/' || pg_temp.try_as(pg_temp.u(1), 'select * from private.exclusion_pairs(null)')
  || '/' || pg_temp.try_as(null, 'select * from private.compute_matching(null, null, null, null)'),
  'err:42501/err:42501/err:42501/err:42501/err:42501',
  'the private engine and helpers are refused for signed-in people and visitors');

-- 6. What is returned: member ids and first names, a count and a verdict. Nothing else can be added silently.
select is(
  pg_get_function_result('public.get_exclusions(uuid)'::regprocedure)
  || '/' || pg_get_function_result('public.check_exclusions(uuid, uuid[], uuid[])'::regprocedure),
  'TABLE(id uuid, first_member_id uuid, first_name text, second_member_id uuid, second_name text, created_at timestamp with time zone)'
  || '/' || 'TABLE(people_count integer, feasible boolean, relax_first uuid, relax_second uuid)',
  'get_exclusions and check_exclusions return member ids, first names and the verdict only (no address, no person id)');

-- 7. A visitor is refused on all three.
select is(
  pg_temp.try_as(null, format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(null, format('select * from public.check_exclusions(%s)', pg_temp.args(current_setting('test.ex_p'), '')))
  || '/' || pg_temp.try_as(null, format('select public.save_exclusions(%s)', pg_temp.args(current_setting('test.ex_p'), ''))),
  'err:42501/err:42501/err:42501', 'a visitor is refused (42501) on get, check and save');

-- 8. The organiser saves two pairs; save returns how many pairs are now saved.
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi,Dayo-Eze'),
  '2', 'the organiser saves two pairs and save returns the count');

-- 9. They come back in the order they were added, as first names.
select is(
  pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p')),
  'Bola+Chi|Dayo+Eze', 'the organiser reads the pairs in the order they were saved');

-- 10. The rows hold no address and no person id.
select ok(
  (select r not like '%@%' and r not like '%user_id%' and r not like '%b0000000-0000-4000-8000-%' and r not like '%T280%'
   from (select pg_temp.val_as(pg_temp.u(1), format($$(select jsonb_agg(to_jsonb(g)) from public.get_exclusions(%L) g)$$, current_setting('test.ex_p'))) as r) s),
  'the saved pair rows hold no address, person id or exchange name');

-- 11-13. The rows that stay are not rewritten: ids are remembered, then the draft is saved with the first pair
-- reversed (a pair works both ways, so it is the same pair), then with one pair removed and one added.
do $fx$ begin
  perform set_config('test.id_bc', (select id::text from public.exclusions
    where exchange_id = current_setting('test.ex_p')::uuid
      and least(first_member_id, second_member_id) = least(pg_temp.mid(current_setting('test.ex_p'), 'Bola'), pg_temp.mid(current_setting('test.ex_p'), 'Chi'))), true);
  perform set_config('test.id_de', (select id::text from public.exclusions
    where exchange_id = current_setting('test.ex_p')::uuid
      and least(first_member_id, second_member_id) = least(pg_temp.mid(current_setting('test.ex_p'), 'Dayo'), pg_temp.mid(current_setting('test.ex_p'), 'Eze'))), true);
end $fx$;
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Chi-Bola,Dayo-Eze'),
  '2', 'saving the first pair reversed is the same pair: still two');
select is(
  (select count(*)::text || ':' || count(*) filter (where id in (current_setting('test.id_bc')::uuid, current_setting('test.id_de')::uuid))::text
   from public.exclusions where exchange_id = current_setting('test.ex_p')::uuid),
  '2:2', 'the reversed pair did not create a second row and no row was rewritten');
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi,Eze-Ada'),
  '2', 'removing one pair and adding one saves two');
select is(
  pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p'))
  || '/' || (select (count(*) filter (where id = current_setting('test.id_bc')::uuid))::text || (count(*) filter (where id = current_setting('test.id_de')::uuid))::text
             from public.exclusions where exchange_id = current_setting('test.ex_p')::uuid),
  'Bola+Chi|Eze+Ada/10',
  'the kept pair keeps its row and its place, the removed pair is gone, the new pair comes last');

-- 15. The same pair twice in one draft (either way round) is saved once.
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi,Chi-Bola')
  || '/' || pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p')),
  '1/Bola+Chi', 'a pair listed twice in a draft is saved once');

-- 16. Only the organiser: a member, a person who left, a removed person, a non-participant, an outsider and another
-- exchange's organiser read zero rows (not an error, so nothing is revealed) although pairs exist; save is P0002.
select is(
  pg_temp.try_as(pg_temp.u(2), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(3), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(8), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(10), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(9), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.get_exclusions(%L)', current_setting('test.ex_p')))
  || '/' || pg_temp.try_as(pg_temp.u(2), format('select * from public.check_exclusions(%s)', pg_temp.args(current_setting('test.ex_p'), '')))
  || '/' || pg_temp.try_as(pg_temp.u(7), format('select * from public.check_exclusions(%s)', pg_temp.args(current_setting('test.ex_p'), '')))
  || '/' || pg_temp.try_as(pg_temp.u(6), format('select * from public.check_exclusions(%s)', pg_temp.args(current_setting('test.ex_p'), '')))
  || '/' || pg_temp.save(pg_temp.u(2), current_setting('test.ex_p'), '')
  || '/' || pg_temp.save(pg_temp.u(7), current_setting('test.ex_p'), '')
  || '/' || pg_temp.save(pg_temp.u(6), current_setting('test.ex_p'), ''),
  'ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/ok:0/err:P0002:/err:P0002:/err:P0002:',
  'only the organiser reads or saves: everyone else gets zero rows on a read and P0002 on a save');

-- 17. The pair is stored once per pair, whichever way round (unique on the normalised pair), and never with itself.
select is(
  pg_temp.owner_try(format('insert into public.exclusions (exchange_id, first_member_id, second_member_id) values (%L, %L, %L)',
    current_setting('test.ex_p'), pg_temp.mid(current_setting('test.ex_p'), 'Chi'), pg_temp.mid(current_setting('test.ex_p'), 'Bola')))
  || '/' || pg_temp.owner_try(format('insert into public.exclusions (exchange_id, first_member_id, second_member_id) values (%L, %L, %L)',
    current_setting('test.ex_p'), pg_temp.mid(current_setting('test.ex_p'), 'Bola'), pg_temp.mid(current_setting('test.ex_p'), 'Bola'))),
  '23505/23514', 'a reversed duplicate is refused (23505) and a pair of one person is refused (23514)');

-- 18. Bad drafts are refused with a hint and change nothing. 'pairs' for the shape (a null array, different lengths, a
-- null element, a person paired with themself); 'members' for someone who is not taking part in this exchange now
-- (Ife does not take part, Hana was removed, Femi is in another exchange).
select is(
  pg_temp.val_as(pg_temp.u(1), format('public.save_exclusions(%L, null, null)', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('public.save_exclusions(%L, array[%L]::uuid[], array[]::uuid[])',
      current_setting('test.ex_p'), pg_temp.mid(current_setting('test.ex_p'), 'Bola')))
  || '/' || pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Nobody')
  || '/' || pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Bola')
  || '/' || pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Ife')
  || '/' || pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Hana-Chi'),
  'err:22023:pairs/err:22023:pairs/err:22023:pairs/err:22023:pairs/err:22023:members/err:22023:members',
  'a bad draft is refused (22023) with the hint pairs or members');
select is(
  pg_temp.val_as(pg_temp.u(1), format('public.save_exclusions(%L, array[%L]::uuid[], array[%L]::uuid[])',
    current_setting('test.ex_p'), pg_temp.mid(current_setting('test.ex_p'), 'Bola'), pg_temp.mid(current_setting('test.ex_x'), 'Femi')))
  || '/' || pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p')),
  'err:22023:members/Bola+Chi',
  'a person from another exchange is refused, and the saved pairs are untouched by all the refused drafts');

-- 20-23. check_exclusions: it judges a DRAFT (nothing is read from or written to the saved pairs). 7 people take part.
select is(
  pg_temp.chk(pg_temp.u(1), current_setting('test.ex_p'), '')
  || '/' || pg_temp.chk(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi,Dayo-Eze,Kemi-Lola'),
  '7:true:-:-/7:true:-:-', 'with seven people and no pair, or three separate pairs, a fair draw is possible');
select is(
  pg_temp.chk(pg_temp.u(1), current_setting('test.ex_p'), 'Ife-Ada,Hana-Bola'),
  '7:true:-:-', 'a pair naming someone who is not taking part, or was removed, is ignored (it cannot block the draw)');
-- Ada excluded from everyone: no giver for Ada. Removing any one pair fixes it, so the LAST pair of the draft is named,
-- first and second as written in the draft.
select is(
  pg_temp.chk(pg_temp.u(1), current_setting('test.ex_p'), 'Ada-Bola,Ada-Chi,Ada-Dayo,Ada-Eze,Ada-Kemi,Ada-Lola'),
  '7:false:Ada:Lola', 'an impossible draft names the most recently added pair that fixes it');
-- Five people all excluded from each other have only two people left to draw: no single pair fixes it.
select is(
  pg_temp.chk(pg_temp.u(1), current_setting('test.ex_p'),
    'Ada-Bola,Ada-Chi,Ada-Dayo,Ada-Eze,Bola-Chi,Bola-Dayo,Bola-Eze,Chi-Dayo,Chi-Eze,Dayo-Eze'),
  '7:false:-:-', 'when no single pair fixes it, no pair is named');
-- Fewer than three people: the count says so; the verdict is false (the app shows the fewer-than-3 line).
select is(
  pg_temp.chk(pg_temp.u(6), current_setting('test.ex_x'), ''),
  '1:false:-:-', 'one person taking part gives a count of 1 and no fair draw');

-- 25. Check refuses a bad draft and writes nothing.
select is(
  pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.check_exclusions(%L, null, null))', current_setting('test.ex_p')))
  || '/' || pg_temp.val_as(pg_temp.u(1), format('(select count(*) from public.check_exclusions(%s))', pg_temp.args(current_setting('test.ex_p'), 'Bola-Bola')))
  || '/' || (select count(*)::text from public.exclusions where exchange_id = current_setting('test.ex_p')::uuid),
  'err:22023:pairs/err:22023:pairs/1', 'check refuses a null or self-pair draft (22023) and saves nothing');

-- 26-27. AC-7: a draft that blocks the draw is still saved, and the new rows keep the draft's order.
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Ada-Bola,Ada-Chi,Ada-Dayo,Ada-Eze,Ada-Kemi,Ada-Lola'),
  '6', 'a draft that blocks the draw is saved (the draw checks again later)');
select is(
  pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p')),
  'Ada+Bola|Ada+Chi|Ada+Dayo|Ada+Eze|Ada+Kemi|Ada+Lola',
  'six new pairs saved in one go keep the draft order');

-- 28. Back to two pairs for the state checks.
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi,Dayo-Eze'),
  '2', 'saving fewer pairs removes the rest');

-- 29-31. State. A cancelled exchange refuses a save with the hint cancelled; a complete one with the hint closed. Reads
-- still work in both (the locked view is read-only, not hidden). Slice 10 adds 'drawn' to the same branch.
do $fx$ begin
  update public.exchanges set cancelled_at = now() where id = current_setting('test.ex_p')::uuid;
end $fx$;
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi'),
  'err:22023:cancelled', 'a cancelled exchange refuses a save with the hint cancelled');
do $fx$ begin
  update public.exchanges set cancelled_at = null, completed_at = now() where id = current_setting('test.ex_p')::uuid;
end $fx$;
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi')
  || '/' || pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p'))
  || '/' || (select count(*)::text from public.exclusions where exchange_id = current_setting('test.ex_p')::uuid),
  'err:22023:closed/Bola+Chi|Dayo+Eze/2', 'a finished exchange refuses a save with the hint closed, still reads, and loses nothing');
do $fx$ begin
  update public.exchanges set completed_at = null where id = current_setting('test.ex_p')::uuid;
  update public.exchanges set join_by_at = now() - interval '1 hour' where id = current_setting('test.ex_p')::uuid;
end $fx$;
select is(
  pg_temp.save(pg_temp.u(1), current_setting('test.ex_p'), 'Bola-Chi,Dayo-Eze,Kemi-Lola')
  || '/' || private.exchange_status(current_setting('test.ex_p')::uuid)::text,
  '3/joining_closed', 'joining closed still allows a save (pairs change until the names are drawn)');

-- 32. A pair vanishes from the organiser's list when either person leaves (owner decision Q2: pairs follow the
-- membership). The row stays, so nothing is deleted behind the organiser's back.
do $fx$ begin
  perform pg_temp.try_as(pg_temp.u(1), format('select public.remove_member(%L)', pg_temp.mid(current_setting('test.ex_p'), 'Bola')));
end $fx$;
select is(
  pg_temp.xline(pg_temp.u(1), current_setting('test.ex_p'))
  || '/' || pg_temp.chk(pg_temp.u(1), current_setting('test.ex_p'), 'Dayo-Eze')
  || '/' || (select count(*)::text from public.exclusions where exchange_id = current_setting('test.ex_p')::uuid),
  'Dayo+Eze|Kemi+Lola/6:true:-:-/3',
  'a pair whose person was removed leaves the list and the count, and the row is kept');

-- 33. Nothing in these functions reads an assignment or a reservation (the engine is pure and reads no table).
select ok(
  not exists (
    select 1 from pg_proc p
    where (p.oid in ('public.get_exclusions(uuid)'::regprocedure, 'public.check_exclusions(uuid, uuid[], uuid[])'::regprocedure,
                     'public.save_exclusions(uuid, uuid[], uuid[])'::regprocedure)
           or (p.pronamespace = 'private'::regnamespace and p.proname in ('compute_matching', 'matching_feasible', 'draw_people', 'exclusion_pairs')))
      and (p.prosrc ilike '%assign%' or p.prosrc ilike '%reserv%'))
  and (select p.prosrc ilike '%for update%' from pg_proc p where p.oid = 'public.save_exclusions(uuid, uuid[], uuid[])'::regprocedure),
  'the exclusions functions read no assignment and no reservation, and save locks the exchange row');

select * from finish();
rollback;
