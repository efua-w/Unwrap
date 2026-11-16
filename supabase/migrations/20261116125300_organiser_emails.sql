-- organiser_emails — organiser-emails (GCO-007, GCO-003, GC-009, GCO-008 story text; owner decisions 2026-11-15 and
-- 2026-11-16 Q1, Q2, Q3).
--
-- Tests written first: supabase/tests/security/210_organiser_emails.sql (190 is updated for the two new shapes).
-- Needs 20261114213838_join_requests first (it creates the two functions replaced here).
--
-- WHAT THIS CHANGES
--   get_participants(exchange)   gains email and has_wishlist.
--   get_join_requests(exchange)  gains email.
-- Nothing else: no table, no column, no policy. The address is read from auth.users inside a SECURITY DEFINER
-- function, so no table in `public` gets an email column (test 060 stays as it is).
--
-- WHY (owner decision 2026-11-15): organisers can see their participants' email addresses. This reverses the
-- earlier rule that the organiser never reads addresses (slice 6 AC-41). Pair secrecy and asymmetric visibility
-- are unchanged: neither function carries an assignment, a pair, a reservation, an item or a joined time.
-- WHY the organiser only (AC-12, AC-42): `e.organiser_id = auth.uid()` is in the WHERE clause, so a member, a
-- requester, a removed or left person, an outsider and another exchange's organiser get zero rows, not an error,
-- and learn nothing. A visitor has no execute grant (42501).
-- WHY the organiser's own row has a null email (owner decision 2026-11-16 Q2): nobody needs their own address
-- on the list. The row still carries has_wishlist, as on the board.
-- WHY has_wishlist mirrors the member's own screen (owner decision 2026-11-16 Q1, reverses slice 6 Q13 for the
-- status text, and the follow-up on empty ideas lists): get_my_exchange_list says 'none' for nothing attached and for
-- an exchange_ideas list with no live items, and 'wishlist', 'ideas' or 'kept' otherwise. So: a list is attached, and
-- it is not an ideas list with no live items. An empty real wishlist, and a deleted list the giver keeps, stay true.
-- The only item read is an exists() on live items; no item, reservation or list name is returned.
-- WHY no joined_at: "Joined just now" is shown by the UI for a person approved in this session; the board needs
-- no stored time.
-- WHY drop and recreate (owner decision 2026-11-16 Q3, the planner's recommendation): the return type changes,
-- which create or replace cannot do. Dropping removes the grants, so they are re-issued below. Only the app calls
-- these two functions, and nothing in the database depends on them.

drop function public.get_participants(uuid);
drop function public.get_join_requests(uuid);

-- The organiser's pending requests: name, time and address, oldest first.
create function public.get_join_requests(p_exchange uuid)
returns table (request_id uuid, display_name text, requested_at timestamptz, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.display_name, r.created_at, u.email::text
  from public.join_requests r
  join public.exchanges e on e.id = r.exchange_id
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where r.exchange_id = p_exchange
    and r.status = 'pending'
    and e.organiser_id = auth.uid()
  order by r.created_at, r.id
$$;

-- The organiser's list of active members (S30): name, flags, address and whether a list is attached.
create function public.get_participants(p_exchange uuid)
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
         exists (
           select 1 from public.wishlists w
           where w.id = m.attached_wishlist_id
             and (
               w.kind <> 'exchange_ideas'
               or w.deleted_at is not null
               or exists (select 1 from public.wishlist_items i where i.wishlist_id = w.id and i.deleted_at is null)
             )
         )
  from public.exchange_members m
  join public.exchanges e on e.id = m.exchange_id
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.exchange_id = p_exchange
    and m.state = 'active'
    and e.organiser_id = auth.uid()
  order by (m.user_id = e.organiser_id) desc, m.joined_at, m.id
$$;

-- Grants: dropping removed them. WHY revoke first, then grant to signed-in people only: new functions start closed
-- (harden_defaults) and PUBLIC would otherwise reach anon. The anon allowlist (test 030) is unchanged.
revoke execute on function public.get_join_requests(uuid) from public, anon, authenticated;
revoke execute on function public.get_participants(uuid) from public, anon, authenticated;

grant execute on function public.get_join_requests(uuid) to authenticated;
grant execute on function public.get_participants(uuid) to authenticated;
