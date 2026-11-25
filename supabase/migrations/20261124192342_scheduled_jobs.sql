-- scheduled_jobs — slice 12 (GCO-011 the scheduled draw and its blocked state, GC-026 reminders, GCO-015 automatic completion,
-- GC-007 Activity kinds; plan implementation-plan slice 12; owner decisions 2026-11-24 Q1-Q12 in docs/tasks/slice-12.md; schema
-- approved 2026-11-24). PLACEHOLDER TIMESTAMP: renamed after it is applied.
--
-- Tests written first: supabase/tests/security/370_tick_access.sql (who can run what), 380_scheduled_draw.sql (the draw, the
-- blocked state, who can read the reason), 390_reminders.sql, 400_auto_complete.sql. Changed as approved with the schema: 200
-- (three new activity kinds), 220, 270 and 310 (the claim gains one column: revealed), 310 (draw_blocked_reason may only hold
-- 'few' or 'exclusions'; the engine call now sits in private.run_draw).
-- Needs 20261123190018_recipient_list_and_marks first (nothing here edits it).
--
-- WHAT THIS ADDS
--   private.run_draw             the body of draw_names without auth.uid(): one engine call, no retry, inserts only a complete
--                                answer, returns an outcome instead of raising. The manual draw and the scheduled draw both use it.
--   draw_names                   create or replace: authorises the organiser, then calls run_draw. Same errcodes, hints and result.
--   private.tick                 the scheduled job (draw, reminders, completion). Definer, one run at a time, bounded per run.
--   private.reveal_flag          helper for the claim: has this person tapped Reveal on their own row (E24 only).
--   private.reminder_window      when an event reminder is due for one person: 9:00 the day before the gift day until the gift
--                                day starts, in that person's zone. Shared by tick and the claim so the two cannot disagree.
--   get_draw_blocked_reason      the organiser's read of why the scheduled draw could not run (Q5).
--   exchanges.draw_blocked_reason  only 'few' or 'exclusions'. No longer readable by members: dropped from the column grant and
--                                from exchanges_visible.
--   email_outbox.for_at          the moment a reminder is about (join-by, or the start of the gift day for the person).
--   E15, E23, E24                known outbox templates: Names couldn't be drawn (organiser), Join-by reminder, Event reminder.
--   private.enqueue_email        create or replace: honours the two reminder toggles (same signature).
--   claim_due_emails             drop and create: one new column (revealed, E24 only); E15, E23, E24 carry what their boards show;
--                                cancels a reminder that is no longer needed.
--   join_by_reminder, event_reminder, exchange_completed   new activity kinds (no subject).
--   exchanges(join_by_at), exchanges(gift_day)   indexes for the job (plan §7).
--
-- NOT HERE, ON PURPOSE (owner decision Q2): the pg_cron job. The owner schedules `select private.tick()` after deploying the
-- email function and after a read-only look at what the first run would do on dev.
--
-- WHY no pair can leave the database (core rule; GC-007, GCO-012): run_draw is the slice 10 draw unchanged in what it writes;
-- tick reads no assignment except "does this exchange have a current draw". No row, event or claim column names a giver and a
-- receiver. The one assignment read in the claim is the RECIPIENT'S OWN reveal flag (E24), never anyone's receiver.
-- WHY no cascades (never-do 8): nothing here deletes.
-- WHY the draw is never retried (never-do 7): a blocked exchange gets its reason set, and the draw query skips an exchange that
-- has one. The engine runs once per attempt; the date edit in slice 13 clears the reason so a new attempt can happen.

-- 1. Activity kinds ---------------------------------------------------------------------------------------------------
-- WHY no subject: the existing check ties a subject to the two people kinds only. A reminder or a completion names no one.
-- NOTE: a value added here cannot be used in this transaction. It is used only inside plpgsql bodies below, which are not
-- evaluated until they run.
alter type public.activity_kind add value 'join_by_reminder';
alter type public.activity_kind add value 'event_reminder';
alter type public.activity_kind add value 'exchange_completed';

-- 2. The blocked reason: two values, and organiser-only ----------------------------------------------------------------
-- NOT VALID: a check on new and changed rows from now on. WHY not validated here: free text could have been written before
-- (nothing in the app writes it; test 310 used to write 'x'), and a failed check would stop the migration. The main session
-- may run `alter table public.exchanges validate constraint exchanges_draw_blocked_reason_known` once
-- `select count(*) from public.exchanges where draw_blocked_reason is not null` shows only 'few' and 'exclusions'.
alter table public.exchanges
  add constraint exchanges_draw_blocked_reason_known
  check (draw_blocked_reason is null or draw_blocked_reason in ('few', 'exclusions')) not valid;

-- WHY (Q5): "exclusions" tells a member that exclusions exist (plan §6 invariant 11), and "few" is a fact about the organiser's
-- exchange. Members read neither: the column leaves the grant and the view. The organiser reads it through the function below.
revoke select (draw_blocked_reason) on public.exchanges from authenticated;

-- A view cannot lose a column with create or replace, so drop and create. Same definition as 20261113105718_exchanges_visible
-- without draw_blocked_reason. security_invoker as before (test 015).
drop view public.exchanges_visible;
create view public.exchanges_visible with (security_invoker = true) as
select
  id, organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, organiser_tz,
  approval_required, tint, cancelled_at, completed_at, reopened_join_by_at,
  draw_round, created_at, updated_at, gift_day
from public.exchanges;

revoke all on public.exchanges_visible from public, anon, authenticated;
grant select on public.exchanges_visible to authenticated;

-- Zero rows for everyone but the organiser, and for an exchange that is not blocked. WHY rows and not a null: "no row" is the
-- same answer for a member, an outsider, another exchange's organiser and "not blocked", so nothing is confirmed.
create function public.get_draw_blocked_reason(p_exchange uuid)
returns table (reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.draw_blocked_reason
  from public.exchanges e
  where e.id = p_exchange and e.organiser_id = auth.uid() and e.draw_blocked_reason is not null
$$;

revoke execute on function public.get_draw_blocked_reason(uuid) from public, anon, authenticated;
grant execute on function public.get_draw_blocked_reason(uuid) to authenticated;

-- 3. Indexes for the job (plan §7) ------------------------------------------------------------------------------------
create index exchanges_join_by_at_idx on public.exchanges (join_by_at);
create index exchanges_gift_day_idx on public.exchanges (gift_day);

-- 4. Outbox: for_at and the three templates -----------------------------------------------------------------------------
alter table private.email_outbox add column for_at timestamptz;

-- WHY these three codes (boards Email-E15, Email-E23, Email-E24, docs/tasks/slice-12-boards.md): E15 Names couldn't be drawn
-- (the organiser), E23 Join-by reminder, E24 Event reminder.
alter table private.email_outbox drop constraint email_outbox_template_known;
alter table private.email_outbox
  add constraint email_outbox_template_known
  check (template in ('E06', 'E07', 'E08', 'E09', 'E10', 'E12', 'E15', 'E19', 'E21', 'E23', 'E24'));

-- WHY partial: the "a later reminder was already sent" lookup reads sent reminders by person and exchange only.
create index email_outbox_reminder_sent_idx on private.email_outbox (exchange_id, recipient_user_id, template)
  where template in ('E23', 'E24') and sent_at is not null;

-- 5. The writer honours the two reminder toggles ------------------------------------------------------------------------------
-- Same signature and body as 20261122215259_draw_and_reveal plus the lines marked NEW, so create or replace keeps the owner and
-- the grant, and no caller changes. WHY no for_at argument: tick sets for_at on the row it just queued, in the same
-- subtransaction, so the signature that tests 220 and 270 pin stays as it is.
create or replace function private.enqueue_email(
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
    -- WHY E10 is not in this list (owner decision 2026-11-18 4): a nudge is always sent, like E09 and E12. E15 is always sent too
    -- (owner decision Q4, 2026-11-24).
    if p_template in ('E07', 'E08') and not coalesce((
      select s.notify_someone_joins from public.user_settings s where s.user_id = p_recipient_user
    ), true) then
      return null;
    end if;
    if p_template in ('E19', 'E21') and not coalesce((
      select s.notify_names_drawn from public.user_settings s where s.user_id = p_recipient_user
    ), true) then
      return null;
    end if;
    -- NEW: the two reminders have their own toggles (GC-026).
    if p_template = 'E23' and not coalesce((
      select s.notify_join_by_reminder from public.user_settings s where s.user_id = p_recipient_user
    ), true) then
      return null;
    end if;
    if p_template = 'E24' and not coalesce((
      select s.notify_event_reminder from public.user_settings s where s.user_id = p_recipient_user
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
  from public, anon, authenticated, service_role;

-- 6. The window of an event reminder ---------------------------------------------------------------------------------------
-- 9:00 the day before the gift day until the gift day starts, in the zone given. WHY `at time zone` on a plain timestamp: it
-- resolves the wall-clock time in that zone, so a daylight-saving change on either day moves the instant, not the wall clock.
create function private.reminder_window(p_gift_day date, p_tz text)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select (((p_gift_day - 1)::timestamp) + interval '9 hours') at time zone p_tz,
         (p_gift_day::timestamp) at time zone p_tz
$$;

revoke execute on function private.reminder_window(date, text) from public, anon, authenticated, service_role;

-- 7. The draw, as a function the job can call ---------------------------------------------------------------------------------
-- The body of draw_names (20261122215259_draw_and_reveal) without auth.uid() and without raising for the expected refusals. It
-- locks the exchange row, so the manual draw, the scheduled draw, save_exclusions, join, approve and remove cannot interleave.
-- Returns one row: outcome, how many people are in, how many pairs were kept apart, how many Names are drawn emails were queued
-- (E19 only; an organiser who only organises gets E21, not counted).
--   drawn       this call made the draw
--   already     the exchange was already drawn (nothing written)
--   few         fewer than 3 people take part (nothing written)
--   exclusions  no fair draw exists (nothing written)
--   cancelled / closed   the exchange cannot be drawn (nothing written)
--   missing     no such exchange
-- WHY one engine call and a materialised CTE: the engine is exact, so "no rows" is proof that no fair draw exists, and the rows
-- are inserted only when there are as many as people (never-do 7). No retry and no second seed.
-- WHY a status and not an exception: tick must tell "blocked" from "bug" without catching errors, and the blocked case writes
-- the reason in the caller's transaction.
create function private.run_draw(p_exchange uuid)
returns table (outcome text, people_count integer, pairs_excluded integer, told integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_people uuid[];
  v_first uuid[];
  v_second uuid[];
  v_pairs integer;
  v_rows integer;
  v_round integer;
  v_told integer := 0;
  r record;
begin
  select * into e from public.exchanges x where x.id = p_exchange for update;
  if not found then
    outcome := 'missing';
    return next;
    return;
  end if;

  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    outcome := 'cancelled';
    return next;
    return;
  elsif v_state = 'drawn' then
    outcome := 'already';
    people_count := private.drawn_people_count(e.id);
    pairs_excluded := (select count(*)::integer from private.exclusion_pairs(e.id));
    told := 0;
    return next;
    return;
  elsif v_state not in ('open', 'joining_closed') then
    outcome := 'closed';
    return next;
    return;
  end if;

  v_people := private.draw_people(e.id);
  if cardinality(v_people) < 3 then
    outcome := 'few';
    people_count := cardinality(v_people);
    return next;
    return;
  end if;

  select coalesce(array_agg(x.first_member_id), '{}'::uuid[]), coalesce(array_agg(x.second_member_id), '{}'::uuid[]), count(*)::integer
    into v_first, v_second, v_pairs
    from private.exclusion_pairs(e.id) x;

  v_round := e.draw_round + 1;
  with m as materialized (
    select * from private.compute_matching(v_people, v_first, v_second, gen_random_uuid()::text)
  )
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind)
  select e.id, m.giver, m.receiver, v_round, 'full'
    from m
   where (select count(*) from m) = cardinality(v_people);
  get diagnostics v_rows = row_count;
  if v_rows <> cardinality(v_people) then
    outcome := 'exclusions';
    people_count := cardinality(v_people);
    pairs_excluded := v_pairs;
    return next;
    return;
  end if;

  update public.exchanges set draw_round = v_round, draw_blocked_reason = null where id = e.id;

  update public.join_requests set status = 'closed', decided_at = now()
   where exchange_id = e.id and status = 'pending';

  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = 'drawn'
   where o.template = 'E10' and o.exchange_id = e.id and o.sent_at is null and o.cancelled_at is null;

  for r in
    select m.user_id as uid
      from public.exchange_members m
     where m.id = any (v_people)
     order by m.joined_at, m.id
  loop
    perform private.add_activity_event(r.uid, e.id, 'names_drawn', null);
    if private.enqueue_email('E19', r.uid, null, e.id, e.organiser_id, null,
         'draw:' || e.id::text || ':' || v_round::text || ':' || r.uid::text) is not null then
      v_told := v_told + 1;
    end if;
  end loop;

  if not exists (select 1 from public.exchange_members m where m.id = any (v_people) and m.user_id = e.organiser_id) then
    perform private.enqueue_email('E21', e.organiser_id, null, e.id, null, null,
      'draw:' || e.id::text || ':' || v_round::text || ':' || e.organiser_id::text);
  end if;

  outcome := 'drawn';
  people_count := cardinality(v_people);
  pairs_excluded := v_pairs;
  told := v_told;
  return next;
end $$;

revoke execute on function private.run_draw(uuid) from public, anon, authenticated, service_role;

-- The organiser's Draw names (GCO-011). Same contract as 20261122215259_draw_and_reveal: 42501 not signed in; P0002 not the
-- organiser (or no such exchange); 22023 with a hint: cancelled, closed, few, exclusions; nothing written on a refusal; one row
-- (people, pairs, Names are drawn emails queued, drawn now) otherwise, and a repeat call answers and writes nothing.
-- create or replace: same signature and result, so the owner and the grant stay. The grants are repeated below.
-- WHY the row is locked here too: the organiser check and the draw must see the same row, and run_draw locks it again harmlessly.
create or replace function public.draw_names(p_exchange uuid)
returns table (people_count integer, pairs_excluded integer, emails_queued integer, drawn_now boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  perform 1 from public.exchanges x where x.id = p_exchange and x.organiser_id = v_uid for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;

  select * into r from private.run_draw(p_exchange);
  if r.outcome = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif r.outcome = 'closed' then
    raise exception 'exchange is over' using errcode = '22023', hint = 'closed';
  elsif r.outcome = 'few' then
    raise exception 'too few people' using errcode = '22023', hint = 'few';
  elsif r.outcome = 'exclusions' then
    raise exception 'no fair draw' using errcode = '22023', hint = 'exclusions';
  elsif r.outcome not in ('drawn', 'already') then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;

  people_count := r.people_count;
  pairs_excluded := r.pairs_excluded;
  emails_queued := r.told;
  drawn_now := (r.outcome = 'drawn');
  return next;
end $$;

revoke execute on function public.draw_names(uuid) from public, anon, authenticated;
grant execute on function public.draw_names(uuid) to authenticated;

-- WHY a helper (as drawn_people_count): the claim must carry a reveal flag for E24 without its own source naming the draw table
-- (tests 220 and 270 assert that the sender functions' source never mentions an assignment). The flag is the flag of the person
-- the row is for, on THEIR OWN giver row: it says whether they tapped Reveal, never who they give to.
create function private.reveal_flag(p_exchange uuid, p_user uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.revealed_at is not null
      from private.assignments a
      join public.exchange_members g on g.id = a.giver_member_id
     where a.exchange_id = p_exchange and a.superseded_at is null
       and g.user_id = p_user and g.state = 'active'
  ), false)
$$;

revoke execute on function private.reveal_flag(uuid, uuid) from public, anon, authenticated, service_role;

-- 8. The claim ---------------------------------------------------------------------------------------------------------------
-- Same body as 20261122215259_draw_and_reveal plus the lines marked NEW. The result type gains a column, so drop and create.
--   NEW 1: E15 and E23 carry the join-by moment (E15 shows when the draw was due, E23 when joining closes); E24 carries the
--          budget preset and the gift day, as its board shows them. Everything else is null for these templates.
--   NEW 2: E15 carries how many people take part, so the email can say "Only 2 people are taking part" (fewer than 3) or switch to
--          the exclusions wording (3 or more): the reason is derived from the count, so no reason column is needed.
--   NEW 3: revealed, E24 only: whether the READER has tapped Reveal on their own row. It picks "View their wishlist" or "Reveal
--          who you got". It is the reader's own flag; no receiver, no giver, no pair. WHY a helper: the claim must not name the
--          draw table itself (tests 220 and 270 read its source), as with the people count above.
--   NEW 4: a reminder that is no longer needed is cancelled ('not_needed') and never sent: the person left, got a list (E23),
--          turned the reminder off, the exchange was cancelled, completed or drawn (E23), is no longer drawn (E24), the date was
--          changed since it was queued, or the moment it was about has passed.
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
  draw_at timestamptz,
  people_count integer,
  revealed boolean
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
     set cancelled_at = now(), claimed_until = null, last_error_code = 'not_needed'
   where o.template = 'E10' and o.sent_at is null and o.cancelled_at is null and o.send_after <= now()
     and not exists (
       select 1 from public.exchange_members m
        where m.exchange_id = o.exchange_id and m.user_id = o.recipient_user_id
          and m.state = 'active' and m.taking_part
          and not private.member_has_list(m.attached_wishlist_id)
     );
  -- NEW 4: E23. Still open, still the date it was queued for, the person is in, has no list and still wants it.
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = 'not_needed'
   where o.template = 'E23' and o.sent_at is null and o.cancelled_at is null and o.send_after <= now()
     and not exists (
       select 1
         from public.exchanges x
         join public.exchange_members m on m.exchange_id = x.id
         left join public.user_settings s on s.user_id = m.user_id
        where x.id = o.exchange_id and m.user_id = o.recipient_user_id
          and m.state = 'active' and m.taking_part
          and not private.member_has_list(m.attached_wishlist_id)
          and coalesce(s.notify_join_by_reminder, true)
          and private.exchange_status(x.id) = 'open'
          and greatest(x.join_by_at, coalesce(x.reopened_join_by_at, x.join_by_at)) = o.for_at
     );
  -- NEW 4: E24. Still drawn, the person is in and still wants it, the gift day has not started for them, and the date is the
  -- one it was queued for.
  update private.email_outbox o
     set cancelled_at = now(), claimed_until = null, last_error_code = 'not_needed'
   where o.template = 'E24' and o.sent_at is null and o.cancelled_at is null and o.send_after <= now()
     and not exists (
       select 1
         from public.exchanges x
         join public.exchange_members m on m.exchange_id = x.id
         left join public.user_settings s on s.user_id = m.user_id
        where x.id = o.exchange_id and m.user_id = o.recipient_user_id
          and m.state = 'active' and m.taking_part
          and coalesce(s.notify_event_reminder, true)
          and private.exchange_status(x.id) = 'drawn'
          and now() < o.for_at
          and (select w.closes_at
                 from private.reminder_window(x.gift_day, coalesce(s.timezone, x.organiser_tz, 'Africa/Lagos')) w) = o.for_at
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
         -- NEW 1.
         case when c.template in ('E06', 'E19', 'E21', 'E24') then x.budget_preset::text end,
         case when c.template in ('E06', 'E15', 'E23') then x.join_by_at end,
         case when c.template in ('E06', 'E19', 'E21', 'E24') then x.gift_day end,
         case when c.template = 'E06' then x.note end,
         case when c.template = 'E10' then x.draw_mode::text end,
         case when c.template = 'E10' then x.draw_at end,
         -- NEW 2.
         case
           when c.template in ('E19', 'E21') then private.drawn_people_count(c.exchange_id)
           when c.template = 'E15' then cardinality(private.draw_people(c.exchange_id))
         end,
         -- NEW 3.
         case when c.template = 'E24' then private.reveal_flag(c.exchange_id, c.recipient_user_id) end
    from claimed c
    left join auth.users u on u.id = c.recipient_user_id
    left join public.profiles p on p.id = c.recipient_user_id
    left join public.user_settings s on s.user_id = c.recipient_user_id
    left join public.exchanges x on x.id = c.exchange_id
    left join public.profiles other on other.id = case
      when c.template in ('E07', 'E08') then (c.payload ->> 'subject_user_id')::uuid
      when c.template in ('E06', 'E10', 'E19') then c.sender_id
    end
   order by c.send_after, c.id;
end $$;

revoke execute on function public.claim_due_emails(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_emails(integer) to service_role;

-- 9. tick ---------------------------------------------------------------------------------------------------------------------
-- The scheduled job: the scheduled draw, the reminders and the automatic completion, in that order. Returns what it did as
-- counts: ran (false when another run holds the lock), drawn, blocked (draws that could not run), reminders queued, completed.
-- Never a name, an id or a pair.
--
-- WHY pg_try_advisory_xact_lock: two runs (a slow one and the next minute's) must not both draw. The second returns at once with
-- ran = false. The lock is released when the transaction ends.
-- WHY one exception block per exchange (and per reminder): one bad exchange must not stop the others. The block's writes roll
-- back together, so a failed draw leaves no half draw. The warning carries the exchange id and the SQLSTATE and nothing else
-- (no message: it could echo data).
-- WHY `for update skip locked` per exchange: an organiser editing or drawing that exchange at the same moment wins; the job
-- takes it on the next run. WHY re-check after the lock: the list below was read before the lock.
-- WHY bounded per run (20 draws, 500 reminders, 100 completions, oldest first): a long backlog (the job was off for a day) is
-- worked off over several runs, and a run stays short. WHY statement_timeout: a runaway run cannot hold the lock for long.
-- WHY the candidate queries filter again by what is already done (draw_blocked_reason, the dedupe key, the toggle): otherwise a
-- backlog of people who will never be reminded would fill the bound every minute and starve the rest.
--
-- SCHEDULED DRAW (GCO-011). Only at_join_by, state exactly joining_closed, round 0, no blocked reason. WHY exactly joining_closed:
-- an event_passed exchange (the gift day is over) is never drawn, and a drawn, cancelled or complete one has nothing to draw.
-- Fewer than 3 people, or no fair draw: the reason is set, one E15 goes to the organiser (always sent, no Activity event, Q4),
-- and the query above skips the exchange from then on. The engine ran once (never-do 7).
-- JOIN-BY REMINDER (E23). State open, from 24 hours before the effective join-by until it. To active members taking part with no
-- list who joined at least 24 hours before join-by (the board: "Not sent if join-by was within 24 hours of joining"). Skipped when
-- a reminder for a later date was already sent to that person for this exchange.
-- EVENT REMINDER (E24). Drawn exchanges only (Q7), from 9:00 the day before the gift day until the gift day starts, in the
-- person's zone (user_settings.timezone, else the organiser's zone, else Lagos). To active members taking part.
-- Both reminders write the Activity event only when the email was queued (Q8): the outbox dedupe key then covers the event.
-- AUTOMATIC COMPLETION (GCO-015). A drawn exchange (a current assignment exists), not cancelled, not complete, at or after
-- (gift day + 8) at the organiser's midnight: completed_at is set and every active member gets one exchange_completed event.
-- No email. Afterwards exchange_status is complete and the slice 10 and 11 reads refuse.
create function private.tick()
returns table (ran boolean, drawn integer, blocked integer, reminders integer, completed integer)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '50s'
as $$
#variable_conflict use_column
declare
  v_drawn integer := 0;
  v_blocked integer := 0;
  v_reminders integer := 0;
  v_completed integer := 0;
  e public.exchanges%rowtype;
  d record;
  r record;
  mem record;
  v_id uuid;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('unwrap:tick', 0)) then
    ran := false;
    drawn := 0;
    blocked := 0;
    reminders := 0;
    completed := 0;
    return next;
    return;
  end if;

  -- 1. The scheduled draw.
  for r in
    select x.id
      from public.exchanges x
     where x.draw_mode = 'at_join_by' and x.draw_round = 0 and x.draw_blocked_reason is null
       and x.cancelled_at is null and x.completed_at is null
       and x.join_by_at <= now()
       and private.exchange_status(x.id) = 'joining_closed'
     order by x.join_by_at, x.id
     limit 20
  loop
    begin
      select * into e from public.exchanges x where x.id = r.id for update skip locked;
      if not found then
        continue;
      end if;
      if e.draw_mode <> 'at_join_by' or e.draw_round <> 0 or e.draw_blocked_reason is not null
         or private.exchange_status(e.id) <> 'joining_closed' then
        continue;
      end if;

      select * into d from private.run_draw(e.id);
      if d.outcome = 'drawn' then
        v_drawn := v_drawn + 1;
      elsif d.outcome in ('few', 'exclusions') then
        update public.exchanges set draw_blocked_reason = d.outcome where id = e.id;
        -- WHY the join-by moment in the key: the same date never emails twice, and a changed date is a new fact (slice 13).
        perform private.enqueue_email('E15', e.organiser_id, null, e.id, null, null,
          'blocked:' || e.id::text || ':' || (extract(epoch from e.join_by_at))::bigint::text);
        v_blocked := v_blocked + 1;
      end if;
    exception when others then
      raise warning 'tick: draw failed for exchange % (sqlstate %)', r.id, sqlstate;
    end;
  end loop;

  -- 2a. Join-by reminders.
  for r in
    select m.user_id as uid, x.id as ex, b.by_at as by_at,
           'joinby:' || x.id::text || ':' || m.user_id::text || ':' || (extract(epoch from b.by_at))::bigint::text as dedupe
      from public.exchanges x
      cross join lateral (
        select greatest(x.join_by_at, coalesce(x.reopened_join_by_at, x.join_by_at)) as by_at
      ) b
      join public.exchange_members m on m.exchange_id = x.id and m.state = 'active' and m.taking_part
      join public.profiles p on p.id = m.user_id and p.anonymised_at is null
      left join public.user_settings s on s.user_id = m.user_id
     where x.cancelled_at is null and x.completed_at is null
       and x.join_by_at <= now() + interval '24 hours'
       and now() >= b.by_at - interval '24 hours' and now() < b.by_at
       and m.joined_at <= b.by_at - interval '24 hours'
       and coalesce(s.notify_join_by_reminder, true)
       and not private.member_has_list(m.attached_wishlist_id)
       and private.exchange_status(x.id) = 'open'
       and not exists (
         select 1 from private.email_outbox o
          where o.dedupe_key = 'joinby:' || x.id::text || ':' || m.user_id::text || ':' || (extract(epoch from b.by_at))::bigint::text
       )
       and not exists (
         select 1 from private.email_outbox o
          where o.template = 'E23' and o.exchange_id = x.id and o.recipient_user_id = m.user_id
            and o.sent_at is not null and o.for_at > b.by_at
       )
     order by b.by_at, x.id, m.joined_at, m.id
     limit 500
  loop
    begin
      v_id := private.enqueue_email('E23', r.uid, null, r.ex, null, null, r.dedupe);
      if v_id is not null then
        -- WHY for_at is set on the row just queued: the claim uses it to see that the date has not moved since.
        update private.email_outbox set for_at = r.by_at where id = v_id;
        perform private.add_activity_event(r.uid, r.ex, 'join_by_reminder', null);
        v_reminders := v_reminders + 1;
      end if;
    exception when others then
      raise warning 'tick: reminder failed for exchange % (sqlstate %)', r.ex, sqlstate;
    end;
  end loop;

  -- 2b. Event reminders, with what is left of the 500.
  -- WHY the gift day window in UTC dates: a person's zone is at most 14 hours from UTC, so a gift day outside this range cannot be
  -- inside anyone's window, and the range lets the gift_day index do the first cut.
  for r in
    select m.user_id as uid, x.id as ex, w.closes_at as for_at,
           'event:' || x.id::text || ':' || m.user_id::text || ':' || (extract(epoch from w.closes_at))::bigint::text as dedupe
      from public.exchanges x
      join public.exchange_members m on m.exchange_id = x.id and m.state = 'active' and m.taking_part
      join public.profiles p on p.id = m.user_id and p.anonymised_at is null
      left join public.user_settings s on s.user_id = m.user_id
      cross join lateral private.reminder_window(x.gift_day, coalesce(s.timezone, x.organiser_tz, 'Africa/Lagos')) w
     where x.cancelled_at is null and x.completed_at is null
       and x.gift_day between (now() at time zone 'UTC')::date - 1 and (now() at time zone 'UTC')::date + 2
       and now() >= w.opens_at and now() < w.closes_at
       and coalesce(s.notify_event_reminder, true)
       and private.exchange_status(x.id) = 'drawn'
       and not exists (
         select 1 from private.email_outbox o
          where o.dedupe_key = 'event:' || x.id::text || ':' || m.user_id::text || ':' || (extract(epoch from w.closes_at))::bigint::text
       )
       and not exists (
         select 1 from private.email_outbox o
          where o.template = 'E24' and o.exchange_id = x.id and o.recipient_user_id = m.user_id
            and o.sent_at is not null and o.for_at > w.closes_at
       )
     order by w.opens_at, x.id, m.joined_at, m.id
     limit greatest(500 - v_reminders, 0)
  loop
    begin
      v_id := private.enqueue_email('E24', r.uid, null, r.ex, null, null, r.dedupe);
      if v_id is not null then
        update private.email_outbox set for_at = r.for_at where id = v_id;
        perform private.add_activity_event(r.uid, r.ex, 'event_reminder', null);
        v_reminders := v_reminders + 1;
      end if;
    exception when others then
      raise warning 'tick: reminder failed for exchange % (sqlstate %)', r.ex, sqlstate;
    end;
  end loop;

  -- 3. Automatic completion. The gift_day cut keeps the index useful: the boundary is at most 14 hours from a UTC midnight, so
  -- a gift day later than seven days before the UTC date cannot be due; the exact test follows.
  for r in
    select x.id
      from public.exchanges x
     where x.completed_at is null and x.cancelled_at is null
       and x.gift_day <= (now() at time zone 'UTC')::date - 6
       and now() >= ((x.gift_day + 8)::timestamp at time zone x.organiser_tz)
       and exists (select 1 from private.assignments a where a.exchange_id = x.id and a.superseded_at is null)
     order by x.gift_day, x.id
     limit 100
  loop
    begin
      select * into e from public.exchanges x where x.id = r.id for update skip locked;
      if not found or e.completed_at is not null or e.cancelled_at is not null then
        continue;
      end if;
      update public.exchanges set completed_at = now() where id = e.id;
      for mem in
        select mm.user_id as uid
          from public.exchange_members mm
         where mm.exchange_id = e.id and mm.state = 'active'
         order by mm.joined_at, mm.id
      loop
        perform private.add_activity_event(mem.uid, e.id, 'exchange_completed', null);
      end loop;
      v_completed := v_completed + 1;
    exception when others then
      raise warning 'tick: completion failed for exchange % (sqlstate %)', r.id, sqlstate;
    end;
  end loop;

  ran := true;
  drawn := v_drawn;
  blocked := v_blocked;
  reminders := v_reminders;
  completed := v_completed;
  return next;
end $$;

-- WHY service_role too: the job runs as the database owner through pg_cron. No API role may start a draw, a reminder or a
-- completion by calling this (test 370).
revoke execute on function private.tick() from public, anon, authenticated, service_role;
