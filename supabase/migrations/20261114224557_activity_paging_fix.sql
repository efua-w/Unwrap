-- activity paging fix — slice 6 (GC-007; test 200 #33).
--
-- WHY: get_my_activity with a before-time and no before-id compared (created_at, id) against
-- (before-time, ffffffff-…), so events AT the before-time were still returned. "Load older" would then
-- repeat them. A before-time alone now means strictly earlier; with a before-id the keyset is unchanged.
-- Same signature, columns, ordering, clamp and grants as 20261114213747_activity_events.

create or replace function public.get_my_activity(
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  kind public.activity_kind,
  exchange_id uuid,
  exchange_name text,
  exchange_tint public.exchange_tint,
  subject_name text,
  created_at timestamptz,
  is_unread boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select ae.id, ae.kind, ae.exchange_id, e.name, e.tint, p.display_name, ae.created_at, (ae.read_at is null)
  from public.activity_events ae
  join public.exchanges e on e.id = ae.exchange_id
  left join public.profiles p on p.id = ae.subject_user_id
  where ae.user_id = auth.uid()
    and (
      p_before_at is null
      or (p_before_id is null and ae.created_at < p_before_at)
      or (p_before_id is not null and (ae.created_at, ae.id) < (p_before_at, p_before_id))
    )
  order by ae.created_at desc, ae.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
$$;
