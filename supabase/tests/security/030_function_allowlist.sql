-- 030_function_allowlist — plan §6 invariant 2 and §7 "Functions callable by anyone by default".
-- Self-contained: runs as plain SQL and under `supabase test db`.
-- Pass: "ok 1".."ok 9", "1..9", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

-- WHY (plan §6): anon is the whole public attack surface, so the only functions in `public` it
-- may execute are the two token-gated ones. The check uses effective privilege
-- (has_function_privilege, which includes PUBLIC and role inheritance), not ACL text. Functions
-- owned by an extension are excluded visibly, via pg_depend deptype 'e'.
-- R1-5 (done in slice 3, open item 23): the allowlist matches the EXACT signature, name plus
-- argument types, so an overload of an allowed name cannot ride on it. get_invite_preview(text) arrived
-- in slice 5 (invite_and_join): assertions 7 and 9 check it is open to anon and that an overload is flagged.
-- Scope is public only: widen it if the API schemas in supabase/config.toml ever change.
create function pg_temp.anon_open_functions() returns text
language sql stable as $$
  select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '')
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p', 'a', 'w')
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_proc'::regclass
        and d.objid = p.oid
        and d.deptype = 'e'              -- extension-owned: excluded on purpose
    )
    and format('%s(%s)', p.proname, pg_catalog.oidvectortypes(p.proargtypes))
        <> all (array['get_invite_preview(text)', 'get_shared_wishlist(text)'])
    and has_function_privilege('anon', p.oid, 'execute')
$$;

-- Visible record of what is excluded as extension-owned (information, not an assertion).
select diag('extension-owned functions in public, excluded: ' || coalesce((
  select string_agg(p.oid::regprocedure::text, ', ')
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public'), '(none)'));

-- 1. The real schema is clean.
select is(pg_temp.anon_open_functions(), '', 'anon can execute no function in public outside the allowlist');

-- 2-3. Defaults: a brand new function starts closed for both API roles.
create function public.zz_selfcheck_default() returns int language sql as $$ select 1 $$;
select ok(not has_function_privilege('anon', 'public.zz_selfcheck_default()', 'execute'),
  'default privileges: a new function in public is not executable by anon');
select ok(not has_function_privilege('authenticated', 'public.zz_selfcheck_default()', 'execute'),
  'default privileges: a new function in public is not executable by authenticated');

-- 4. Self-check: granting anon on a non-allowlisted function is caught.
grant execute on function public.zz_selfcheck_default() to anon;
select ok(pg_temp.anon_open_functions() like '%zz_selfcheck_default%',
  'self-check: detector flags a non-allowlisted function granted to anon');

-- 5. Self-check: PUBLIC grants count too, because anon inherits them.
revoke execute on function public.zz_selfcheck_default() from anon;
grant execute on function public.zz_selfcheck_default() to public;
select ok(pg_temp.anon_open_functions() like '%zz_selfcheck_default%',
  'self-check: detector flags a function executable by PUBLIC');

-- 6. The real allowlisted function is open to anon (the public view needs it) and is not flagged.
revoke execute on function public.zz_selfcheck_default() from public;
select ok(
  has_function_privilege('anon', 'public.get_shared_wishlist(text)', 'execute')
    and pg_temp.anon_open_functions() = '',
  'anon can execute public.get_shared_wishlist(text), and the detector does not flag it');

-- 7. The second allowlisted function, the invite preview (slice 5), is open to anon and not flagged.
select ok(
  has_function_privilege('anon', 'public.get_invite_preview(text)', 'execute')
    and pg_temp.anon_open_functions() = '',
  'anon can execute public.get_invite_preview(text), and the detector does not flag it');

-- 8. Self-check: an overload of an allowed name is flagged, because only the exact signature is allowed.
create function public.get_shared_wishlist(zz_selfcheck int) returns int language sql as $$ select 1 $$;
grant execute on function public.get_shared_wishlist(int) to anon;
select ok(pg_temp.anon_open_functions() like '%get_shared_wishlist(integer)%',
  'self-check: an overload get_shared_wishlist(int) granted to anon is flagged');

-- 9. Same for the invite preview: an overload of get_invite_preview is flagged.
create function public.get_invite_preview(zz_selfcheck int) returns int language sql as $$ select 1 $$;
grant execute on function public.get_invite_preview(int) to anon;
select ok(pg_temp.anon_open_functions() like '%get_invite_preview(integer)%',
  'self-check: an overload get_invite_preview(int) granted to anon is flagged');

select * from finish();
rollback;
