-- exclusions — slice 9 (GCO-009 exclusions, the live "is a fair draw possible" check; GCO-011 engine rules; plan §5, §6
-- invariants 2 and 11; owner decisions 2026-11-22 in docs/tasks/slice-9.md; schema approved 2026-11-22).
--
-- Tests written first: supabase/tests/security/280_exclusions.sql (access and behaviour) and 290_compute_matching.sql
-- (the engine against a brute-force oracle). Needs 20261118232507_readiness_and_nudges first (nothing here changes it).
--
-- WHAT THIS ADDS
--   public.exclusions          one row per forbidden pair of MEMBERS (owner decision Q2: a pair follows the membership,
--                              so it leaves the list when either person leaves and does not come back on rejoin).
--                              RLS on, no policy, no grant: only the definer functions below can touch it.
--   private.compute_matching   the draw engine: a pure function, reads no table. People, forbidden pairs (both ways),
--                              a seed in; a FULL matching or ZERO rows out. Randomised greedy start, then augmenting
--                              paths, so it is a maximum matching: no rows is proof, never "try again".
--   private.matching_feasible  the engine's yes/no for the live check.
--   private.assert_pairs_shape the one rule for what a draft of pairs may look like (shared by check and save).
--   private.draw_people        the member ids taking part (active and taking part): the people the draw is about.
--   private.exclusion_pairs    the stored pairs whose two people are both in the draw.
--   public.get_exclusions      D1 the organiser's saved pairs, first names only.
--   public.check_exclusions    D2 judges a DRAFT: people count, is a fair draw possible, and which pair to relax.
--   public.save_exclusions     D3 saves a draft as a diff, under the same exchange lock the draw will take (slice 10).
--
-- WHY no assignment or reservation anywhere (core rule): pairs are the organiser's own settings. Nothing here reads who
-- gives to whom, and the engine's output is never stored here; slice 10 stores it elsewhere. A pair says "these two must
-- not draw each other", which reveals no draw. Only the organiser can read it (invariant 11): `e.organiser_id =
-- auth.uid()` is in every function, so a member, a requester, a removed or left person, an outsider and another
-- exchange's organiser get zero rows (reads) or P0002 (save) and learn nothing; a visitor has no execute grant (42501).
-- WHY first names and member ids and nothing else (owner decision Q1a, 2026-11-22): the pickers get addresses from
-- get_participants, which already allows them for the organiser; these functions never return one.
-- WHY the draw states live in private.exchange_status: save is refused unless the exchange is open or joining has
-- closed. Slice 10 replaces that function to return 'drawn', and the same branch then locks the pairs (AC-6).

-- 1. The table ---------------------------------------------------------------------------------------------
-- WHY no ON DELETE CASCADE (never-do 8): a member row is never deleted, and a pair is removed only by save.
-- WHY first/second kept as the organiser wrote them: the list shows "Nneka Obi and Obinna Obi" as added. WHY the unique
-- index on the normalised pair: (A,B) and (B,A) are one pair, whichever way round it was written.
create table public.exclusions (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges (id),
  first_member_id uuid not null references public.exchange_members (id),
  second_member_id uuid not null references public.exchange_members (id),
  created_at timestamptz not null default now(),
  constraint exclusions_two_people check (first_member_id <> second_member_id)
);

create unique index exclusions_pair_idx on public.exclusions (
  exchange_id, least(first_member_id, second_member_id), greatest(first_member_id, second_member_id)
);

alter table public.exclusions enable row level security;
-- WHY revoke first: Supabase's default ACLs hand new tables to anon and authenticated (see harden_defaults). No policy
-- and no grant: a direct read is refused (42501), not an empty result, and every change is a definer function.
revoke all on public.exclusions from public, anon, authenticated;

-- 2. The engine --------------------------------------------------------------------------------------------
-- Input: p_people (distinct, not null), p_forbidden_first[k] / p_forbidden_second[k] (pair k, forbidden both ways;
-- entries naming someone not in p_people, and a person paired with themself, are ignored), p_seed (any text).
-- Output: one row (giver, receiver) per person, or nothing when no matching exists (also for fewer than 2 people).
-- WHY immutable: the answer depends only on the arguments, so the same seed always gives the same draw.
-- WHY the seed orders people and each giver's receivers by md5(seed, ids): a stable pseudo-random order that needs no
-- random source, so the draw can be re-run and explained.
-- WHY greedy then augmenting paths and no loop over seeds (never-do 7): greedy alone can get stuck on a valid input
-- (an allowed graph that is a path has exactly one answer); an augmenting path from each unmatched giver is the exact
-- algorithm (Kuhn), so when one cannot be found no complete matching exists and we stop. The search is iterative with
-- an explicit stack: no recursion depth to run out of.
-- WHY a cap of 500 people: the arrays are n by n; a group is far smaller (the plan sizes for 100).
create function private.compute_matching(
  p_people uuid[],
  p_forbidden_first uuid[],
  p_forbidden_second uuid[],
  p_seed text
) returns table (giver uuid, receiver uuid)
language plpgsql
immutable
set search_path = ''
as $$
declare
  n int;
  k int;
  a int;
  b int;
  g int;
  j int;
  t int;
  ptr_pos int;
  deg_count int;
  depth int;
  done boolean;
  ord int[];
  forb boolean[];
  adj int[];
  deg int[];
  cand int[];
  match_g int[];
  match_r int[];
  stack_g int[];
  via int[];
  ptr int[];
  visited boolean[];
begin
  if p_people is null or p_forbidden_first is null or p_forbidden_second is null or p_seed is null
     or coalesce(array_ndims(p_people), 1) > 1
     or coalesce(array_ndims(p_forbidden_first), 1) > 1
     or coalesce(array_ndims(p_forbidden_second), 1) > 1
     or cardinality(p_forbidden_first) <> cardinality(p_forbidden_second) then
    raise exception 'bad matching input' using errcode = '22023';
  end if;
  n := cardinality(p_people);
  if n > 500
     or exists (select 1 from unnest(p_people) x where x is null)
     or exists (select 1 from unnest(p_forbidden_first) x where x is null)
     or exists (select 1 from unnest(p_forbidden_second) x where x is null)
     or (select count(distinct x) from unnest(p_people) x) <> n then
    raise exception 'bad matching input' using errcode = '22023';
  end if;
  if n < 2 then
    return;
  end if;

  -- Forbidden pairs as a flat n-by-n table, both directions.
  forb := array_fill(false, array[n * n]);
  for k in 1 .. coalesce(cardinality(p_forbidden_first), 0) loop
    a := array_position(p_people, p_forbidden_first[k]);
    b := array_position(p_people, p_forbidden_second[k]);
    if a is not null and b is not null and a <> b then
      forb[(a - 1) * n + b] := true;
      forb[(b - 1) * n + a] := true;
    end if;
  end loop;

  select array_agg(i order by md5(p_seed || ':' || p_people[i]::text)) into ord from generate_series(1, n) i;

  -- Each giver's allowed receivers, in that giver's own seeded order, in one flat table plus a count per giver.
  adj := array_fill(0, array[n * n]);
  deg := array_fill(0, array[n]);
  for g in 1 .. n loop
    select array_agg(i order by md5(p_seed || ':' || p_people[g]::text || ':' || p_people[i]::text)) into cand
      from generate_series(1, n) i where i <> g;
    deg_count := 0;
    foreach j in array cand loop
      if not forb[(g - 1) * n + j] then
        deg_count := deg_count + 1;
        adj[(g - 1) * n + deg_count] := j;
      end if;
    end loop;
    deg[g] := deg_count;
  end loop;

  match_g := array_fill(0, array[n]);
  match_r := array_fill(0, array[n]);

  -- Greedy start in seed order: each giver takes their first free receiver.
  for t in 1 .. n loop
    g := ord[t];
    for k in 1 .. deg[g] loop
      j := adj[(g - 1) * n + k];
      if match_r[j] = 0 then
        match_g[g] := j;
        match_r[j] := g;
        exit;
      end if;
    end loop;
  end loop;

  -- Augmenting paths for the givers greedy left out. stack_g[d] is the giver being tried at depth d and via[d] the
  -- receiver it is trying; if that receiver is taken, its current giver is tried next, one level down.
  stack_g := array_fill(0, array[n + 1]);
  via := array_fill(0, array[n + 1]);
  ptr := array_fill(1, array[n]);
  for t in 1 .. n loop
    g := ord[t];
    if match_g[g] <> 0 then
      continue;
    end if;
    visited := array_fill(false, array[n]);
    depth := 1;
    stack_g[1] := g;
    ptr[g] := 1;
    done := false;
    while depth > 0 loop
      g := stack_g[depth];
      ptr_pos := ptr[g];
      if ptr_pos > deg[g] then
        depth := depth - 1;
        continue;
      end if;
      ptr[g] := ptr_pos + 1;
      j := adj[(g - 1) * n + ptr_pos];
      if visited[j] then
        continue;
      end if;
      visited[j] := true;
      via[depth] := j;
      if match_r[j] = 0 then
        -- Free receiver: shift every giver on the path onto the receiver it was trying.
        for k in 1 .. depth loop
          match_r[via[k]] := stack_g[k];
          match_g[stack_g[k]] := via[k];
        end loop;
        done := true;
        exit;
      end if;
      depth := depth + 1;
      stack_g[depth] := match_r[j];
      ptr[match_r[j]] := 1;
    end loop;
    if not done then
      -- WHY return nothing at once: a maximum matching smaller than n means no valid draw exists.
      return;
    end if;
  end loop;

  return query select p_people[x], p_people[match_g[x]] from generate_series(1, n) x;
end $$;

-- WHY a fixed seed: the engine is exact, so the verdict does not depend on the seed.
create function private.matching_feasible(p_people uuid[], p_forbidden_first uuid[], p_forbidden_second uuid[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from private.compute_matching(p_people, p_forbidden_first, p_forbidden_second, 'feasibility'))
$$;

-- 3. The draft rules ---------------------------------------------------------------------------------------
-- Hint 'pairs': not two same-length arrays, more than 200 pairs, an empty entry, or a person paired with themself.
-- WHY 200: bounds the work of check_exclusions, which tries each pair when the draw is impossible.
create function private.assert_pairs_shape(p_first uuid[], p_second uuid[]) returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_first is null or p_second is null
     or coalesce(array_ndims(p_first), 1) > 1 or coalesce(array_ndims(p_second), 1) > 1
     or cardinality(p_first) <> cardinality(p_second)
     or cardinality(p_first) > 200
     or exists (select 1 from unnest(p_first, p_second) t(a, b) where a is null or b is null or a = b) then
    raise exception 'bad pairs' using errcode = '22023', hint = 'pairs';
  end if;
end $$;

-- 4. The people and the pairs ------------------------------------------------------------------------------
-- WHY member ids and join order: the draw is between memberships (owner decision Q2), and a fixed order keeps results
-- stable. Active and taking part is the one definition of "in the draw", also used by get_readiness.
create function private.draw_people(p_exchange uuid) returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.id order by m.joined_at, m.id), '{}'::uuid[])
  from public.exchange_members m
  where m.exchange_id = p_exchange and m.state = 'active' and m.taking_part
$$;

-- WHY both people must be in the draw: a pair with someone who left, was removed or is not taking part cannot affect
-- the draw, and the organiser must not see a name that is no longer in it. The row stays in the table.
create function private.exclusion_pairs(p_exchange uuid)
returns table (id uuid, first_member_id uuid, second_member_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.first_member_id, x.second_member_id, x.created_at
  from public.exclusions x
  where x.exchange_id = p_exchange
    and x.first_member_id = any (private.draw_people(p_exchange))
    and x.second_member_id = any (private.draw_people(p_exchange))
$$;

revoke execute on function private.compute_matching(uuid[], uuid[], uuid[], text) from public, anon, authenticated;
revoke execute on function private.matching_feasible(uuid[], uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function private.assert_pairs_shape(uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function private.draw_people(uuid) from public, anon, authenticated;
revoke execute on function private.exclusion_pairs(uuid) from public, anon, authenticated;

-- 5. D1: the organiser's saved pairs -----------------------------------------------------------------------
-- Oldest first, so "most recently added" is the last row. First names and member ids only. Readable in every state: the
-- locked view after the draw shows the same list without the controls.
create function public.get_exclusions(p_exchange uuid)
returns table (
  id uuid,
  first_member_id uuid,
  first_name text,
  second_member_id uuid,
  second_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.first_member_id, fp.display_name, x.second_member_id, sp.display_name, x.created_at
  from private.exclusion_pairs(p_exchange) x
  join public.exchanges e on e.id = p_exchange and e.organiser_id = auth.uid()
  join public.exchange_members fm on fm.id = x.first_member_id
  join public.profiles fp on fp.id = fm.user_id
  join public.exchange_members sm on sm.id = x.second_member_id
  join public.profiles sp on sp.id = sm.user_id
  order by x.created_at, x.id
$$;

-- 6. D2: judge a draft -------------------------------------------------------------------------------------
-- The draft is the whole list as it would be saved (nothing is read from or written to the stored pairs), as two
-- same-length arrays of member ids. One row for the organiser; zero rows for anyone else.
--   people_count  how many people are in the draw.
--   feasible      three or more people AND a fair draw exists (GCO-009: "Names need at least 3 people to draw.").
--   relax_first / relax_second  when three or more people are in and no fair draw exists: the LAST pair of the draft
--                 whose removal alone fixes it, as the draft wrote it (owner decision Q3a); null when no single pair does
--                 (Q3b) and whenever feasible or fewer than 3 people. Pairs naming people not in the draw are ignored.
-- Refusals: 42501 not signed in; 22023 hint 'pairs' (a bad draft; checked for the organiser only, so a stranger learns
-- nothing from the error).
create function public.check_exclusions(p_exchange uuid, p_first uuid[], p_second uuid[])
returns table (people_count integer, feasible boolean, relax_first uuid, relax_second uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_people uuid[];
  v_n integer;
  v_ok boolean;
  v_rf uuid;
  v_rs uuid;
  v_k integer;
  v_first uuid[];
  v_second uuid[];
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.exchanges e where e.id = p_exchange and e.organiser_id = v_uid) then
    return;
  end if;
  perform private.assert_pairs_shape(p_first, p_second);

  v_people := private.draw_people(p_exchange);
  v_n := cardinality(v_people);
  v_ok := false;
  if v_n >= 3 then
    v_ok := private.matching_feasible(v_people, p_first, p_second);
    if not v_ok then
      for v_k in reverse cardinality(p_first) .. 1 loop
        -- The draft without this pair (and without a copy of it written the other way round).
        select coalesce(array_agg(t.a order by t.o), '{}'::uuid[]), coalesce(array_agg(t.b order by t.o), '{}'::uuid[])
          into v_first, v_second
          from unnest(p_first, p_second) with ordinality t(a, b, o)
         where not (least(t.a, t.b) = least(p_first[v_k], p_second[v_k])
                    and greatest(t.a, t.b) = greatest(p_first[v_k], p_second[v_k]));
        if private.matching_feasible(v_people, v_first, v_second) then
          v_rf := p_first[v_k];
          v_rs := p_second[v_k];
          exit;
        end if;
      end loop;
    end if;
  end if;

  return query select v_n, v_ok, v_rf, v_rs;
end $$;

-- 7. D3: save a draft --------------------------------------------------------------------------------------
-- The draft replaces the visible pairs: pairs not in it are deleted, pairs new in it are inserted in draft order, pairs
-- in both are left alone (their row, id and place in the list stay, so "most recently added" survives a save). A pair
-- written twice, or both ways round, is one pair. Returns how many pairs are saved for the exchange afterwards.
-- Saving a draft that blocks the draw is allowed (more people may join; the draw checks again). Pairs naming people who
-- are no longer in the draw are left in the table untouched and stay out of sight.
-- Refusals: 42501 not signed in; P0002 not the organiser (or no such exchange); 22023 with a hint: cancelled; closed (the
-- exchange is past joining, so the draw or the end has the final word, and from slice 10 the names are drawn); pairs (a
-- bad draft); members (someone in the draft is not taking part in this exchange now: the list on screen is stale).
-- WHY the lock on the exchange row (for update): the same lock the draw takes, so a save and a draw cannot interleave
-- and a draw never sees half a save. WHY created_at = a base time plus the draft position: the order within one save is
-- the order the organiser added them, and the base keeps it after the pairs saved before.
create function public.save_exclusions(p_exchange uuid, p_first uuid[], p_second uuid[]) returns integer
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
  v_base timestamptz := clock_timestamp();
  v_n integer;
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
  elsif v_state not in ('open', 'joining_closed') then
    raise exception 'pairs are locked' using errcode = '22023', hint = 'closed';
  end if;

  perform private.assert_pairs_shape(p_first, p_second);
  v_people := private.draw_people(e.id);
  if exists (select 1 from unnest(p_first || p_second) m where m <> all (v_people)) then
    raise exception 'someone is not taking part' using errcode = '22023', hint = 'members';
  end if;

  delete from public.exclusions x
   where x.exchange_id = e.id
     and x.first_member_id = any (v_people)
     and x.second_member_id = any (v_people)
     and not exists (
       select 1 from unnest(p_first, p_second) t(a, b)
        where least(t.a, t.b) = least(x.first_member_id, x.second_member_id)
          and greatest(t.a, t.b) = greatest(x.first_member_id, x.second_member_id)
     );

  -- New pairs in draft order, each pair once (its first position in the draft).
  for r in
    select d.a, d.b, d.o
      from (
        select distinct on (least(t.a, t.b), greatest(t.a, t.b)) t.a, t.b, t.o
          from unnest(p_first, p_second) with ordinality t(a, b, o)
         order by least(t.a, t.b), greatest(t.a, t.b), t.o
      ) d
     order by d.o
  loop
    insert into public.exclusions (exchange_id, first_member_id, second_member_id, created_at)
    values (e.id, r.a, r.b, v_base + r.o * interval '1 microsecond')
    on conflict do nothing;
  end loop;

  select count(*)::integer into v_n
    from public.exclusions x
   where x.exchange_id = e.id
     and x.first_member_id = any (v_people)
     and x.second_member_id = any (v_people);
  return v_n;
end $$;

revoke execute on function public.get_exclusions(uuid) from public, anon, authenticated;
revoke execute on function public.check_exclusions(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function public.save_exclusions(uuid, uuid[], uuid[]) from public, anon, authenticated;

grant execute on function public.get_exclusions(uuid) to authenticated;
grant execute on function public.check_exclusions(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.save_exclusions(uuid, uuid[], uuid[]) to authenticated;
