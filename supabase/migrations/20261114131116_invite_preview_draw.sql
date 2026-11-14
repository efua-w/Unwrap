-- Invite preview gains draw_mode and draw_at (GC-002, owner decision 2026-11-14, slice-5 round 3 item 1).
-- WHY: for an organiser-draws exchange the preview showed the join-by moment as "Names drawn".
-- Both values are already shown to joiners by get_join_details; they reveal nothing about members or pairs.
-- Same body as 20261113151444 otherwise; grants carry over with create or replace.

create or replace function public.get_invite_preview(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.exchanges%rowtype;
  v_state public.exchange_status;
  v_active integer;
  v_joined integer;
  v_status text;
  v_inviter text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into e from public.exchanges where invite_token = p_token;
  if not found then
    return null;
  end if;

  v_state := private.exchange_status(e.id);
  select count(*), count(*) filter (where m.user_id <> e.organiser_id)
    into v_active, v_joined
    from public.exchange_members m
   where m.exchange_id = e.id and m.state = 'active';
  select p.display_name into v_inviter from public.profiles p where p.id = e.organiser_id;

  v_status := case
    when v_state = 'cancelled' then 'cancelled'
    when v_state <> 'open' then 'closed'
    when v_active >= 100 then 'full'
    when e.approval_required then 'approval'
    else 'open'
  end;

  return jsonb_build_object(
    'status', v_status,
    'exchange_name', e.name,
    'tint', e.tint,
    'inviter_name', v_inviter,
    'budget_preset', e.budget_preset,
    'join_by_at', e.join_by_at,
    'gift_day', e.gift_day,
    'joined_count', v_joined,
    'closed_at', case when v_status = 'closed'
      then greatest(e.join_by_at, coalesce(e.reopened_join_by_at, e.join_by_at)) end,
    'cancelled_at', e.cancelled_at,
    'draw_mode', e.draw_mode,
    'draw_at', e.draw_at
  );
end $$;
