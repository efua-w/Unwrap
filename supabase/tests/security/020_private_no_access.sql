-- 020_private_no_access — plan §6 invariant 1: anon and authenticated are refused on `private`.
-- WHY: a refusal is SQLSTATE 42501 (insufficient_privilege), not zero rows (CLAUDE.md "Database
-- changes" 3). The role switch (SET LOCAL ROLE plus SET LOCAL request.jwt.claims) happens inside
-- a pg_temp function, so pgTAP itself always runs as the test owner; outcomes pass back through
-- transaction-local settings.
-- Pass: "ok 1".."ok 11", "1..11", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

select has_schema('private', 'schema private exists (run the harden_defaults migration first)');

-- WHY (R1-1): the fixture tests below prove the mechanism; these assertions prove the REAL schema.
-- No USAGE means neither role can name anything in `private`, whatever grants objects carry.
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon has no USAGE on schema private');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated has no USAGE on schema private');

-- Catalogue detector: any effective privilege (PUBLIC and inheritance included) that anon or
-- authenticated hold on a relation (tables, partitioned tables, views, matviews, sequences,
-- foreign tables) or an executable non-extension function in `private`. Extension-owned objects
-- are excluded visibly via pg_depend deptype 'e'. Scope is public and private only: widen this
-- if the API schemas in supabase/config.toml ever change (R1-5).
create function pg_temp.private_exposure() returns text
language sql stable as $$
  select coalesce(string_agg(x.item, ', ' order by x.item), '') from (
    select r.rolname || ' on ' || c.relname || ' (' || c.relkind::text || ')' as item
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    where n.nspname = 'private'
      and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      and not exists (select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
      and case when c.relkind = 'S'
        then has_sequence_privilege(r.rolname, c.oid, 'usage, select, update')
        else has_table_privilege(r.rolname, c.oid, 'select, insert, update, delete, truncate, references, trigger')
          or has_any_column_privilege(r.rolname, c.oid, 'select, insert, update, references')
        end
    union all
    select r.rolname || ' executes ' || p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    where n.nspname = 'private'
      and p.prokind in ('f', 'p', 'a', 'w')
      and not exists (select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege(r.rolname, p.oid, 'execute')
  ) x
$$;

select diag('extension-owned objects in private, excluded: ' || coalesce((
  select string_agg(c.relname, ', ')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  where n.nspname = 'private'), '(none)'));

select is(pg_temp.private_exposure(), '', 'anon and authenticated hold no privilege on any relation or function in private');

-- Fixtures, created by the migration role exactly as a later migration would.
create table private.zz_selfcheck_table (id int);
insert into private.zz_selfcheck_table values (1);
create function private.zz_selfcheck_fn() returns int language sql as $$ select 1 $$;

-- Control: the owner can read the fixture, so a 42501 below cannot be "table missing" (that
-- would be 42P01) or an empty table.
select is((select count(*) from private.zz_selfcheck_table)::int, 1, 'control: owner can read the private fixture');

-- Probe: act as a role, try the read and the function call, record SQLSTATEs (or 'ok').
create function pg_temp.probe(who text, claims text) returns void
language plpgsql as $$
declare
  t text := 'ok';
  f text := 'ok';
begin
  execute format('set local role %I', who);
  execute format('set local request.jwt.claims = %L', claims);
  begin
    perform 1 from private.zz_selfcheck_table;
  exception when others then t := sqlstate;
  end;
  begin
    perform private.zz_selfcheck_fn();
  exception when others then f := sqlstate;
  end;
  reset role;
  perform set_config('test.' || who || '_table', t, true);
  perform set_config('test.' || who || '_fn', f, true);
end $$;

select pg_temp.probe('anon', '{"role":"anon"}');
select pg_temp.probe('authenticated', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}');

select is(current_setting('test.anon_table'), '42501', 'anon is refused (42501) reading a private table');
select is(current_setting('test.authenticated_table'), '42501', 'authenticated is refused (42501) reading a private table');
select is(current_setting('test.anon_fn') || '/' || current_setting('test.authenticated_fn'), '42501/42501',
  'anon and authenticated are refused (42501) calling a private function');

-- Defence in depth: the defaults from the migration, not just the missing schema USAGE.
select ok(not has_table_privilege('anon', 'private.zz_selfcheck_table', 'select, insert, update, delete')
      and not has_table_privilege('authenticated', 'private.zz_selfcheck_table', 'select, insert, update, delete'),
  'default privileges: a new private table has no grants for anon or authenticated');

-- Self-check: opening the schema, table and function to anon makes the same probe succeed, so
-- the probe can tell a breach from a refusal.
grant usage on schema private to anon;
grant select on private.zz_selfcheck_table to anon;
grant execute on function private.zz_selfcheck_fn() to anon;
select pg_temp.probe('anon', '{"role":"anon"}');
select is(current_setting('test.anon_table') || '/' || current_setting('test.anon_fn'), 'ok/ok',
  'self-check: a granted read and call are detected as a breach');

-- Self-check: the catalogue detector sees the same grants.
select ok(pg_temp.private_exposure() like '%anon on zz_selfcheck_table (r)%'
      and pg_temp.private_exposure() like '%anon executes private.zz_selfcheck_fn()%',
  'self-check: the catalogue detector flags a granted table and function');

select * from finish();
rollback;
