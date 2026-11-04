-- 040_definer_search_path — plan §6: every SECURITY DEFINER function sets search_path = ''.
-- WHY: a definer function runs with its owner's rights; without a fixed search_path a caller can
-- shadow an unqualified name with their own object and run code as the owner.
-- Self-contained: runs as plain SQL and under `supabase test db`.
-- Pass: "ok 1".."ok 5", "1..5", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

-- Extension-owned functions are excluded visibly via pg_depend deptype 'e'. Postgres stores
-- `set search_path = ''` in proconfig as the element search_path="" (proved by the last self-check).
create function pg_temp.bad_definers() returns text
language sql stable as $$
  select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '')
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosecdef
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_proc'::regclass
        and d.objid = p.oid
        and d.deptype = 'e'              -- extension-owned: excluded on purpose
    )
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
      where c in ('search_path=""', 'search_path=')
    )
$$;

-- Visible record of what is excluded as extension-owned (information, not an assertion).
-- Scope is public and private only: widen it if the API schemas in supabase/config.toml ever
-- change (R1-5).
select diag('extension-owned SECURITY DEFINER functions in public/private, excluded: ' || coalesce((
  select string_agg(p.oid::regprocedure::text, ', ')
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  where n.nspname in ('public', 'private') and p.prosecdef), '(none)'));

-- 1. The real schemas are clean.
select is(pg_temp.bad_definers(), '', 'every SECURITY DEFINER function in public and private sets search_path to empty');

-- Self-check fixtures.
create function public.zz_selfcheck_bad_none() returns int language sql security definer as $$ select 1 $$;
create function public.zz_selfcheck_bad_public() returns int language sql security definer set search_path = public as $$ select 1 $$;
create function private.zz_selfcheck_bad_private() returns int language sql security definer as $$ select 1 $$;
create function public.zz_selfcheck_good() returns int language sql security definer set search_path = '' as $$ select 1 $$;

-- 2-4. The detector catches each kind of breach.
select ok(pg_temp.bad_definers() like '%zz_selfcheck_bad_none%', 'self-check: flags a definer with no search_path');
select ok(pg_temp.bad_definers() like '%zz_selfcheck_bad_public%', 'self-check: flags a definer with search_path = public');
select ok(pg_temp.bad_definers() like '%zz_selfcheck_bad_private%', 'self-check: flags a definer in private');

-- 5. A correct definer is not flagged. WHY: this also proves the proconfig string format the
-- detector expects, so a wrong assumption fails here instead of silently passing.
select ok(pg_temp.bad_definers() not like '%zz_selfcheck_good%', 'self-check: a definer with search_path = empty is not flagged');

select * from finish();
rollback;
