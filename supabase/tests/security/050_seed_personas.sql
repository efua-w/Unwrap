-- 050_seed_personas — the seeded personas exist and "act as" works (slice 0b).
-- Needs supabase/seed.sql applied first (`supabase db reset` does this in CI). On a hosted dev
-- project, either run seed.sql there first (owner approval) or paste seed.sql's body right after
-- the `set local search_path` line below; it holds no transaction statements.
-- Pass: "ok 1".."ok 6", "1..6", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

-- WHY: the act-as helper lives in pg_temp, not `public`, so it can't appear in the function
-- allowlist test (030). It uses SET LOCAL ROLE plus SET LOCAL request.jwt.claims, which is what
-- auth.uid() reads under PostgREST.
create function pg_temp.act_as(who uuid) returns void
language plpgsql as $$
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
end $$;

-- Counts mismatches between the persona we act as and what auth.uid() reports.
create function pg_temp.uid_mismatches(acting uuid[], expected uuid[]) returns int
language plpgsql as $$
declare
  bad int := 0;
begin
  for i in 1 .. array_length(acting, 1) loop
    perform pg_temp.act_as(acting[i]);
    if auth.uid() is distinct from expected[i] then bad := bad + 1; end if;
    reset role;
  end loop;
  return bad;
end $$;

-- 1-3. The personas exist as specified.
select is(
  (select count(*)::int from auth.users where id in (
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000005')),
  5, 'five seeded personas exist with their fixed UUIDs (run seed.sql first)');

select is(
  (select count(*)::int from auth.users
   where id::text like 'a0000000-0000-4000-8000-00000000000_' and email not like '%@example.test'),
  0, 'every persona uses an @example.test address');

select is(
  (select count(*)::int from auth.users
   where id::text like 'a0000000-0000-4000-8000-00000000000_' and coalesce(encrypted_password, '') <> ''),
  0, 'no persona has a password');

-- 4. Acting as each persona makes auth.uid() return that persona, under the authenticated role.
select is(
  pg_temp.uid_mismatches(
    array['a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
          'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004',
          'a0000000-0000-4000-8000-000000000005']::uuid[],
    array['a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
          'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004',
          'a0000000-0000-4000-8000-000000000005']::uuid[]),
  0, 'acting as each persona makes auth.uid() return that persona');

-- 5. Self-check: the comparison catches a mismatch (acting as organiser, expecting outsider).
select is(
  pg_temp.uid_mismatches(
    array['a0000000-0000-4000-8000-000000000001']::uuid[],
    array['a0000000-0000-4000-8000-000000000005']::uuid[]),
  1, 'self-check: acting as one persona is not mistaken for another');

-- 6. Self-check: without a signed-in subject auth.uid() is null, so persona results are not a
-- default or a leftover from an earlier probe.
create function pg_temp.anon_uid_is_null() returns boolean
language plpgsql as $$
declare
  result boolean;
begin
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';
  result := auth.uid() is null;
  reset role;
  return result;
end $$;
select ok(pg_temp.anon_uid_is_null(), 'self-check: anon has no auth.uid()');

select * from finish();
rollback;
