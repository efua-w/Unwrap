-- 290_compute_matching — slice 9 (GCO-009 live check, GCO-011 engine rules; plan §5 "Draw without a retry loop";
-- owner decisions 2026-11-22 in docs/tasks/slice-9.md).
-- The engine is private.compute_matching(people, forbidden_first, forbidden_second, seed): a pure function that reads
-- no table. Given people and forbidden pairs (each pair works both ways; nobody draws themself) it returns either a
-- FULL matching (one row per person: giver, receiver, every person once as giver and once as receiver, nothing
-- forbidden) or ZERO rows when no such matching exists. It is a maximum bipartite matching (randomised greedy, then
-- augmenting paths), so "no rows" is proof of impossibility, not a failed try: there is no retry loop (never-do 7).
-- Covers: the exact answer against a brute-force oracle for 2 to 6 people (including dense, impossible inputs); a valid
-- full matching for 7 to 100 people; the cases greedy alone gets wrong (an allowed graph that is a path has exactly one
-- answer for an even count and none for an odd one); a Hall violation; determinism for one seed and variety across
-- seeds; pairs given either way round, duplicated, naming strangers or naming one person twice; bad input; and that
-- matching_feasible agrees. No fixtures: the engine reads no table, so this runs anywhere the migrations are applied.
-- Written BEFORE the exclusions migration: until it is applied the first statement that names the engine fails.
-- Pass: "ok 1".."ok 17", "1..17", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

-- Helpers live in pg_temp so nothing is left in `public` (it would break the allowlist test 030).
create function pg_temp.id(i int) returns uuid
language sql immutable as $$
  select ('c0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
$$;

create function pg_temp.ids(n int) returns uuid[]
language sql as $$
  select coalesce(array_agg(pg_temp.id(i) order by i), '{}'::uuid[]) from generate_series(1, n) i
$$;

-- The allowed graph is a path 1-2-...-n: every pair that is not neighbours is forbidden (two arrays, same order).
create function pg_temp.path_a(n int) returns uuid[]
language sql as $$
  select coalesce(array_agg(pg_temp.id(a) order by a, b), '{}'::uuid[]) from generate_series(1, n) a, generate_series(1, n) b where b - a > 1
$$;
create function pg_temp.path_b(n int) returns uuid[]
language sql as $$
  select coalesce(array_agg(pg_temp.id(b) order by a, b), '{}'::uuid[]) from generate_series(1, n) a, generate_series(1, n) b where b - a > 1
$$;

-- Random-looking but fixed forbidden pairs for the oracle comparison: density 20% to 69% by seed, so some inputs are
-- impossible and some are not.
create function pg_temp.hit(n int, s int, a int, b int) returns boolean
language sql immutable as $$
  select mod(abs(hashtext(n || ':' || s || ':' || a || ':' || b)::bigint), 100) < 20 + mod(s * 7, 50)
$$;
create function pg_temp.rf(n int, s int) returns uuid[]
language sql as $$
  select coalesce(array_agg(pg_temp.id(a) order by a, b), '{}'::uuid[]) from generate_series(1, n) a, generate_series(1, n) b
  where a < b and pg_temp.hit(n, s, a, b)
$$;
create function pg_temp.rs(n int, s int) returns uuid[]
language sql as $$
  select coalesce(array_agg(pg_temp.id(b) order by a, b), '{}'::uuid[]) from generate_series(1, n) a, generate_series(1, n) b
  where a < b and pg_temp.hit(n, s, a, b)
$$;
-- Both directions as codes a*100+b, for the oracle.
create function pg_temp.codes(n int, s int) returns int[]
language sql as $$
  select coalesce(array_agg(c), '{}'::int[]) from (
    select a * 100 + b as c from generate_series(1, n) a, generate_series(1, n) b where a < b and pg_temp.hit(n, s, a, b)
    union all
    select b * 100 + a from generate_series(1, n) a, generate_series(1, n) b where a < b and pg_temp.hit(n, s, a, b)
  ) x
$$;

-- Brute force: is there ANY permutation with nobody on themself and nothing forbidden? Only for n <= 6.
create function pg_temp.oracle(n int, codes int[]) returns boolean
language sql as $$
  with recursive r(pos, perm) as (
    select 0, '{}'::int[]
    union all
    select r.pos + 1, r.perm || j
    from r cross join generate_series(1, n) j
    where r.pos < n and j <> all(r.perm) and j <> r.pos + 1 and ((r.pos + 1) * 100 + j) <> all(codes)
  )
  select exists (select 1 from r where pos = n)
$$;

-- Chains for the 7-to-100 people runs: people in a seed-shuffled line, each neighbouring pair forbidden with 70%
-- probability, so nobody has more than two forbidden partners and a fair draw always exists (Hall: every giver can draw
-- at least n-3 of n people, and n-3 >= n/2 from 6 people up).
create function pg_temp.chain(n int, s int) returns table (a uuid, b uuid, ord int)
language sql as $$
  with o as (select i, row_number() over (order by md5(s || ':' || i)) as r from generate_series(1, n) i)
  select pg_temp.id(o1.i), pg_temp.id(o2.i), o1.r::int
  from o o1 join o o2 on o2.r = o1.r + 1
  where mod(abs(hashtext('chain:' || n || ':' || s || ':' || o1.r)::bigint), 100) < 70
$$;

-- run: 0 = no rows; 1 = a valid full matching; -1 = rows that are not a valid full matching (a bug).
-- Valid means: n rows, every person once as giver and once as receiver, only the people given, nobody on themself,
-- no forbidden pair in either direction.
create function pg_temp.run(p uuid[], ff uuid[], fs uuid[], seed text) returns int
language sql as $$
  with m as (select * from private.compute_matching(p, ff, fs, seed))
  select case
    when (select count(*) from m) = 0 then 0
    when (select count(*) = cardinality(p)
                 and count(distinct giver) = cardinality(p)
                 and count(distinct receiver) = cardinality(p)
                 and count(*) filter (where giver = receiver) = 0
                 and count(*) filter (where giver <> all(p) or receiver <> all(p)) = 0
                 and count(*) filter (where exists (
                       select 1 from unnest(ff, fs) f(x, y) where (x = giver and y = receiver) or (x = receiver and y = giver))) = 0
          from m) then 1
    else -1
  end
$$;

-- The matching as one string, for comparing two runs.
create function pg_temp.sig(p uuid[], ff uuid[], fs uuid[], seed text) returns text
language sql as $$
  select coalesce(string_agg(giver || '>' || receiver, ',' order by giver), '')
  from private.compute_matching(p, ff, fs, seed)
$$;

create function pg_temp.owner_try(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return sqlstate;
end $$;

-- 1. Shape: pure (immutable, no table read), an empty search_path, and closed to both API roles.
select ok(
  (select p.provolatile = 'i' and p.proconfig @> array['search_path=""'] and p.prosrc !~* '(public|private|auth)\.[a-z_]+'
   from pg_proc p where p.oid = 'private.compute_matching(uuid[], uuid[], uuid[], text)'::regprocedure)
  and pg_get_function_result('private.compute_matching(uuid[], uuid[], uuid[], text)'::regprocedure) = 'TABLE(giver uuid, receiver uuid)'
  and not has_function_privilege('anon', 'private.compute_matching(uuid[], uuid[], uuid[], text)', 'execute')
  and not has_function_privilege('authenticated', 'private.compute_matching(uuid[], uuid[], uuid[], text)', 'execute'),
  'compute_matching is immutable, reads no table, has an empty search_path, returns (giver, receiver), and is closed to API roles');

-- 2. Nobody to draw: zero rows for no one and for one person (they could only draw themself).
select is(
  (select count(*) from private.compute_matching('{}', '{}', '{}', 's'))::text
  || '/' || (select count(*) from private.compute_matching(pg_temp.ids(1), '{}', '{}', 's'))::text,
  '0/0', 'no people, and one person, give zero rows');

-- 3. Two people: they draw each other, unless that pair is forbidden.
select is(
  pg_temp.run(pg_temp.ids(2), '{}', '{}', 's')::text
  || '/' || pg_temp.run(pg_temp.ids(2), array[pg_temp.id(1)], array[pg_temp.id(2)], 's')::text
  || '/' || pg_temp.run(pg_temp.ids(2), array[pg_temp.id(2)], array[pg_temp.id(1)], 's')::text,
  '1/0/0', 'two people draw each other, and a forbidden pair (either way written) leaves no draw');

-- 4. Three people with no pairs: always a valid derangement, whatever the seed.
select is(
  (select count(*) filter (where pg_temp.run(pg_temp.ids(3), '{}', '{}', 'seed' || s) <> 1) from generate_series(1, 50) s)::int,
  0, 'three people with no pairs always draw validly (50 seeds)');

-- 5. Exact answer: for 2 to 6 people and 60 random forbidden sets each (dense ones included), the engine returns rows
-- exactly when the brute-force oracle says a draw exists, and the rows are valid.
select is(
  (select count(*) filter (where
      pg_temp.run(pg_temp.ids(c.n), pg_temp.rf(c.n, c.s), pg_temp.rs(c.n, c.s), 'seed' || c.s)
        is distinct from (case when pg_temp.oracle(c.n, pg_temp.codes(c.n, c.s)) then 1 else 0 end))
   from (select n, s from generate_series(2, 6) n, generate_series(1, 60) s) c)::int,
  0, 'engine agrees with the brute-force oracle for 2 to 6 people (300 random inputs), rows always valid');

-- 6. The comparison above is not vacuous: both outcomes occur in good numbers.
select ok(
  (select count(*) filter (where pg_temp.oracle(c.n, pg_temp.codes(c.n, c.s))) >= 20
      and count(*) filter (where not pg_temp.oracle(c.n, pg_temp.codes(c.n, c.s))) >= 20
   from (select n, s from generate_series(2, 6) n, generate_series(1, 60) s) c),
  'the 300 oracle inputs include at least 20 possible and at least 20 impossible draws');

-- 7. 7 to 100 people with chains of forbidden pairs: always a valid full matching (a draw exists by construction).
-- Five seeds up to 30 people, one seed above that.
select is(
  (select count(*) filter (where
      pg_temp.run(pg_temp.ids(c.n),
        (select coalesce(array_agg(a order by ord), '{}') from pg_temp.chain(c.n, c.s)),
        (select coalesce(array_agg(b order by ord), '{}') from pg_temp.chain(c.n, c.s)),
        'seed' || c.s) <> 1)
   from (select n, s from generate_series(7, 100) n, generate_series(1, 5) s where s = 1 or n <= 30) c)::int,
  0, 'a valid full matching for every size from 7 to 100 people with chains of forbidden pairs');

-- 8. A path as the allowed graph has exactly one answer (neighbours swap) for an even number and none for an odd one.
-- WHY: greedy alone fails these (it pairs a person with the wrong neighbour first); only augmenting paths solve them.
select is(
  (select string_agg(pg_temp.run(pg_temp.ids(n), pg_temp.path_a(n), pg_temp.path_b(n), 'seed' || n)::text, '' order by n)
   from unnest(array[2, 4, 10, 40, 100]) n),
  '11111', 'even paths of 2, 4, 10, 40 and 100 people are drawn (augmenting paths work)');
select is(
  (select string_agg(pg_temp.run(pg_temp.ids(n), pg_temp.path_a(n), pg_temp.path_b(n), 'seed' || n)::text, '' order by n)
   from unnest(array[3, 5, 11, 41, 99]) n),
  '00000', 'odd paths of 3, 5, 11, 41 and 99 people have no draw, and give zero rows');

-- 9. Hall violation: five of seven people forbidden from each other can only draw the other two: no draw. With five
-- more people outside the group the same five are fine.
select is(
  pg_temp.run(pg_temp.ids(7),
    array[pg_temp.id(1), pg_temp.id(1), pg_temp.id(1), pg_temp.id(1), pg_temp.id(2), pg_temp.id(2), pg_temp.id(2), pg_temp.id(3), pg_temp.id(3), pg_temp.id(4)],
    array[pg_temp.id(2), pg_temp.id(3), pg_temp.id(4), pg_temp.id(5), pg_temp.id(3), pg_temp.id(4), pg_temp.id(5), pg_temp.id(4), pg_temp.id(5), pg_temp.id(5)],
    's')::text
  || '/' || pg_temp.run(pg_temp.ids(10),
    array[pg_temp.id(1), pg_temp.id(1), pg_temp.id(1), pg_temp.id(1), pg_temp.id(2), pg_temp.id(2), pg_temp.id(2), pg_temp.id(3), pg_temp.id(3), pg_temp.id(4)],
    array[pg_temp.id(2), pg_temp.id(3), pg_temp.id(4), pg_temp.id(5), pg_temp.id(3), pg_temp.id(4), pg_temp.id(5), pg_temp.id(4), pg_temp.id(5), pg_temp.id(5)],
    's')::text,
  '0/1', 'five mutually excluded people among seven have no draw; among ten they do');

-- 10. A person who is forbidden from everyone has no draw; one pair less and they do.
select is(
  pg_temp.run(pg_temp.ids(5), array[pg_temp.id(1), pg_temp.id(1), pg_temp.id(1), pg_temp.id(1)],
    array[pg_temp.id(2), pg_temp.id(3), pg_temp.id(4), pg_temp.id(5)], 's')::text
  || '/' || pg_temp.run(pg_temp.ids(5), array[pg_temp.id(1), pg_temp.id(1), pg_temp.id(1)],
    array[pg_temp.id(2), pg_temp.id(3), pg_temp.id(4)], 's')::text,
  '0/1', 'a person excluded from everyone blocks the draw; excluded from all but one it works');

-- 11. Determinism: the same people, pairs and seed always give the same matching (the draw can be explained and tested).
select is(
  pg_temp.sig(pg_temp.ids(30), '{}', '{}', 'fixed'),
  pg_temp.sig(pg_temp.ids(30), '{}', '{}', 'fixed'),
  'the same seed gives the same matching');

-- 12. Variety: different seeds give different matchings (10 people, no pairs, 20 seeds, at least 10 different results).
select ok(
  (select count(distinct pg_temp.sig(pg_temp.ids(10), '{}', '{}', 'seed' || s)) from generate_series(1, 20) s) >= 10,
  'different seeds give different matchings (at least 10 of 20)');

-- 13. A pair works both ways: with only (1,2) forbidden among four people, across 40 seeds nobody 1 draws 2 or 2 draws 1
-- (run checks both directions), and written the other way round it is the same.
select is(
  (select count(*) filter (where pg_temp.run(pg_temp.ids(4), array[pg_temp.id(1)], array[pg_temp.id(2)], 'seed' || s) <> 1
                              or pg_temp.run(pg_temp.ids(4), array[pg_temp.id(2)], array[pg_temp.id(1)], 'seed' || s) <> 1
                              or pg_temp.sig(pg_temp.ids(4), array[pg_temp.id(1)], array[pg_temp.id(2)], 'seed' || s)
                                 is distinct from pg_temp.sig(pg_temp.ids(4), array[pg_temp.id(2)], array[pg_temp.id(1)], 'seed' || s))
   from generate_series(1, 40) s)::int,
  0, 'a pair is forbidden in both directions and the order it is written does not matter (40 seeds)');

-- 14. Entries that cannot matter are ignored and change nothing: the same pair twice, a pair naming someone not in the
-- list, and a person paired with themself give exactly the matching of the clean input.
select is(
  pg_temp.sig(pg_temp.ids(6),
    array[pg_temp.id(1), pg_temp.id(2), pg_temp.id(1), pg_temp.id(99), pg_temp.id(3)],
    array[pg_temp.id(2), pg_temp.id(1), pg_temp.id(2), pg_temp.id(1), pg_temp.id(3)], 'seed'),
  pg_temp.sig(pg_temp.ids(6), array[pg_temp.id(1)], array[pg_temp.id(2)], 'seed'),
  'a duplicated pair, a stranger in a pair and a self-pair are ignored');

-- 15. Bad input is refused (22023), never answered: a null people array, a null pair array, arrays of different
-- lengths, a repeated person, a null person, a null in a pair, a null seed.
select is(
  pg_temp.owner_try('select * from private.compute_matching(null, ''{}'', ''{}'', ''s'')')
  || '/' || pg_temp.owner_try('select * from private.compute_matching(''{}'', null, ''{}'', ''s'')')
  || '/' || pg_temp.owner_try('select * from private.compute_matching(''{}'', ''{}'', null, ''s'')')
  || '/' || pg_temp.owner_try(format('select * from private.compute_matching(%L, array[%L]::uuid[], ''{}'', ''s'')', pg_temp.ids(3), pg_temp.id(1)))
  || '/' || pg_temp.owner_try(format('select * from private.compute_matching(array[%L, %L]::uuid[], ''{}'', ''{}'', ''s'')', pg_temp.id(1), pg_temp.id(1)))
  || '/' || pg_temp.owner_try(format('select * from private.compute_matching(array[%L, null]::uuid[], ''{}'', ''{}'', ''s'')', pg_temp.id(1)))
  || '/' || pg_temp.owner_try(format('select * from private.compute_matching(%L, array[null]::uuid[], array[%L]::uuid[], ''s'')', pg_temp.ids(3), pg_temp.id(1)))
  || '/' || pg_temp.owner_try(format('select * from private.compute_matching(%L, ''{}'', ''{}'', null)', pg_temp.ids(3))),
  '22023/22023/22023/22023/22023/22023/22023/22023', 'bad input is refused with 22023');

-- 16. matching_feasible gives the same verdict as the engine (a fixed seed does not matter: the engine is exact).
select is(
  private.matching_feasible(pg_temp.ids(4), '{}', '{}')::text
  || '/' || private.matching_feasible(pg_temp.ids(2), array[pg_temp.id(1)], array[pg_temp.id(2)])::text
  || '/' || private.matching_feasible(pg_temp.ids(10), pg_temp.path_a(10), pg_temp.path_b(10))::text
  || '/' || private.matching_feasible(pg_temp.ids(11), pg_temp.path_a(11), pg_temp.path_b(11))::text
  || '/' || private.matching_feasible('{}', '{}', '{}')::text,
  'true/false/true/false/false', 'matching_feasible: yes for four free people and an even path, no for a forbidden two, an odd path and nobody');

-- 17. No-retry rule (never-do 7): the engine has no loop that draws again with another seed; its source calls itself
-- nowhere and reads no clock or random source.
select ok(
  (select p.prosrc !~* '(random\(\)|clock_timestamp|now\(\)|compute_matching\()' from pg_proc p
   where p.oid = 'private.compute_matching(uuid[], uuid[], uuid[], text)'::regprocedure),
  'the engine uses no random source or clock and does not call itself, so it cannot be a retry loop');

select * from finish();
rollback;
