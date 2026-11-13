-- exchanges_visible — audit finding 6 (2026-11-13; GC-008, GC-013, GCO-004).
--
-- Test written first: supabase/tests/security/140_exchanges_visible.sql.
--
-- WHY: public.exchanges has column grants (invite_token is readable by nobody through the API), so the
-- app had to name its columns in a string that must match those grants. When they drift, every read
-- fails with 42501 and every exchange page shows its error state. The app now reads this view with
-- `select *`. The view lists the readable columns once, here, and test 140 fails if it names a column
-- signed-in people may not read.
--
-- WHY security_invoker: the caller's column grants and the Row Level Security on public.exchanges
-- apply exactly as before (members and the organiser only). A definer-style view would bypass them;
-- test 015 refuses one.
--
-- WHEN A LATER SLICE ADDS A READABLE COLUMN to public.exchanges: grant it, then `create or replace` this
-- view with the column added at the end. No access rule changes here.
create view public.exchanges_visible with (security_invoker = true) as
select
  id, organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, organiser_tz,
  approval_required, tint, cancelled_at, completed_at, reopened_join_by_at, draw_blocked_reason,
  draw_round, created_at, updated_at, gift_day
from public.exchanges;

-- WHY revoke first: Supabase's default ACLs hand new views in `public` to anon and authenticated.
revoke all on public.exchanges_visible from public, anon, authenticated;
grant select on public.exchanges_visible to authenticated;
