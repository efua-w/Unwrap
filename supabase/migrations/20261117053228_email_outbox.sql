-- email_outbox — slice 7 (GC-026, GCO-005 email, GCO-007 E12, GCO-003 and GC-012 E08 and E09; plan §5, §6, §8;
-- owner decisions 2026-11-17 Q1-Q12 in docs/tasks/slice-7.md).
--
-- Tests written first: supabase/tests/security/220_email_outbox.sql, 230_email_invites.sql,
-- 240_notification_settings.sql (070 assertion 14 and 110 assertion 9 changed as approved, Q3).
-- Needs 20261114213838_join_requests first (it creates the functions replaced here).
--
-- WHAT THIS ADDS
--   private.email_outbox            one row per email to send. RLS on, NO grant to any role.
--   private.enqueue_email           the only writer. Checks the notification toggle and skips anonymised people.
--   private.cancel_pending_emails   stops a person's unsent rows for one exchange.
--   public.email_invites            who an organiser invited by email. The organiser of that exchange reads it.
--   public.send_email_invite        the organiser's Invite by email (writes the invite and one E06 row).
--   public.claim_due_emails         the sender's read: due rows with the one address to send to. service_role only.
--   public.mark_email_result        the sender's write-back. service_role only.
--   user_settings                   the four notify_* columns become writable by their owner.
--   join_exchange, request_to_join, approve_join_request, remove_member
--                                   create or replace: each enqueues its email (E07, E08, E09, E12).
--   private.enforce_rate_limit      create or replace: 'send_email_invite' is 20 an hour per organiser (Q7).
--   pg_net                          the extension the cron job calls the Edge Function with.
--
-- NOT HERE: the pg_cron job. It reads a Vault secret the owner sets, so the owner runs it after setting the
-- secret (docs/email-sender.md). Until then rows wait in the outbox and nothing is sent.
--
-- WHY no pair or reservation data can reach an email (core rule; GC-007, GCO-007): a payload is built by
-- enqueue_email from two fixed ids only (exchange_id, subject_user_id), never from a caller's json. No trigger
-- RPC here reads an assignment or a reservation, and none carries one into a row. The only address in a row is the
-- recipient's: a person's address is read from auth.users by claim_due_emails at send time and returned for
-- that row alone; the one typed address is E06's recipient_email, which the organiser typed.
-- WHY no cascades (never-do 8): foreign keys are NO ACTION.

create extension if not exists pg_net;

-- 1. The outbox ------------------------------------------------------------------------------------
create table private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  -- WHY E06..E12 and not free text: a typo can never become a template the sender does not know.
  template text not null
    constraint email_outbox_template_known check (template in ('E06', 'E07', 'E08', 'E09', 'E12')),
  -- WHY exactly one recipient (Q1): a person (their address is read at send time, so a changed address is
  -- honoured) or a typed address (E06 to someone who may have no account).
  recipient_user_id uuid references public.profiles (id),
  recipient_email text
    constraint email_outbox_recipient_email_shape check (
      recipient_email is null
      or (char_length(recipient_email) <= 254 and recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    ),
  exchange_id uuid references public.exchanges (id),
  -- WHY the sender is a column and not a name: E12 and E09 leave it null so they name no organiser (GCO-007).
  sender_id uuid references public.profiles (id),
  -- WHY fixed keys only: see the header. Enforced by enqueue_email and checked by test 220.
  payload jsonb not null default '{}'::jsonb,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  -- WHY a lease and a count (AC-13, exactly once): claim_due_emails sets claimed_until so two sender runs never
  -- take the same row; attempts caps the retries at 5.
  claimed_until timestamptz,
  attempts integer not null default 0 constraint email_outbox_attempts_not_negative check (attempts >= 0),
  -- WHY a code and never a message: provider errors can echo an address (no addresses in logs).
  last_error_code text constraint email_outbox_error_code_length check (char_length(last_error_code) <= 64),
  -- WHY nullable and unique when set: later slices (reminders, nudges) send one row per fact.
  dedupe_key text,
  created_at timestamptz not null default now(),
  constraint email_outbox_one_recipient check ((recipient_user_id is null) <> (recipient_email is null)),
  constraint email_outbox_not_sent_and_cancelled check (sent_at is null or cancelled_at is null)
);

create unique index email_outbox_dedupe_idx on private.email_outbox (dedupe_key) where dedupe_key is not null;
-- WHY partial: the sender only reads unsent, uncancelled rows, in send order.
create index email_outbox_due_idx on private.email_outbox (send_after, id)
  where sent_at is null and cancelled_at is null;
create index email_outbox_recipient_pending_idx on private.email_outbox (recipient_user_id, exchange_id)
  where sent_at is null and cancelled_at is null;

alter table private.email_outbox enable row level security;
-- WHY no grant to service_role either (AC-1): the sender works through claim_due_emails and mark_email_result,
-- so no role can read or edit the outbox with a query.
revoke all on private.email_outbox from public, anon, authenticated, service_role;

-- 2. The writer ------------------------------------------------------------------------------------
-- Returns the new row's id, or null when nothing was queued (anonymised or unknown person, toggle off, or a
-- repeated dedupe key).
-- WHY the toggle is checked here and not in each caller (GC-026): E07 and E08 are "Someone joins". E09 and E12
-- are always sent (Q8; GCO-007 "always sent, can't be turned off"). E06 goes to a typed address, which has no toggle.
-- WHY anonymised people are skipped (GC-028): their address is gone and nothing should be sent to them.
create function private.enqueue_email(
  p_template text,
  p_recipient_user uuid,
  p_recipient_email text,
  p_exchange uuid,
  p_sender uuid,
  p_subject uuid,
  p_dedupe_key text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_recipient_user is not null then
    if not exists (
      select 1 from public.profiles p where p.id = p_recipient_user and p.anonymised_at is null
    ) then
      return null;
    end if;
    if p_template in ('E07', 'E08') and not coalesce((
      select s.notify_someone_joins from public.user_settings s where s.user_id = p_recipient_user
    ), true) then
      return null;
    end if;
  end if;

  insert into private.email_outbox (template, recipient_user_id, recipient_email, exchange_id, sender_id, payload, dedupe_key)
  values (
    p_template, p_recipient_user, p_recipient_email, p_exchange, p_sender,
    jsonb_strip_nulls(jsonb_build_object('exchange_id', p_exchange, 'subject_user_id', p_subject)),
    p_dedupe_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end $$;

-- WHY scoped to one exchange: a removal makes that exchange's unsent emails stale (an approval for a place the
-- person no longer has); emails about their other exchanges stay valid. Sent rows are never touched.
create function private.cancel_pending_emails(p_recipient uuid, p_exchange uuid) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null
   where o.recipient_user_id = p_recipient
     and o.exchange_id = p_exchange
     and o.sent_at is null
     and o.cancelled_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.cancel_pending_emails(uuid, uuid) from public, anon, authenticated;

-- 3. Notification toggles (GC-026) -----------------------------------------------------------------
-- WHY these four columns only: user_id, created_at and updated_at stay closed. The row policy already limits
-- an update to the person's own row (070).
grant update (notify_names_drawn, notify_someone_joins, notify_join_by_reminder, notify_event_reminder)
  on public.user_settings to authenticated;

-- 4. Rate limit (Q7) -------------------------------------------------------------------------------
-- Same function as 20261114213838_join_requests plus one action. WHY create or replace: owner and grants stay.
create or replace function private.enforce_rate_limit(p_action text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max integer;
begin
  if v_uid is null then
    return;
  end if;
  v_max := case p_action
    when 'create_exchange' then 10
    when 'create_wishlist' then 30
    when 'create_item' then 300
    when 'request_to_join' then 20
    when 'send_email_invite' then 20
  end;
  if v_max is null then
    raise exception 'unknown rate limit action' using errcode = '22023';
  end if;
  if not private.hit_rate_limit(p_action || ':' || v_uid::text, v_max, interval '1 hour') then
    raise exception 'rate limited' using errcode = 'P0429';
  end if;
end $$;

-- 5. Invites by email (GCO-005) --------------------------------------------------------------------
create table public.email_invites (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges (id),
  -- WHY lower-cased and trimmed on the way in: the same address typed twice is the same address.
  -- WHY not called "email": tests 060 and 210 assert that no column in `public` has "email" in its name. This
  -- table holds only addresses an organiser typed, readable by that organiser alone; the name keeps those
  -- assertions as written. (Raised with the owner in the slice 7 builder handoff.)
  invited_address text not null
    constraint email_invites_address_shape check (
      char_length(invited_address) <= 254 and invited_address ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  sent_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index email_invites_exchange_idx on public.email_invites (exchange_id, created_at desc);

alter table public.email_invites enable row level security;
revoke all on public.email_invites from public, anon, authenticated;
-- WHY select only: send_email_invite is the one writer. The organiser may read back the addresses they typed.
grant select (id, exchange_id, invited_address, created_at) on public.email_invites to authenticated;

-- WHY the organiser of that exchange and nobody else (AC-11): not even another member of the exchange, not
-- the person invited. Zero rows, not an error, for everyone else.
create policy email_invites_select_organiser on public.email_invites
  for select to authenticated
  using (public.is_organiser(exchange_id));

-- Organiser only, one answer (P0002) for everyone else. Refusals are 22023 with the reason as the hint:
-- email (not an address), cancelled, closed (the exchange is complete or the gift day has passed), member (that
-- address is an active member), full (100 active members). Nothing is written on a refusal.
-- WHY the same result whether or not the address has an account (AC-10): the only account lookup is "is this
-- address an ACTIVE MEMBER of this exchange". The organiser may already read members' addresses (GCO-007), so the
-- refusal tells them nothing new, and an address with an account that is not in the exchange is treated exactly
-- like one with none. E06 ignores the invitee's toggles.
-- WHY the exchange is locked: the 100th place and a burst of invites are serialised.
-- WHY the rate limit is hit last: a refused invite never counts, and a P0429 rolls its count back with it.
-- WHY joining_closed is allowed: the link still works for asking to join (GC-009).
create function public.send_email_invite(p_exchange uuid, p_email text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  e public.exchanges%rowtype;
  v_state public.exchange_status;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into e from public.exchanges where id = p_exchange and organiser_id = v_uid for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;

  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = '22023', hint = 'email';
  end if;

  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'invites closed' using errcode = '22023', hint = 'closed';
  end if;

  if exists (
    select 1
      from public.exchange_members m
      join auth.users u on u.id = m.user_id
     where m.exchange_id = e.id and m.state = 'active' and lower(u.email::text) = v_email
  ) then
    raise exception 'already a member' using errcode = '22023', hint = 'member';
  end if;
  if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
    raise exception 'exchange full' using errcode = '22023', hint = 'full';
  end if;

  perform private.enforce_rate_limit('send_email_invite');

  insert into public.email_invites (exchange_id, invited_address, sent_by) values (e.id, v_email, v_uid);
  perform private.enqueue_email('E06', null, v_email, e.id, v_uid, null);
end $$;

-- 6. The sender's two functions (AC-1, AC-13) ------------------------------------------------------
-- WHY in public and not private: the Edge Function reaches them through the API as service_role, and only
-- `public` is exposed. WHY service_role only: a signed-in person or a visitor gets 42501.
--
-- claim_due_emails returns unsent, uncancelled rows that are due, and leases each for 10 minutes so another run
-- skips it. Each row carries only what the template needs, resolved here:
--   to_email       the recipient's own address (their auth address, or E06's typed address). Never another's.
--   to_name        the recipient's display name (null for E06).
--   to_timezone    the recipient's zone; an invitee with no account gets the organiser's zone (Q9).
--   exchange_name, other_name (E07 and E08: the person who joined or asked; E06: the inviter; else null),
--   invite_token (E06 only). Nothing about a draw, a pair, a reservation, a wishlist or an item.
-- WHY undeliverable rows are cancelled here (GC-028): a recipient who was anonymised, or has no address, is
-- never sent to. A row that has used its 5 attempts without a result is cancelled so it cannot linger.
create function public.claim_due_emails(p_limit integer default 20)
returns table (
  id uuid,
  template text,
  to_email text,
  to_name text,
  to_timezone text,
  exchange_id uuid,
  exchange_name text,
  other_name text,
  invite_token text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = 'no_recipient'
   where o.sent_at is null and o.cancelled_at is null and o.send_after <= now()
     and o.recipient_user_id is not null
     and (
       exists (select 1 from public.profiles p where p.id = o.recipient_user_id and p.anonymised_at is not null)
       or not exists (
         select 1 from auth.users u where u.id = o.recipient_user_id and coalesce(u.email, '') <> ''
       )
     );
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = coalesce(o.last_error_code, 'gave_up')
   where o.sent_at is null and o.cancelled_at is null
     and o.attempts >= 5 and (o.claimed_until is null or o.claimed_until <= now());

  return query
  with due as (
    select o.id
      from private.email_outbox o
     where o.sent_at is null and o.cancelled_at is null and o.send_after <= now()
       and (o.claimed_until is null or o.claimed_until <= now())
       and o.attempts < 5
     order by o.send_after, o.id
     limit least(greatest(coalesce(p_limit, 20), 1), 50)
     for update skip locked
  ),
  claimed as (
    update private.email_outbox o
       set attempts = o.attempts + 1, claimed_until = now() + interval '10 minutes'
      from due
     where o.id = due.id
    returning o.*
  )
  select c.id, c.template,
         coalesce(u.email::text, c.recipient_email),
         p.display_name,
         coalesce(s.timezone, x.organiser_tz, 'Africa/Lagos'),
         c.exchange_id,
         x.name,
         other.display_name,
         case when c.template = 'E06' then x.invite_token end,
         c.attempts
    from claimed c
    left join auth.users u on u.id = c.recipient_user_id
    left join public.profiles p on p.id = c.recipient_user_id
    left join public.user_settings s on s.user_id = c.recipient_user_id
    left join public.exchanges x on x.id = c.exchange_id
    left join public.profiles other on other.id = case
      when c.template in ('E07', 'E08') then (c.payload ->> 'subject_user_id')::uuid
      when c.template = 'E06' then c.sender_id
    end
   order by c.send_after, c.id;
end $$;

-- p_error_code null means sent. WHY only unsent, uncancelled rows move: a result for a row that was cancelled in
-- the meantime (a removal) or already sent is ignored. A failure keeps the row for a retry after a growing wait,
-- or cancels it once its fifth attempt has failed. The code is cut to 64 characters; never pass a message.
create function public.mark_email_result(p_id uuid, p_error_code text default null) returns void
language sql
security definer
set search_path = ''
as $$
  update private.email_outbox o
     set sent_at = case when p_error_code is null then now() end,
         last_error_code = left(p_error_code, 64),
         claimed_until = case
           when p_error_code is null or o.attempts >= 5 then null
           else now() + o.attempts * interval '2 minutes'
         end,
         cancelled_at = case when p_error_code is not null and o.attempts >= 5 then now() end
   where o.id = p_id and o.sent_at is null and o.cancelled_at is null
$$;

revoke execute on function public.send_email_invite(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_due_emails(integer) from public, anon, authenticated, service_role;
revoke execute on function public.mark_email_result(uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.send_email_invite(uuid, text) to authenticated;
grant execute on function public.claim_due_emails(integer) to service_role;
grant execute on function public.mark_email_result(uuid, text) to service_role;

-- 7. The four trigger RPCs enqueue their email -----------------------------------------------------
-- Each body is the latest one (join_exchange: 20261114213747_activity_events; the other three:
-- 20261114213838_join_requests) plus the lines marked NEW. Nothing else changes.

-- E07 "{name} joined {exchange}" to the organiser, on a real insert only (the same condition as the activity event).
create or replace function public.join_exchange(p_token text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_id uuid;
  v_inserted boolean := false;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  select * into e from public.exchanges where invite_token = p_token for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  select m.id into v_id
    from public.exchange_members m
   where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active';

  if v_id is null then
    v_state := private.exchange_status(e.id);
    if v_state = 'cancelled' then
      raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
    elsif v_state <> 'open' then
      raise exception 'joining closed' using errcode = '22023', hint = 'closed';
    end if;
    if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
      raise exception 'exchange full' using errcode = '22023', hint = 'full';
    end if;
    if (
      select m.state from public.exchange_members m
       where m.exchange_id = e.id and m.user_id = v_uid
       order by m.joined_at desc, m.left_at desc nulls first
       limit 1
    ) = 'removed' then
      raise exception 'removed from exchange' using errcode = '22023', hint = 'removed';
    end if;
    if e.approval_required then
      raise exception 'approval required' using errcode = '22023', hint = 'approval';
    end if;

    begin
      insert into public.exchange_members (exchange_id, user_id, taking_part, state)
      values (e.id, v_uid, true, 'active')
      returning id into v_id;
      v_inserted := true;
    exception when unique_violation then
      select m.id into v_id
        from public.exchange_members m
       where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active';
    end;
  end if;

  if v_inserted then
    perform private.add_activity_event(e.organiser_id, e.id, 'member_joined', v_uid);
    -- NEW (E07). WHY the joiner is the subject and sender: the organiser reads "{name} joined {exchange}".
    perform private.enqueue_email('E07', e.organiser_id, null, e.id, v_uid, v_uid);
  end if;

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, clock_timestamp())
   where id = v_uid;

  return v_id;
end $$;

-- E08 "{name} wants to join {exchange}" to the organiser, once per new request (the idempotent 'pending' answer
-- returns before the insert, so asking again sends nothing).
create or replace function public.request_to_join(p_token text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_removed boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  select * into e from public.exchanges where invite_token = p_token for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.exchange_members m
    where m.exchange_id = e.id and m.user_id = v_uid and m.state = 'active'
  ) then
    raise exception 'already a member' using errcode = '22023', hint = 'member';
  end if;

  if exists (
    select 1 from public.join_requests r
    where r.exchange_id = e.id and r.user_id = v_uid and r.status = 'pending'
  ) then
    update public.profiles
       set onboarded_at = coalesce(onboarded_at, clock_timestamp())
     where id = v_uid;
    return 'pending';
  end if;

  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'joining closed' using errcode = '22023', hint = 'closed';
  end if;
  if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
    raise exception 'exchange full' using errcode = '22023', hint = 'full';
  end if;

  v_removed := coalesce((
    select m.state = 'removed' from public.exchange_members m
     where m.exchange_id = e.id and m.user_id = v_uid
     order by m.joined_at desc, m.left_at desc nulls first
     limit 1
  ), false);
  if v_state = 'open' and not e.approval_required and not v_removed then
    raise exception 'join directly' using errcode = '22023', hint = 'can_join';
  end if;

  perform private.enforce_rate_limit('request_to_join');

  insert into public.join_requests (exchange_id, user_id) values (e.id, v_uid);
  perform private.add_activity_event(e.organiser_id, e.id, 'join_requested', v_uid);
  -- NEW (E08). WHY the asker is the subject and sender: the organiser reads "{name} wants to join {exchange}".
  perform private.enqueue_email('E08', e.organiser_id, null, e.id, v_uid, v_uid);

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, clock_timestamp())
   where id = v_uid;

  return 'pending';
end $$;

-- E09 to the person let in. WHY always sent (Q8) and no sender: the person is told they are in; the email names no
-- organiser. WHY no E07 to the organiser (Q8): they approved it themselves, as with the activity event (slice 6 Q11).
create or replace function public.approve_join_request(p_request uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  r public.join_requests%rowtype;
  v_state public.exchange_status;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select x.* into e
    from public.exchanges x
    join public.join_requests jr on jr.exchange_id = x.id
   where jr.id = p_request and x.organiser_id = v_uid
     for update of x;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  select * into r from public.join_requests where id = p_request for update;
  if r.status <> 'pending' then
    raise exception 'already decided' using errcode = '22023', hint = 'decided';
  end if;

  select m.id into v_id
    from public.exchange_members m
   where m.exchange_id = e.id and m.user_id = r.user_id and m.state = 'active';

  if v_id is null then
    v_state := private.exchange_status(e.id);
    if v_state = 'cancelled' then
      raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
    elsif v_state not in ('open', 'joining_closed') then
      raise exception 'joining closed' using errcode = '22023', hint = 'closed';
    end if;
    if (select count(*) from public.exchange_members m where m.exchange_id = e.id and m.state = 'active') >= 100 then
      raise exception 'exchange full' using errcode = '22023', hint = 'full';
    end if;
    insert into public.exchange_members (exchange_id, user_id, taking_part, state)
    values (e.id, r.user_id, true, 'active')
    returning id into v_id;
  end if;

  update public.join_requests set status = 'approved', decided_at = now() where id = r.id;
  -- NEW (E09).
  perform private.enqueue_email('E09', r.user_id, null, e.id, null, null);
  return v_id;
end $$;

-- E12 to the removed person. WHY always sent (GCO-007) and with no sender, subject or reason: the email says
-- "You're no longer in {exchange}" and names no organiser. WHY the person's other unsent rows for this exchange
-- are cancelled first: an approval or reminder still waiting would contradict it.
create or replace function public.remove_member(p_member uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  m public.exchange_members%rowtype;
  v_state public.exchange_status;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select x.* into e
    from public.exchanges x
    join public.exchange_members mm on mm.exchange_id = x.id
   where mm.id = p_member and x.organiser_id = v_uid
     for update of x;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  select * into m from public.exchange_members where id = p_member for update;
  if m.user_id = e.organiser_id then
    raise exception 'cannot remove the organiser' using errcode = '22023', hint = 'organiser';
  end if;
  if m.state <> 'active' then
    raise exception 'not an active member' using errcode = '22023', hint = 'inactive';
  end if;
  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'removal closed' using errcode = '22023', hint = 'closed';
  end if;
  update public.exchange_members set state = 'removed', left_at = now() where id = m.id;
  -- NEW (E12).
  perform private.cancel_pending_emails(m.user_id, e.id);
  perform private.enqueue_email('E12', m.user_id, null, e.id, null, null);
end $$;
