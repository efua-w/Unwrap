-- share_and_default_visibility — slice 3 (GC-022, GC-023, GC-027; plan §3, §5, §6).
--
-- Tests written first: supabase/tests/security/030_function_allowlist.sql (exact signatures),
-- 110_default_wishlist_visibility.sql, 120_get_shared_wishlist.sql.
--
-- WHAT THIS ADDS
--   public.user_settings.default_wishlist_visibility   what a new list starts as (GC-027).
--   public.get_shared_wishlist(text)                    the public, no-account view of one list by
--                                                       its share token (GC-023). One of the two
--                                                       functions anon may execute (test 030).

-- 1. Default visibility ---------------------------------------------------------------------------
-- WHY not null default 'private': new lists start Private unless the person changes it (GC-019,
-- GC-027), and an existing person's row is Private after this migration.
alter table public.user_settings
  add column default_wishlist_visibility public.wishlist_visibility not null default 'private';

-- WHY a column grant: the table has no blanket update grant, so a person can write this one column
-- (and timezone) of their own row (policy user_settings_update_own) and nothing else.
grant update (default_wishlist_visibility) on public.user_settings to authenticated;

-- 2. The public view of a shared list -------------------------------------------------------------
-- WHY SECURITY DEFINER with a fixed search_path: anon has no grant on wishlists, items or profiles
-- (plan §6). The function is the whole public read path, and it answers only for a live, personal,
-- link-visible list whose owner is not anonymised.
--
-- WHY the token pattern check first: a malformed token (null, empty, uppercase, wrong length, SQL
-- text) is "unknown" without touching the table. A well-formed one is compared in full.
--
-- WHY one answer, null, for private, deleted, ideas, anonymised-owner and unknown lists
-- (GC-023: "one answer for all"): the caller can never tell which case it was.
--
-- WHY exactly these keys: name, owner_display_name, and per item name, link, price_kobo, priority,
-- note. No ids, no owner id, no photo path, no timestamps. SLICE 11 MUST NEVER EXTEND THIS PAYLOAD
-- WITH PURCHASE MARKS OR GIVER DATA: this view is readable by anyone holding the link, including
-- the list's owner, who must not learn what others did with their list (GC-020, core security rule).
-- Giver-side data gets its own function, gated by the assignment.
--
-- WHY newest-changed first, then id: the same order as the owner's detail page (GC-020), made total
-- so two items changed in the same instant keep a stable order.
create function public.get_shared_wishlist(p_token text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', w.name,
    'owner_display_name', p.display_name,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', i.name,
            'link', i.link,
            'price_kobo', i.price_kobo,
            'priority', i.priority,
            'note', i.note
          )
          order by i.updated_at desc, i.id
        )
        from public.wishlist_items i
        where i.wishlist_id = w.id and i.deleted_at is null
      ),
      '[]'::jsonb
    )
  )
  from public.wishlists w
  join public.profiles p on p.id = w.owner_id
  where p_token ~ '^[0-9a-f]{32}$'
    and w.share_token = p_token
    and w.kind = 'personal'
    and w.visibility = 'link'
    and w.deleted_at is null
    and p.anonymised_at is null
$$;

-- WHY revoke first, then grant by role: new functions start closed (harden_defaults), and PUBLIC
-- would otherwise reach anon. anon is the point (no account); authenticated is a signed-in visitor.
revoke execute on function public.get_shared_wishlist(text) from public, anon, authenticated;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
