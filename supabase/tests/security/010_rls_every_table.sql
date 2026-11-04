-- 010_rls_every_table — CLAUDE.md "Database rules": Row Level Security on every table, no exceptions.
-- Self-contained: runs as plain SQL (hosted SQL tool) and under `supabase test db`.
-- Pass: "ok 1".."ok 4", "1..4", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

-- WHY: the detector is a pg_temp function so no helper is left in `public` (it would break the
-- function allowlist test 030). Extension-owned tables are excluded visibly via pg_depend
-- deptype 'e', not by name.
create function pg_temp.tables_without_rls() returns text
language sql stable as $$
  select coalesce(string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname), '')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p')          -- ordinary and partitioned tables
    and not c.relispartition             -- a partition is covered by its parent
    and not c.relrowsecurity
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'              -- extension-owned: excluded on purpose
    )
$$;

-- Visible record of what is excluded as extension-owned (information, not an assertion).
-- Scope is public and private only: widen it if the API schemas in supabase/config.toml ever
-- change (R1-5).
select diag('extension-owned tables in public/private, excluded: ' || coalesce((
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')), '(none)'));

-- 1. The real schema is clean.
select is(pg_temp.tables_without_rls(), '', 'every table in public and private has RLS enabled');

-- Self-check fixtures. WHY: an empty schema passes test 1 vacuously. The explicit DISABLE is
-- there because some Supabase projects auto-enable RLS on new tables with an event trigger.
create table public.zz_selfcheck_public_no_rls (id int);
alter table public.zz_selfcheck_public_no_rls disable row level security;
create table private.zz_selfcheck_private_no_rls (id int);
alter table private.zz_selfcheck_private_no_rls disable row level security;

-- 2-3. The detector catches a breach in each schema.
select ok(pg_temp.tables_without_rls() like '%public.zz_selfcheck_public_no_rls%',
  'self-check: detector flags a public table without RLS');
select ok(pg_temp.tables_without_rls() like '%private.zz_selfcheck_private_no_rls%',
  'self-check: detector flags a private table without RLS');

-- 4. Enabling RLS clears the flags (the detector reads the right column).
alter table public.zz_selfcheck_public_no_rls enable row level security;
alter table private.zz_selfcheck_private_no_rls enable row level security;
select is(pg_temp.tables_without_rls(), '', 'self-check: enabling RLS clears the flags');

select * from finish();
rollback;
