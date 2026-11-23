-- Slice 10 round 3 (GCO-012, GC-002; owner decision 2026-11-22 Q2, review finding R1-1).
-- Tests written first: supabase/tests/security/330_invite_preview_drawn.sql.
--
-- After an early draw the invite page said "{organiser} closed joining for X on <join-by date>", and the join-by date was
-- still in the future. When the exchange is drawn, closed_at is now the draw moment.
--
--   private.exchange_drawn_at     the earliest created_at among the exchange's current assignments, or null. WHY a definer
--                                 helper: private.assignments has no grant to any role, and the preview must read one moment
--                                 from it without ever touching a giver, a receiver or a pair.
--   public.get_invite_preview     create or replace: the same body as 20261114213838_join_requests, plus the closed_at
--                                 change for the 'drawn' state. Owner, grants and search_path are unchanged.

create function private.exchange_drawn_at(p_exchange uuid) returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(a.created_at)
  from private.assignments a
  where a.exchange_id = p_exchange and a.superseded_at is null
$$;

revoke execute on function private.exchange_drawn_at(uuid) from public, anon, authenticated;

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
    -- CHANGED: a drawn exchange closed when its names were drawn, which can be well before join-by (Q2).
    'closed_at', case
      when v_status = 'closed' and v_state = 'drawn'
        then coalesce(private.exchange_drawn_at(e.id), greatest(e.join_by_at, coalesce(e.reopened_join_by_at, e.join_by_at)))
      when v_status = 'closed'
        then greatest(e.join_by_at, coalesce(e.reopened_join_by_at, e.join_by_at))
    end,
    'cancelled_at', e.cancelled_at,
    'draw_mode', e.draw_mode,
    'draw_at', e.draw_at,
    'can_ask', case
      when v_active >= 100 then false
      when v_state = 'open' then e.approval_required
      when v_state = 'joining_closed' then true
      else false
    end
  );
end $$;
