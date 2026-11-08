-- profiles_user_settings — slice 1 (GC-003, GC-005, GC-024; plan §5 "profiles" and "user_settings").
--
-- Tests written first: supabase/tests/security/060_profiles.sql, 070_user_settings.sql,
-- 080_new_user_trigger.sql.
--
-- WHAT THIS ADDS
--   public.profiles       1:1 with auth.users: display name, avatar path, photo-prompt flag,
--                         anonymised_at. NO email column: the organiser must never see emails, and
--                         the address lives only in auth.users, which the API does not expose.
--   public.user_settings  time zone (captured on sign-in, plan §5) and the four notification toggles.
--   private.handle_new_user  creates both rows when an auth user is created.
--   private.check_timezone / private.set_updated_at  small row triggers.
--
-- ACCESS (CLAUDE.md "Database rules"): RLS on, every grant explicit. A person reads and updates
-- only their own row, and only the columns the app needs in this slice. Reads by people who share
-- an exchange (plan §5 "profiles ... people sharing an active exchange") arrive with exchanges.

-- 1. Tables ---------------------------------------------------------------------------------------

-- WHY no ON DELETE CASCADE on profiles.id: a profile must outlive its auth user so account
-- deletion can anonymise it (anonymised_at) instead of silently erasing the name from other
-- people's exchanges (GC-028). Deleting an auth user that still has a profile is refused.
create table public.profiles (
  id uuid primary key references auth.users (id),
  -- WHY 50: owner decision 2026-11-04. char_length counts code points, so an emoji is one.
  display_name text not null
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 50)
    constraint profiles_display_name_trimmed check (display_name = btrim(display_name)),
  avatar_path text,
  photo_prompt_dismissed_at timestamptz,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- WHY cascade here (and not on profiles): settings hold no identity worth keeping.
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Africa/Lagos'
    constraint user_settings_timezone_length check (char_length(timezone) between 1 and 64),
  notify_names_drawn boolean not null default true,
  notify_someone_joins boolean not null default true,
  notify_join_by_reminder boolean not null default true,
  notify_event_reminder boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Row Level Security and grants -----------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

-- WHY revoke first: Supabase's default ACLs hand new tables to anon and authenticated (see
-- harden_defaults). Start from nothing, then grant exactly what is used.
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.user_settings from public, anon, authenticated;

grant select on public.profiles to authenticated;
-- WHY only display_name: avatar_path arrives with photos (slice 17), the photo-prompt flag with
-- the prompt, anonymised_at is written only by account deletion (slice 16).
grant update (display_name) on public.profiles to authenticated;

grant select on public.user_settings to authenticated;
-- WHY only timezone: it is recorded on every sign-in. The toggles get their grant in slice 7.
grant update (timezone) on public.user_settings to authenticated;

-- WHY (select auth.uid()): evaluated once per statement, not once per row.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy user_settings_select_own on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_settings_update_own on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3. Trigger functions (all in `private`, none executable by the API roles) -----------------------

-- WHY: the time zone is client-supplied. Postgres is the final judge: `AT TIME ZONE` raises 22023
-- (invalid_parameter_value) for a name it does not know, so a bad zone can never be stored.
-- SECURITY INVOKER: it only reads its own argument.
create function private.check_timezone() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
end $$;

-- WHY clock_timestamp(): now() is frozen for the whole transaction, so a later update in the same
-- transaction would not move updated_at.
create function private.set_updated_at() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- WHY SECURITY DEFINER: it runs as part of GoTrue's insert into auth.users, which has no rights on
-- public.profiles. search_path is empty and every name is schema-qualified (plan §6).
-- WHY it requires first_name and never falls back to the email: a name taken from the address
-- would show an email in other people's exchanges (organiser never sees emails). Sign-up always
-- sends first_name; a sign-in that creates no user never reaches this trigger. If the name is
-- missing the whole user insert fails (23514), so no nameless account can exist.
create function private.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
begin
  if jsonb_typeof(v_meta -> 'first_name') is distinct from 'string' then
    raise exception 'first_name is required' using errcode = '23514';
  end if;
  v_name := btrim(v_meta ->> 'first_name');
  if char_length(v_name) not between 1 and 50 then
    raise exception 'first_name must be 1 to 50 characters' using errcode = '23514';
  end if;

  insert into public.profiles (id, display_name) values (new.id, v_name);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

-- WHY explicit: harden_defaults already closes new functions, but a trigger function must never
-- depend on that alone. (Trigger firing does not check EXECUTE, so nothing here needs a grant.)
revoke execute on function private.check_timezone() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- 4. Triggers --------------------------------------------------------------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function private.set_updated_at();

create trigger user_settings_check_timezone
  before insert or update of timezone on public.user_settings
  for each row execute function private.check_timezone();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
