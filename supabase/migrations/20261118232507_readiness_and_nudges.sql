-- readiness_and_nudges — slice 8 (GCO-006 readiness, GCO-008 nudge, E10; plan §5-§8; owner decisions 2026-11-18
-- 1-4 in docs/tasks/slice-8.md).
--
-- Tests written first: supabase/tests/security/260_readiness.sql and 270_nudges.sql (new), 220_email_outbox.sql
-- (E10 is a known template; the writer has a new signature; the claim has two new columns).
-- Needs 20261117171053_email_outbox_details first (it creates the claim replaced here).
--
-- WHAT THIS ADDS
--   private.member_has_list      D1  the one rule for "this member has a wishlist in": get_participants and
--                                    get_readiness both use it, so the two screens cannot disagree.
--   private.recently_nudged      helper: was this person nudged in this exchange in the last 12 hours (any sender)?
--   public.get_readiness         D2  the organiser's read: who is taking part, whether a list is in, whether they
--                                    were nudged recently. Booleans and first names only.
--   E10                          D3  a known outbox template.
--   two partial indexes          D4  the two nudge limit lookups.
--   private.enqueue_email        D5  gains p_send_after (the old 7-argument function is dropped).
--   public.send_nudge            D6  the organiser's Nudge: skips, limits, queues one E10 per person.
--   public.undo_nudge            D7  stops the caller's unsent nudges in one exchange.
--   public.claim_due_emails      D8  carries E10's organiser name and draw mode and time; cancels an E10 that is no
--                                    longer needed ('not_needed').
--
-- WHY no pair or reservation data (core rule): nothing here reads an assignment or a reservation. The only
-- wishlist read is "is a list attached, and is it more than an empty ideas list" (an exists() on live items),
-- exactly what get_participants already did. No list name, item, price or reservation leaves the database.
-- WHY the organiser only (GCO-006, GCO-008): `e.organiser_id = auth.uid()` is in every WHERE clause, so a member,
-- a requester, a removed or left person, an outsider and another exchange's organiser get zero rows (reads) or P0002
-- (writes) and learn nothing. A visitor has no execute grant (42501).
-- WHY no activity event (owner decision 2026-11-18 4): a nudge is between the organiser and one person.
-- WHY the draw exists nowhere yet (slice 10): "before the draw" is the exchange being open or joining closed, the
-- same states in which remove_member works.

-- 1. D1: one rule for "has a list in" -------------------------------------------------------------------
-- The body is the expression get_participants had since organiser_emails (owner decision 2026-11-16 Q1): a list is
-- attached, and it is not an exchange ideas list with no live items. An empty real wishlist, and a deleted list the
-- giver keeps (owner decision 2026-11-18 4), count as in.
create function private.member_has_list(p_wishlist uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wishlists w
    where w.id = p_wishlist
      and (
        w.kind <> 'exchange_ideas'
        or w.deleted_at is not null
        or exists (select 1 from public.wishlist_items i where i.wishlist_id = w.id and i.deleted_at is null)
      )
  )
$$;

revoke execute on function private.member_has_list(uuid) from public, anon, authenticated;

-- Same signature and result as before, so create or replace keeps the owner and the grants.
create or replace function public.get_participants(p_exchange uuid)
returns table (
  member_id uuid,
  display_name text,
  is_me boolean,
  is_organiser boolean,
  taking_part boolean,
  email text,
  has_wishlist boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, p.display_name, (m.user_id = auth.uid()), (m.user_id = e.organiser_id), m.taking_part,
         case when m.user_id = auth.uid() then null else u.email::text end,
         private.member_has_list(m.attached_wishlist_id)
  from public.exchange_members m
  join public.exchanges e on e.id = m.exchange_id
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.exchange_id = p_exchange
    and m.state = 'active'
    and e.organiser_id = auth.uid()
  order by (m.user_id = e.organiser_id) desc, m.joined_at, m.id
$$;

-- 2. E10 is a known template (D3) ------------------------------------------------------------------------
alter table private.email_outbox drop constraint email_outbox_template_known;
alter table private.email_outbox
  add constraint email_outbox_template_known check (template in ('E06', 'E07', 'E08', 'E09', 'E10', 'E12'));

-- 3. D4: the two limit lookups ---------------------------------------------------------------------------
-- WHY partial on E10: the 12-hour skip reads by (recipient, exchange) and the hourly cap by sender, and neither
-- should scan the other templates.
create index email_outbox_nudge_recipient_idx on private.email_outbox (recipient_user_id, exchange_id, created_at)
  where template = 'E10';
create index email_outbox_nudge_sender_idx on private.email_outbox (sender_id, created_at)
  where template = 'E10';

-- 4. The 12-hour skip ------------------------------------------------------------------------------------
-- WHY any sender (owner decision 2026-11-18 4): a person should not get two nudges because the exchange changed
-- organiser. WHY cancelled rows do not count: an undone nudge never reached anyone.
create function private.recently_nudged(p_user uuid, p_exchange uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.email_outbox o
    where o.template = 'E10'
      and o.recipient_user_id = p_user
      and o.exchange_id = p_exchange
      and o.cancelled_at is null
      and o.created_at > now() - interval '12 hours'
  )
$$;

revoke execute on function private.recently_nudged(uuid, uuid) from public, anon, authenticated;

-- 5. D2: readiness (GCO-006) -----------------------------------------------------------------------------
-- One row per ACTIVE member who is taking part, organiser first, then join order. WHY the member id and a first
-- name and nothing else: the screen needs "who is missing" and "who can be nudged". No address, no person id, no list
-- name and no item. is_me is there so the organiser's own row is counted but never offered a nudge.
create function public.get_readiness(p_exchange uuid)
returns table (
  member_id uuid,
  display_name text,
  is_me boolean,
  has_wishlist boolean,
  nudged_recently boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, p.display_name, (m.user_id = auth.uid()),
         private.member_has_list(m.attached_wishlist_id),
         private.recently_nudged(m.user_id, m.exchange_id)
  from public.exchange_members m
  join public.exchanges e on e.id = m.exchange_id
  join public.profiles p on p.id = m.user_id
  where m.exchange_id = p_exchange
    and m.state = 'active'
    and m.taking_part
    and e.organiser_id = auth.uid()
  order by (m.user_id = e.organiser_id) desc, m.joined_at, m.id
$$;

-- 6. D5: the writer can delay a row -----------------------------------------------------------------------
-- WHY drop and create: a second signature beside the old one would make every call with six arguments ambiguous.
-- The callers are plpgsql bodies that name the function at run time, so they need no change.
drop function private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text);

create function private.enqueue_email(
  p_template text,
  p_recipient_user uuid,
  p_recipient_email text,
  p_exchange uuid,
  p_sender uuid,
  p_subject uuid,
  p_dedupe_key text default null,
  p_send_after timestamptz default now()
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
    -- WHY E10 is not in this list (owner decision 2026-11-18 4): a nudge is always sent, like E09 and E12.
    if p_template in ('E07', 'E08') and not coalesce((
      select s.notify_someone_joins from public.user_settings s where s.user_id = p_recipient_user
    ), true) then
      return null;
    end if;
  end if;

  insert into private.email_outbox (template, recipient_user_id, recipient_email, exchange_id, sender_id, payload, dedupe_key, send_after)
  values (
    p_template, p_recipient_user, p_recipient_email, p_exchange, p_sender,
    jsonb_strip_nulls(jsonb_build_object('exchange_id', p_exchange, 'subject_user_id', p_subject)),
    p_dedupe_key, coalesce(p_send_after, now())
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function private.enqueue_email(text, uuid, text, uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;

-- 7. D6: Nudge (GCO-008) ---------------------------------------------------------------------------------
-- p_members are member ids from get_readiness (the organiser never holds a person id). Returns the people a nudge
-- was actually queued for, in join order, so the toast can name only them (owner decision 2026-11-18 2); no rows
-- when everyone was skipped. Skipped silently: a member id of another exchange, someone not active, not taking
-- part or anonymised, the organiser's own row, someone whose list is in, someone nudged in the last 12 hours (any sender).
-- Refusals: 42501 not signed in; P0002 not the organiser (or no such exchange); 22023 with a hint: cancelled,
-- closed (the exchange is past joining and the draw is the organiser's next step, or it is over), members (a null
-- or an oversized list). P0429 with hint 'nudges' when the send would take the organiser past 20 emails in the
-- last hour: the whole send is refused and nothing is queued (owner decision 2026-11-18 3).
-- WHY counting emails and not calls: "Nudge all 40" must not be one hit. Undone nudges do not count, because
-- undo_nudge marks them 'undone'. WHY a lock on the organiser: two tabs cannot both pass the count.
-- WHY send_after now() + 20 seconds (plan §8): the undo window; the sender runs once a minute and only takes due rows.
create function public.send_nudge(p_exchange uuid, p_members uuid[])
returns table (member_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_targets uuid[];
  v_recent integer;
  r record;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into e from public.exchanges x where x.id = p_exchange and x.organiser_id = v_uid for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;
  if p_members is null or coalesce(array_length(p_members, 1), 0) = 0 or array_length(p_members, 1) > 100 then
    raise exception 'no people' using errcode = '22023', hint = 'members';
  end if;

  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'nudges closed' using errcode = '22023', hint = 'closed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('send_nudge:' || v_uid::text, 0));

  select coalesce(array_agg(m.id order by m.joined_at, m.id), '{}')
    into v_targets
    from public.exchange_members m
    join public.profiles pr on pr.id = m.user_id
   where m.exchange_id = e.id
     and m.id = any (p_members)
     and m.state = 'active'
     and m.taking_part
     and m.user_id <> v_uid
     -- WHY: an anonymised person has no address and is never sent to (GC-028), so they do not count against the limit.
     and pr.anonymised_at is null
     and not private.member_has_list(m.attached_wishlist_id)
     and not private.recently_nudged(m.user_id, m.exchange_id);

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    return;
  end if;

  select count(*)::integer into v_recent
    from private.email_outbox o
   where o.template = 'E10'
     and o.sender_id = v_uid
     and o.created_at > now() - interval '1 hour'
     and not (o.cancelled_at is not null and o.last_error_code = 'undone');
  if v_recent + array_length(v_targets, 1) > 20 then
    raise exception 'rate limited' using errcode = 'P0429', hint = 'nudges';
  end if;

  for r in
    select m.id as mid, m.user_id as uid, p.display_name as dname
      from public.exchange_members m
      join public.profiles p on p.id = m.user_id
     where m.id = any (v_targets)
     order by m.joined_at, m.id
  loop
    -- WHY the organiser is the sender and there is no subject: the email names the organiser and the exchange only.
    if private.enqueue_email('E10', r.uid, null, e.id, v_uid, null, null, now() + interval '20 seconds') is not null then
      member_id := r.mid;
      display_name := r.dname;
      return next;
    end if;
  end loop;
end $$;

-- 8. D7: Undo ---------------------------------------------------------------------------------------------
-- Stops the caller's own nudges for one exchange that have not been sent and are not being sent now. Returns how
-- many were stopped. WHY only the caller's rows: sender_id = the session, so no one can stop another organiser's.
-- WHY not rows with a live lease: the sender has them and may already have handed them to the provider.
create function public.undo_nudge(p_exchange uuid) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = 'undone'
   where o.template = 'E10'
     and o.sender_id = v_uid
     and o.exchange_id = p_exchange
     and o.sent_at is null
     and o.cancelled_at is null
     and (o.claimed_until is null or o.claimed_until <= now());
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.get_readiness(uuid) from public, anon, authenticated;
revoke execute on function public.send_nudge(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.undo_nudge(uuid) from public, anon, authenticated;

grant execute on function public.get_readiness(uuid) to authenticated;
grant execute on function public.send_nudge(uuid, uuid[]) to authenticated;
grant execute on function public.undo_nudge(uuid) to authenticated;

-- 9. D8: the claim ----------------------------------------------------------------------------------------
-- Same body as 20261117171053_email_outbox_details plus the lines marked NEW. The result type changes (two
-- columns), so drop and create; the grants are set again below.
--   NEW 1: an E10 whose person has left, or now has a list, is cancelled as 'not_needed' and never sent.
--   NEW 2: draw_mode and draw_at, for E10 only, so the email says "Names are drawn on {day}" for an automatic
--          draw and "Names are drawn when {Organiser} is ready" for a manual one (owner decision 2026-11-18 2).
--          other_name is the organiser's name for E10 (the sender), as it is the inviter's for E06.
drop function public.claim_due_emails(integer);

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
  attempts integer,
  budget_preset text,
  join_by_at timestamptz,
  gift_day date,
  note text,
  draw_mode text,
  draw_at timestamptz
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
  -- NEW 1.
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = 'not_needed'
   where o.template = 'E10' and o.sent_at is null and o.cancelled_at is null and o.send_after <= now()
     and not exists (
       select 1 from public.exchange_members m
        where m.exchange_id = o.exchange_id and m.user_id = o.recipient_user_id
          and m.state = 'active' and m.taking_part
          and not private.member_has_list(m.attached_wishlist_id)
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
         c.attempts,
         case when c.template = 'E06' then x.budget_preset::text end,
         case when c.template = 'E06' then x.join_by_at end,
         case when c.template = 'E06' then x.gift_day end,
         case when c.template = 'E06' then x.note end,
         -- NEW 2.
         case when c.template = 'E10' then x.draw_mode::text end,
         case when c.template = 'E10' then x.draw_at end
    from claimed c
    left join auth.users u on u.id = c.recipient_user_id
    left join public.profiles p on p.id = c.recipient_user_id
    left join public.user_settings s on s.user_id = c.recipient_user_id
    left join public.exchanges x on x.id = c.exchange_id
    left join public.profiles other on other.id = case
      when c.template in ('E07', 'E08') then (c.payload ->> 'subject_user_id')::uuid
      when c.template in ('E06', 'E10') then c.sender_id
    end
   order by c.send_after, c.id;
end $$;

revoke execute on function public.claim_due_emails(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_emails(integer) to service_role;
