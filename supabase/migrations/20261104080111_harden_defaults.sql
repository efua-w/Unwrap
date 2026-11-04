-- harden_defaults — first migration (slice 0b; plan §5 and §6 "Function hardening").
--
-- WHY: Postgres and Supabase open new objects by default (functions are executable by PUBLIC,
-- and Supabase's default ACLs hand tables and functions to anon/authenticated). Security here
-- must not depend on every later migration remembering to close things, so the defaults are
-- closed once, here, and each later object is opened explicitly, one grant at a time.
--
-- Scope: only the `private` and `public` schemas. This migration deliberately does not touch
-- auth, storage, extensions or graphql_public.
--
-- WHAT THIS MIGRATION CAN AND CAN'T CHANGE (hosted Supabase):
--   * Every ALTER DEFAULT PRIVILEGES below names FOR ROLE postgres explicitly, the role that runs
--     the migrations. Every table and function the app's migrations create is owned by
--     `postgres`, so those defaults are the ones that matter.
--   * Hosted Supabase also installs default ACLs owned by `supabase_admin` (global and for
--     schema public). `postgres` is not a member of that role and cannot alter them. They apply
--     only to objects `supabase_admin` creates (Supabase's own extensions and internals), never
--     to objects created by these migrations. The function allowlist test (030) still covers any
--     such function that lands in `public`, because it checks effective privileges, not ACL text.
--   * A schema-scoped default ACL is ADDED to the global one; it cannot subtract from it. So the
--     schema-scoped revokes below only remove entries that exist at schema scope. What actually
--     keeps `private` closed is that anon and authenticated have no USAGE on the schema at all
--     (tested in 020), with the default-privilege revokes as a second layer.
--   * Table grants in `public` (anon/authenticated) are not changed here. RLS is the control for
--     tables; each table's own migration grants exactly what it needs and ships its policies.

-- 1. The `private` schema: nobody reads it directly --------------------------------------------
-- WHY: assignments, gift marks and the email outbox live here (plan §5). The API exposes only
-- `public`, and only SECURITY DEFINER functions in `public` reach into `private` (GC-014, pair
-- secrecy). `if not exists` keeps this safe to re-run.
create schema if not exists private;

-- WHY: without USAGE a role cannot even name an object in the schema; the refusal is SQLSTATE
-- 42501 (insufficient_privilege), not an empty result. service_role is left out on purpose: the
-- outbox grant to it is made explicitly in slice 7.
revoke all on schema private from public, anon, authenticated;

-- WHY: objects later created in `private` by migrations (owned by postgres) must not start with
-- grants for the API roles.
alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on functions from public, anon, authenticated;

-- 2. Functions start closed everywhere ---------------------------------------------------------
-- WHY: Postgres grants EXECUTE to PUBLIC on every new function, and Supabase additionally grants
-- it to anon and authenticated. Together that makes every new function an API endpoint
-- (/rest/v1/rpc/...) callable by visitors (plan §7, "Functions callable by anyone by default").
-- Each function is opened with its own `grant execute`, to authenticated or, for the two
-- token-gated public functions only, to anon (invariant 2).

-- Existing functions in `public` (none are expected on a clean start; this is for safety).
revoke execute on all functions in schema public from public, anon, authenticated;

-- Future functions owned by postgres, in any schema: no PUBLIC/anon/authenticated EXECUTE.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;

-- Future functions owned by postgres in `public`: removes the schema-scoped grants Supabase sets
-- up for anon and authenticated.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
