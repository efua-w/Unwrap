-- onboarded_at — audit finding 3 (2026-11-13; GC-003, GC-004, GC-005).
--
-- Test written first: supabase/tests/security/150_onboarded_at.sql.
--
-- WHY: whether a person still needs Profile setup was guessed in the browser, from Supabase's
-- email_confirmed_at and last_sign_in_at being under a second apart, and the guess was sent to the
-- server. Now the server reads this column: a signed-in person without it is sent to Profile setup on
-- any signed-in page (lib/auth/session.ts). An abandoned sign-up that later logs in still lands there.
--
-- WHY no column grant: nobody writes it directly. Saving the display name, which is what Profile setup
-- does, sets it once (trigger below). Reading it comes with the existing table-level select grant, under
-- the existing own-row policy.

alter table public.profiles add column onboarded_at timestamptz;

-- WHY confirmed accounts only: a person with a confirmed address has been through Verify and, before
-- this change, straight on to Profile setup. An unconfirmed account (an abandoned sign-up) has not.
update public.profiles p
   set onboarded_at = p.created_at
  from auth.users u
 where u.id = p.id and u.email_confirmed_at is not null;

-- WHY SECURITY INVOKER: it only sets a value on the row being written; the caller already has the right
-- to write display_name on their own row. coalesce keeps the first time on later renames.
create function private.set_onboarded_at() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.onboarded_at := coalesce(old.onboarded_at, clock_timestamp());
  return new;
end $$;

revoke execute on function private.set_onboarded_at() from public, anon, authenticated;

-- WHY `update of display_name`: it fires whenever display_name is in the SET list, even when the value is
-- unchanged, so Continue on Profile setup with the sign-up name kept still counts.
create trigger profiles_set_onboarded_at
  before update of display_name on public.profiles
  for each row execute function private.set_onboarded_at();
