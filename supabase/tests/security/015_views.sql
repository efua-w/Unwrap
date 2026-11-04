-- 015_views — views, materialized views and foreign tables must not bypass RLS or `private`.
-- WHY (R1-2): a view runs with its OWNER's rights unless security_invoker is set, so a `public`
-- view over `private` or over an RLS table would hand visitors rows the policies hide (pair
-- secrecy, plan §5). Materialized views and foreign tables cannot have RLS at all, so the API
-- roles may not read them.
-- Self-contained: runs as plain SQL and under `supabase test db`.
-- Pass: "ok 1".."ok 6", "1..6", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

-- Scope is public and private only: widen it if the API schemas in supabase/config.toml ever
-- change (R1-5). Extension-owned objects are excluded visibly via pg_depend deptype 'e'.

-- A: views the API roles can SELECT without security_invoker (true or on).
create function pg_temp.definer_style_views() returns text
language sql stable as $$
  select coalesce(string_agg(format('%I.%I (%s)', n.nspname, c.relname, r.rolname), ', '
    order by n.nspname, c.relname, r.rolname), '')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where n.nspname in ('public', 'private')
    and c.relkind = 'v'
    and not exists (select 1 from unnest(coalesce(c.reloptions, '{}'::text[])) o
      where lower(o) in ('security_invoker=true', 'security_invoker=on'))
    and not exists (select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
    and (has_table_privilege(r.rolname, c.oid, 'select') or has_any_column_privilege(r.rolname, c.oid, 'select'))
$$;

-- B: materialized views and foreign tables the API roles can SELECT.
create function pg_temp.readable_matviews_and_foreign() returns text
language sql stable as $$
  select coalesce(string_agg(format('%I.%I (%s, %s)', n.nspname, c.relname, c.relkind, r.rolname), ', '
    order by n.nspname, c.relname, r.rolname), '')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where n.nspname in ('public', 'private')
    and c.relkind in ('m', 'f')
    and not exists (select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
    and (has_table_privilege(r.rolname, c.oid, 'select') or has_any_column_privilege(r.rolname, c.oid, 'select'))
$$;

-- Visible record of what is excluded as extension-owned (information, not an assertion).
select diag('extension-owned views, matviews and foreign tables in public/private, excluded: ' || coalesce((
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  where n.nspname in ('public', 'private') and c.relkind in ('v', 'm', 'f')), '(none)'));

-- 1-2. The real schemas are clean.
select is(pg_temp.definer_style_views(), '', 'no readable view in public or private lacks security_invoker');
select is(pg_temp.readable_matviews_and_foreign(), '', 'anon and authenticated can read no materialized view or foreign table');

-- Self-check fixtures (a definer-style view is the default: no security_invoker).
create view public.zz_selfcheck_view as select 1 as n;
create materialized view public.zz_selfcheck_matview as select 1 as n;
-- WHY: Supabase's default ACLs on `public` hand new tables and views to anon and authenticated
-- (the migration leaves table grants alone), so close the fixtures explicitly to start from a
-- known state.
revoke all on public.zz_selfcheck_view from public, anon, authenticated;
revoke all on public.zz_selfcheck_matview from public, anon, authenticated;

-- 3. A view nobody was granted on is not flagged, so the detector reads grants, not just existence.
select is(pg_temp.definer_style_views(), '', 'self-check: a definer-style view with no grant is not flagged');

-- 4. Granting anon on it is flagged.
grant select on public.zz_selfcheck_view to anon;
select ok(pg_temp.definer_style_views() like '%zz_selfcheck_view (anon)%',
  'self-check: a definer-style view granted to anon is flagged');

-- 5. The same view with security_invoker=true is not flagged, even though anon can still select it.
alter view public.zz_selfcheck_view set (security_invoker = true);
select ok(pg_temp.definer_style_views() = '' and has_table_privilege('anon', 'public.zz_selfcheck_view', 'select'),
  'self-check: the same view with security_invoker=true is not flagged');

-- 6. A materialized view granted to anon is flagged.
grant select on public.zz_selfcheck_matview to anon;
select ok(pg_temp.readable_matviews_and_foreign() like '%zz_selfcheck_matview (m, anon)%',
  'self-check: a materialized view granted to anon is flagged');

select * from finish();
rollback;
