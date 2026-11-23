-- draw_and_reveal — slice 10 (GCO-011 manual draw, GCO-012 names drawn, GC-014 reveal, GC-013 after the draw, GC-006 request
-- closed by the draw, GC-007 Names drawn event; plan §3, §5, §6 invariants 1-5, 7, 9, 10, 12; owner decisions 2026-11-22
-- Q1-Q12 in docs/tasks/slice-10.md; schema approved 2026-11-22).
--
-- Tests written first: supabase/tests/security/300_assignments.sql (the table), 310_draw_names.sql (the draw and what it
-- changes), 320_reveal.sql (the giver's reads and the reveal). Changed as approved with the schema: 200 (a new event kind),
-- 220 and 270 (the claim carries a people count; E19 and E21 carry the exchange details).
-- Needs 20261122110555_exclusions first (the engine and the pair reads) and 20261118232507_readiness_and_nudges (the writer
-- and the claim replaced here).
--
-- WHAT THIS ADDS
--   private.assignments            who gives to whom. Member ids, never person ids. RLS on, NO policy, NO grant to any role.
--                                  A trigger makes a row immutable except three timestamps.
--   private.exchange_status        create or replace: 'drawn' when a current assignment exists. Every function that allowed
--                                  only (open, joining_closed) now refuses a drawn exchange without being edited.
--   draw_names                     the organiser's Draw names: one call of the engine, no retry, one transaction.
--   get_draw_summary               the organiser's read of the draw: counts and a time. No pair.
--   get_my_assignment              the caller's own current row id and whether it is revealed. No name.
--   get_my_recipient               the person the caller gives to: name, photo, list state and up to three Most wanted
--                                  items as opaque references. The only function that returns a receiver, to the giver.
--   mark_assignment_revealed       the reveal tap: stamps revealed_at once.
--   dismiss_join_request           the asker clears a request the draw closed.
--   list_my_join_requests          create or replace: also lists a closed request the asker has not dismissed.
--   E19, E21                       known outbox templates; the writer honours Names are drawn for both; the claim carries the
--                                  budget, the gift day and the people count for them.
--   names_drawn                    a new activity kind (no subject).
--
-- NOT HERE (already in the schema): exchanges.draw_round and exchanges.draw_blocked_reason (slice 4) and
-- join_requests.dismissed_at (slice 6). The draw bumps the first and clears the second.
--
-- WHY no pair can leave the database except to its giver (core rule; GC-007, GC-014): the table has no grant; the only
-- functions that read it are definer functions that filter on auth.uid() being the GIVER of the row, return no giver, no
-- receiver id and no member id, and return nothing at all to the organiser unless the organiser is the giver. The organiser's
-- own read (get_draw_summary) is a count and a time. Emails carry the exchange id only; nothing names a pair.
-- WHY no cascades (never-do 8): foreign keys are NO ACTION and nothing here deletes.

-- 1. The table --------------------------------------------------------------------------------------------------
-- WHY an enum in private: the three kinds the plan names (full draw, re-match, blind assignment); a typo cannot be stored.
create type private.assignment_kind as enum ('full', 'rematch', 'assignment');

create table private.assignments (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges (id),
  -- WHY member ids (as in exclusions): the draw is between memberships, and no person id sits in this table.
  giver_member_id uuid not null references public.exchange_members (id),
  receiver_member_id uuid not null references public.exchange_members (id),
  draw_round integer not null constraint assignments_round_positive check (draw_round >= 1),
  kind private.assignment_kind not null,
  created_at timestamptz not null default now(),
  -- WHY three nullable moments and no status column: a row is current until superseded; it is revealed once.
  superseded_at timestamptz,
  revealed_at timestamptz,
  list_last_opened_at timestamptz,
  -- WHY a per-row salt: item references in links are md5(salt || item id), so a reference means nothing to anyone but the
  -- giver of this row and changes when the row is replaced.
  ref_salt text not null default encode(extensions.gen_random_bytes(16), 'hex')
    constraint assignments_ref_salt_shape check (ref_salt ~ '^[0-9a-f]{32}$'),
  constraint assignments_two_people check (giver_member_id <> receiver_member_id)
);

-- WHY partial: one CURRENT row per giver; a superseded row stays as history and frees the giver.
create unique index assignments_one_current_giver_idx on private.assignments (exchange_id, giver_member_id)
  where superseded_at is null;
create index assignments_current_giver_idx on private.assignments (giver_member_id) where superseded_at is null;

alter table private.assignments enable row level security;
-- WHY no grant to service_role either: nothing outside the definer functions below may read who gives to whom.
revoke all on private.assignments from public, anon, authenticated, service_role;

-- WHY a trigger and not only the absence of grants: the grants stop the API roles, but the functions run as the table owner,
-- so a bug or a later edit in one of them must still be unable to change a pair or delete a row (AC-11).
-- Allowed: superseded_at once, revealed_at once (setting the same value again is no change), list_last_opened_at any time.
create function private.assignments_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'assignments are never deleted' using errcode = '23001';
  end if;
  if new.id is distinct from old.id
     or new.exchange_id is distinct from old.exchange_id
     or new.giver_member_id is distinct from old.giver_member_id
     or new.receiver_member_id is distinct from old.receiver_member_id
     or new.draw_round is distinct from old.draw_round
     or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at
     or new.ref_salt is distinct from old.ref_salt
     or (old.superseded_at is not null and new.superseded_at is distinct from old.superseded_at)
     or (old.revealed_at is not null and new.revealed_at is distinct from old.revealed_at) then
    raise exception 'assignments cannot be changed' using errcode = '23001';
  end if;
  return new;
end $$;

create trigger assignments_guard
  before update or delete on private.assignments
  for each row execute function private.assignments_guard();

revoke execute on function private.assignments_guard() from public, anon, authenticated;

-- 2. The status gains 'drawn' -------------------------------------------------------------------------------------
-- Same body as 20261113151444_invite_and_join plus the line marked NEW. WHY after event_passed and before joining_closed
-- (plan §3): a gift day that has passed wins; a draw closes joining whatever the join-by moment says.
create or replace function private.exchange_status(p_exchange uuid) returns public.exchange_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when e.cancelled_at is not null then 'cancelled'
    when e.completed_at is not null then 'complete'
    when now() >= ((e.gift_day + 1)::timestamp at time zone e.organiser_tz) then 'event_passed'
    -- NEW
    when exists (select 1 from private.assignments a where a.exchange_id = e.id and a.superseded_at is null) then 'drawn'
    when now() >= greatest(e.join_by_at, coalesce(e.reopened_join_by_at, e.join_by_at)) then 'joining_closed'
    else 'open'
  end::public.exchange_status
  from public.exchanges e
  where e.id = p_exchange
$$;

-- WHY a helper: the claim must carry a people count for E19 and E21 without its own source naming the table.
create function private.drawn_people_count(p_exchange uuid) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from private.assignments a where a.exchange_id = p_exchange and a.superseded_at is null
$$;

revoke execute on function private.drawn_people_count(uuid) from public, anon, authenticated;

-- 3. Activity: the Names drawn event (Q6) -----------------------------------------------------------------------------
-- WHY no subject: the existing check ties a subject to the two people kinds only, so this kind carries none. The event says
-- the names are drawn and links to Reveal; it never names a person.
alter type public.activity_kind add value 'names_drawn';

-- 4. Outbox: E19 and E21 (Q1d) -----------------------------------------------------------------------------------------
alter table private.email_outbox drop constraint email_outbox_template_known;
alter table private.email_outbox
  add constraint email_outbox_template_known
  check (template in ('E06', 'E07', 'E08', 'E09', 'E10', 'E12', 'E19', 'E21'));

-- Same body and signature as 20261118232507_readiness_and_nudges plus the template list marked NEW. WHY create or replace:
-- owner and grants stay. E19 and E21 are the "Names are drawn" email, so the same toggle governs both (GC-026).
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
    -- WHY E10 is not in this list (owner decision 2026-11-18 4): a nudge is always sent, like E09 and E12.
    if p_template in ('E07', 'E08') and not coalesce((
      select s.notify_someone_joins from public.user_settings s where s.user_id = p_recipient_user
    ), true) then
      return null;
    end if;
    -- NEW: Names are drawn.
    if p_template in ('E19', 'E21') and not coalesce((
      select s.notify_names_drawn from public.user_settings s where s.user_id = p_recipient_user
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

-- The claim. Same body as 20261118232507_readiness_and_nudges plus the lines marked NEW. The result type gains a column, so
-- drop and create; the grants are set again below.
--   NEW 1: E19 and E21 carry the budget preset and gift day (E06 already did), and a people count.
--   NEW 2: E19 carries the organiser's name as other_name, as E06 and E10 do. E21 goes to the organiser and names nobody.
-- WHY a count and no names: the email says "{n} people are in" and who each person gives to is never in the claim.
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
  people_count integer
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
         case when c.template in ('E06', 'E19', 'E21') then x.budget_preset::text end,
         case when c.template = 'E06' then x.join_by_at end,
         case when c.template in ('E06', 'E19', 'E21') then x.gift_day end,
         case when c.template = 'E06' then x.note end,
         case when c.template = 'E10' then x.draw_mode::text end,
         case when c.template = 'E10' then x.draw_at end,
         case when c.template in ('E19', 'E21') then private.drawn_people_count(c.exchange_id) end
    from claimed c
    left join auth.users u on u.id = c.recipient_user_id
    left join public.profiles p on p.id = c.recipient_user_id
    left join public.user_settings s on s.user_id = c.recipient_user_id
    left join public.exchanges x on x.id = c.exchange_id
    left join public.profiles other on other.id = case
      when c.template in ('E07', 'E08') then (c.payload ->> 'subject_user_id')::uuid
      -- NEW 2.
      when c.template in ('E06', 'E10', 'E19') then c.sender_id
    end
   order by c.send_after, c.id;
end $$;

revoke execute on function public.claim_due_emails(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_emails(integer) to service_role;

-- 5. The draw (GCO-011) -------------------------------------------------------------------------------------------------
-- The organiser draws once. Returns one row: how many people are in, how many pairs were kept apart, how many Names are drawn
-- emails were queued (E19 only: the people told, "{told} of {n}"; an organiser who only organises gets E21, not counted), and
-- whether this call did the draw (false when it was already drawn). Refusals: 42501 not signed in; P0002 not the organiser
-- (or no such exchange); 22023 with a hint: cancelled; closed (the exchange is over); few (fewer than 3 people take part);
-- exclusions (no fair draw exists: the pairs rule someone out). Nothing is written on a refusal.
-- WHY the exchange row is locked first (for update): the same lock save_exclusions, join, approve and remove take, so a draw
-- never sees half a change and two draws cannot both write.
-- WHY a repeat call answers and writes nothing: a double tap or a second tab must not draw twice or email twice.
-- WHY no retry (never-do 7): the engine is exact. No rows from it means no fair draw exists, so the draw stops with
-- 'exclusions' instead of trying another seed.
-- WHY any state before the draw (open or joining closed, Q2): a manual draw may come before join-by, and drawing closes
-- joining at once: the state becomes drawn, so join and ask are refused and pending requests close below.
-- WHY the unsent nudges are cancelled (Q12): "your list is missing" after the names are drawn would be wrong.
-- WHY E19 for the organiser who takes part too: they are one of the people, and E19's own copy says "Only you will see it".
-- WHY a Names drawn event for everyone taking part, whatever their email setting (Q6): the feed is not the email.
-- WHY the dedupe key names the round: a later re-draw (slice 14) is a new fact and queues new emails.
create function public.draw_names(p_exchange uuid)
returns table (people_count integer, pairs_excluded integer, emails_queued integer, drawn_now boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
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
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into e from public.exchanges x where x.id = p_exchange and x.organiser_id = v_uid for update;
  if not found then
    raise exception 'exchange not found' using errcode = 'P0002';
  end if;

  v_state := private.exchange_status(e.id);
  if v_state = 'cancelled' then
    raise exception 'exchange cancelled' using errcode = '22023', hint = 'cancelled';
  elsif v_state = 'drawn' then
    people_count := private.drawn_people_count(e.id);
    pairs_excluded := (select count(*)::integer from private.exclusion_pairs(e.id));
    emails_queued := 0;
    drawn_now := false;
    return next;
    return;
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'exchange is over' using errcode = '22023', hint = 'closed';
  end if;

  v_people := private.draw_people(e.id);
  if cardinality(v_people) < 3 then
    raise exception 'too few people' using errcode = '22023', hint = 'few';
  end if;

  select coalesce(array_agg(x.first_member_id), '{}'::uuid[]), coalesce(array_agg(x.second_member_id), '{}'::uuid[]), count(*)::integer
    into v_first, v_second, v_pairs
    from private.exclusion_pairs(e.id) x;

  v_round := e.draw_round + 1;
  insert into private.assignments (exchange_id, giver_member_id, receiver_member_id, draw_round, kind)
  select e.id, m.giver, m.receiver, v_round, 'full'
    from private.compute_matching(v_people, v_first, v_second, gen_random_uuid()::text) m;
  get diagnostics v_rows = row_count;
  if v_rows <> cardinality(v_people) then
    raise exception 'no fair draw' using errcode = '22023', hint = 'exclusions';
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

  people_count := cardinality(v_people);
  pairs_excluded := v_pairs;
  emails_queued := v_told;
  drawn_now := true;
  return next;
end $$;

-- 6. The organiser's read of the draw (GCO-012) ----------------------------------------------------------------------------
-- Organiser only; zero rows for anyone else and for an exchange with no current draw. People, the time of the draw and how many
-- Names are drawn emails are still going out or went out for the current round (E19 not cancelled). A count and a time:
-- never a person and never a pair.
create function public.get_draw_summary(p_exchange uuid)
returns table (people_count integer, drawn_at timestamptz, emails_queued integer)
language sql
stable
security definer
set search_path = ''
as $$
  select d.n, d.first_at,
         (select count(*)::integer from private.email_outbox o
           where o.template = 'E19' and o.exchange_id = e.id and o.cancelled_at is null
             and o.dedupe_key like 'draw:' || e.id::text || ':' || e.draw_round::text || ':%')
  from public.exchanges e
  cross join lateral (
    select count(*)::integer as n, min(a.created_at) as first_at
      from private.assignments a
     where a.exchange_id = e.id and a.superseded_at is null
  ) d
  where e.id = p_exchange and e.organiser_id = auth.uid() and d.n > 0
$$;

-- 7. The giver's reads (GC-014) ---------------------------------------------------------------------------------------------
-- The caller's own current row: its id and whether it was revealed. Zero rows for everyone who is not a giver here (an
-- organiser who only organises, a requester, an outsider), and for a row that has been replaced. No name.
create function public.get_my_assignment(p_exchange uuid)
returns table (assignment_id uuid, revealed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, (a.revealed_at is not null)
  from private.assignments a
  join public.exchange_members g on g.id = a.giver_member_id
  where a.exchange_id = p_exchange and a.superseded_at is null
    and g.user_id = auth.uid() and g.state = 'active'
$$;

-- The person the caller gives to. WHY readable before the reveal tap (GC-014): the page loads it first and the tap only
-- stamps the time, so the reveal is instant and works offline once loaded. WHY the name is the one thing the giver must
-- have; the server never puts it in a page the giver has not asked for (the app calls this from a client component).
--   display_name, avatar_path  the person's own profile fields.
--   list_state  none (nothing attached, or an ideas list with no items), empty (a list with no live items), items.
--   most_wanted up to three live Most wanted items of the attached list, recently changed first, each
--               {ref, name, price_kobo}; ref = md5(this row's salt || the item id). No list name, link, note, photo or id.
-- Only the caller's own current row; zero rows otherwise.
create function public.get_my_recipient(p_exchange uuid)
returns table (display_name text, avatar_path text, list_state text, most_wanted jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select rp.display_name, rp.avatar_path,
         case
           when not private.member_has_list(rm.attached_wishlist_id) then 'none'
           when exists (select 1 from public.wishlist_items i where i.wishlist_id = rm.attached_wishlist_id and i.deleted_at is null) then 'items'
           else 'empty'
         end,
         coalesce((
           select jsonb_agg(jsonb_build_object('ref', md5(a.ref_salt || t.id::text), 'name', t.name, 'price_kobo', t.price_kobo)
                            order by t.updated_at desc, t.id)
             from (
               select i.id, i.name, i.price_kobo, i.updated_at
                 from public.wishlist_items i
                where i.wishlist_id = rm.attached_wishlist_id and i.priority = 'most_wanted' and i.deleted_at is null
                order by i.updated_at desc, i.id
                limit 3
             ) t
         ), '[]'::jsonb)
  from private.assignments a
  join public.exchange_members g on g.id = a.giver_member_id
  join public.exchange_members rm on rm.id = a.receiver_member_id
  join public.profiles rp on rp.id = rm.user_id
  where a.exchange_id = p_exchange and a.superseded_at is null
    and g.user_id = auth.uid() and g.state = 'active'
$$;

-- The reveal tap. Stamps revealed_at once and returns it; every later call returns the first time and changes nothing.
-- Refusals: 42501 not signed in; P0002 for everyone who has no current row here.
-- WHY clock_timestamp: the stamp is the moment of the tap, not the start of the transaction.
create function public.mark_assignment_revealed(p_exchange uuid) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update private.assignments a
     set revealed_at = coalesce(a.revealed_at, clock_timestamp())
    from public.exchange_members g
   where g.id = a.giver_member_id and g.user_id = v_uid and g.state = 'active'
     and a.exchange_id = p_exchange and a.superseded_at is null
  returning a.revealed_at into v_at;
  if not found then
    raise exception 'no assignment' using errcode = 'P0002';
  end if;
  return v_at;
end $$;

-- 8. A request the draw closed (GC-006, Q5) --------------------------------------------------------------------------------
-- The asker clears their own closed request. Refusals: 42501 not signed in; P0002 not theirs (or no such request); 22023 with
-- the hint status when it is not a closed request (a pending one is still waiting; a declined or approved one is not listed).
-- Dismissing again is harmless and keeps the first time.
create function public.dismiss_join_request(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into r from public.join_requests jr where jr.id = p_id and jr.user_id = v_uid for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'closed' then
    raise exception 'request is not closed' using errcode = '22023', hint = 'status';
  end if;
  update public.join_requests set dismissed_at = coalesce(dismissed_at, now()) where id = r.id;
end $$;

-- Same signature and columns as 20261114213838_join_requests, so create or replace keeps the owner and the grants. The only
-- change: a request the draw closed stays in the list until its asker dismisses it. A declined request still disappears
-- without a word (slice 6 Q8).
create or replace function public.list_my_join_requests()
returns table (
  request_id uuid,
  exchange_name text,
  exchange_tint public.exchange_tint,
  organiser_name text,
  status public.join_request_status,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, e.name, e.tint, o.display_name, r.status, r.created_at
  from public.join_requests r
  join public.exchanges e on e.id = r.exchange_id
  join public.profiles o on o.id = e.organiser_id
  where r.user_id = auth.uid()
    and (r.status = 'pending' or (r.status = 'closed' and r.dismissed_at is null))
  order by r.created_at desc, r.id desc
$$;

-- 9. Grants -----------------------------------------------------------------------------------------------------------------
-- WHY revoke first, then grant to signed-in people only: new functions start closed (harden_defaults) and PUBLIC would
-- otherwise reach anon. None of these is on the anon allowlist (test 030).
revoke execute on function public.draw_names(uuid) from public, anon, authenticated;
revoke execute on function public.get_draw_summary(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_assignment(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_recipient(uuid) from public, anon, authenticated;
revoke execute on function public.mark_assignment_revealed(uuid) from public, anon, authenticated;
revoke execute on function public.dismiss_join_request(uuid) from public, anon, authenticated;

grant execute on function public.draw_names(uuid) to authenticated;
grant execute on function public.get_draw_summary(uuid) to authenticated;
grant execute on function public.get_my_assignment(uuid) to authenticated;
grant execute on function public.get_my_recipient(uuid) to authenticated;
grant execute on function public.mark_assignment_revealed(uuid) to authenticated;
grant execute on function public.dismiss_join_request(uuid) to authenticated;
