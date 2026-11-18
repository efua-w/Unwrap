-- email_outbox_details — slice 7 round 3 (owner decisions 2026-11-17, docs/tasks/slice-7.md "after builder round 2").
--
-- Tests written first: supabase/tests/security/250_email_cascade.sql (new), 220_email_outbox.sql (four new
-- assertions on the claim's columns) and 230_email_invites.sql (the "no cascade" assertion now says "cascade").
-- Needs 20261117053228_email_outbox first.
--
-- 1. The five foreign keys on private.email_outbox and public.email_invites become ON DELETE CASCADE, so a queued
--    email or an invite is deleted with the person (as recipient, sender or inviter) or the exchange it belongs to.
--    WHY (owner): an email that has not been sent is worthless once its person or exchange is gone, and no
--    role can delete outbox rows by hand. Nothing else cascades: profiles and exchanges are still referenced with
--    NO ACTION by every other table (never-do 8), so they can only be deleted once those rows are gone.
-- 2. claim_due_emails returns what E06 shows on its board: the budget preset, the join-by moment, the gift day and
--    the organiser's note. They are set for E06 only and are null for every other template. WHY not the draw mode
--    or draw time: the email must not promise an automatic draw. Everything the invitee may read here is already
--    on the public invite page (budget, join-by, gift day) or is the note the organiser wrote for everyone.
--    A drop and a create, because the result type changes; the grants are set again below.

-- 1. Cascades ----------------------------------------------------------------------------------------
alter table private.email_outbox
  drop constraint email_outbox_recipient_user_id_fkey,
  drop constraint email_outbox_sender_id_fkey,
  drop constraint email_outbox_exchange_id_fkey;
alter table private.email_outbox
  add constraint email_outbox_recipient_user_id_fkey foreign key (recipient_user_id) references public.profiles (id) on delete cascade,
  add constraint email_outbox_sender_id_fkey foreign key (sender_id) references public.profiles (id) on delete cascade,
  add constraint email_outbox_exchange_id_fkey foreign key (exchange_id) references public.exchanges (id) on delete cascade;

alter table public.email_invites
  drop constraint email_invites_exchange_id_fkey,
  drop constraint email_invites_sent_by_fkey;
alter table public.email_invites
  add constraint email_invites_exchange_id_fkey foreign key (exchange_id) references public.exchanges (id) on delete cascade,
  add constraint email_invites_sent_by_fkey foreign key (sent_by) references public.profiles (id) on delete cascade;

-- 2. The claim with E06's details ----------------------------------------------------------------------
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
  note text
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
         c.attempts,
         case when c.template = 'E06' then x.budget_preset::text end,
         case when c.template = 'E06' then x.join_by_at end,
         case when c.template = 'E06' then x.gift_day end,
         case when c.template = 'E06' then x.note end
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

revoke execute on function public.claim_due_emails(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_emails(integer) to service_role;
