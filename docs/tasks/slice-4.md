# Slice 4 — Start an exchange

Stories: GCO-001, GCO-002, GCO-003, GCO-004; GC-008 (basic); GC-013 (just started); GC-029 (Not available).
Boards: S26 Org-Basics-*, S27 Org-Budget-*, S28 Org-Review-*, S47 Acc-NA-exchange (canvas "Unwrap • Part 2");
S14 Exchange-Detail-started/-ojust/-copied/-loading/-error/-offline, S08 Exchanges-* (canvas "Unwrap").
Local board copies (data only): scratchpad `artifact-files/47637980-…/project/` and `artifact-files/e419cb4a-…/project/`.

## Planner — round 1 — 2026-11-09
- Task: slice-4 — three-step create, "just started" exchange page, basic Exchanges list
- Requirements: as above; plan §3–§6, §10 row 4; progress decision 2026-11-03 (deferrals), open item 53
- Work completed: full plan (scope, schema, pgTAP 130 list, routes, files, AC-1..AC-21, test plan) without boards; 20 questions
- Outstanding issues: boards not read
- Next action: main session fetches boards; planner round 2

## Planner — round 2 — 2026-11-09
- Task: slice-4 — revise against boards
- Work completed: boards settle copy and states for S26/S27/S28/S14/S08/S47 (all exact strings listed in the planner report, to go into copy-pending as "from board"); "When I choose" = manual draw, `draw_at` null, join closes at the end of the join-by day (next local midnight, exclusive); note ≤ 280; organiser zone from the browser, short name shown; no faces on rows; budget presets follow the Decisions table (₦5,000 to ₦10,000; ₦10,000 to ₦20,000; ₦20,000 to ₦50,000; Above ₦50,000), not the board's ranges.
- Schema delta: note ≤ 280; CHECK `(draw_mode='at_join_by') = (draw_at is not null)`; at_join_by ⇒ draw_at = join_by_at; create_exchange has no draw-date argument and ignores draw time in organiser_chooses; refusal hints `name|note|budget|join_by|event|time_zone`.
- New components: SegmentedTabs (draw mode, Active/Past), Timeline ("What happens next"), ExchangeTag; ShareActions extracted from ShareSheet.
- Outstanding issues: owner questions 1–12
- Next action: owner answers

## Owner decisions — 2026-11-09 (Tobechukwu Olih: "Accept all slice 4 recommendations")
1. Budget labels use "to" everywhere ("₦10,000 to ₦20,000"; top preset "Above ₦50,000"). Rewrite GCO-004 Content to match.
2. Just-started header follows S14: title "Only you so far."; subline "Created by you on {Mon 2 Nov} · Everyone spends {budget}". Rewrite GCO-004 Content.
3. Just-started sections follow S14 exactly: no separate Dates section, no note. **Owner 2026-11-09 (follow-up):** add "Times are in your time zone ({zone})." under "What happens next" (zone short name from Intl, viewer's zone).
4. Invite link = `{SITE_URL}/i/<32-hex token>` (plan, not the board's `/j/slug`). Token readable by the organiser only, via `get_exchange_invite_token`. Show the link with Share to WhatsApp / Copy link now; slice 4 is not released without slice 5 (as open item 41).
5. Hide every control with nothing behind it yet: Invite by email (slice 7), Add your wishlist (5), Organiser tools Invite people (5), Edit details (13), Draw names now… (10), Cancel exchange… (15). The Organiser tools heading is hidden while empty. "Share invite link" on the Exchanges block goes to the exchange page's invite section.
6. "Are you taking part?" preselects "Yes, I'm in". "Who can join?" preselects "Anyone with the link".
7. Tint: the one used least among the organiser's live exchanges, ties broken at random; never changes.
8. Date rules: "When joining closes": join-by moment < gift moment, both in the future, no minimum gap, no maximum. "When I choose": join-by day before the gift day.
9. Create the later-slice `exchanges` columns now (cancelled_at, completed_at, reopened_join_by_at, draw_blocked_reason, draw_round), no client grants. `attached_wishlist_id` lands in slice 5.
10. Copy: Review "Names drawn" in "When I choose" = "When you're ready"; "Join by has to be in the future."; "The gift day has to be in the future."; detail load error "We couldn't load this exchange. Nothing has changed."; Exchanges load error "We couldn't load your exchanges. Your wishlists still work." (until slice 6).
11. Home unchanged in slice 4; log an open item.
12. (a) Accept the small duplicate-on-retry risk (no idempotency column). (b) Approved: apply the `exchanges` migration to dev `ulziqspdjtjszvdcwdek` once pgTAP 130 is written and seen failing.

## Builder — phase A — 2026-11-09
- Task: slice-4 — database only (security test first, then migration); nothing applied, no database contacted
- Requirements: GCO-001..004, GC-008, GC-013; plan §5, §6; owner decisions 7, 8, 9, 12
- Files/components: supabase/tests/security/130_exchanges.sql (new, 80 assertions); supabase/migrations/20261109104617_exchanges.sql (new)
- Work completed: pgTAP 130 written first; migration adds 5 enums, exchanges, exchange_members (RLS, no write grants, column select grants, invite_token and left_at not readable), is_member/is_organiser, create_exchange, exchange_state, get_exchange_invite_token, invite-token trigger. 030 left unchanged on purpose (it lists only what anon may execute; all new functions are authenticated-only, so adding them would weaken it). Not run: no local database; owner approved applying to dev once 130 is seen failing (decision 12b).
- Decisions: refusal order event-in-past before join-by (so a past gift date reports on `event`); join-by not strictly before gift reports on `join_by`; null taking_part -> true, null approval -> false; exchange_state uses greatest(join_by_at, reopened_join_by_at); 'drawn' unreachable until slice 10.
- Outstanding issues: tie-break randomness of tint untested (not deterministic); both files unrun
- Next action: main session runs 130 against dev (red), applies migration with owner approval, reruns 130, 030, 040, 010; regenerates types

- 2026-11-09 main session: first run on dev 77/80; tests 9, 10, 12 failed only on boolean text format (t/f vs true/false) in the test's own format() output (CLAUDE.md known trap). Fixed with ::text casts; assertions unchanged.
- 2026-11-09 main session: migration applied to dev as version 20261109104934 (file renamed to match). pgTAP on dev: 130 80/80 (after the cast fix), 010 4/4, 030 7/7, 040 5/5. Red before apply confirmed (42P01 relation public.exchanges does not exist).

## Builder — phase B — 2026-11-09
- Task: slice-4 — app code (planner steps 3 to 7); migration, pgTAP and generated types untouched
- Requirements: GCO-001..004, GC-008, GC-013, GC-029 (Not available); owner decisions 1 to 12 (decision 3 includes the "Times are in your time zone ({zone})." line)
- Files/components: lib/dates/format.ts, lib/money/budget.ts, lib/validation/exchange.ts, lib/site-url.ts (buildInviteUrl); components/ui/{LocalDateTime,ExchangeTag,SegmentedTabs,Timeline,ShareActions}.tsx, Field (date/time), RadioGroup (error, empty value), ListRow (leading); components/auth/AuthFrame.tsx (eyebrow, headerAction); features/exchanges/* (copy, types, timeline, summary, queries, actions, StartExchangeFlow, ExchangeJustStarted, InviteSection, ExchangeBlock, LoadError); app/(app)/exchanges/{page,new/page,[id]/page}.tsx; Profile Back; ShareSheet moved onto ShareActions; gallery entries; tests/unit/exchanges.test.ts; tests/e2e/exchanges-signed-in.spec.ts; docs (copy-pending, progress, user-stories GCO-001..004, GC-008, GC-013)
- Work completed: all three steps, create via rpc create_exchange (no user id sent, 22023 hint mapped to the field line, other failures to the S28 alert with inputs kept, offline disables Start), just-started organiser page with invite link (organiser-only props), Not available with no exchange data, Exchanges list with block, tabs, past empty, first-time. Verified: typecheck, lint, tokens:check, secrets:check, npm test 191/191, e2e exchanges-signed-in + share-signed-in 21/21 (390/768/1440, axe included), gallery 54/54, auth-entry and others green on a re-run (see report)
- Outstanding issues: see report (Known limitations); needs reviewer/tester pass; not committed
- Next action: tester then reviewer; main session commits when the owner asks
- 2026-11-09 main session: merged origin/main 8efdd04 (PR #8 money grouping) under the uncommitted slice 4 tree, no conflicts; typecheck, lint, tokens and unit re-run.

## Tester — round 1 — 2026-11-09
- PASS. typecheck, lint, tokens, unit 194/194, secrets; e2e exchanges 18/18, share 3/3, wishlists 6/6, gallery 54/54, auth-entry 155 (+4 skipped), shell 10 (+2 skipped), shared-wishlist 12/12, visual 12/12; no flakes. Secrecy probe: invite token only in the organiser detail page; none for outsider/member in HTML or RSC; no emails; nothing in dev log.
- Observations (Low): a non-organiser member sees the exchange row but its page is Not available (slice 5 adds the member view); copy toast survives navigation to the list; full-page screenshot overlay artefact.
- Not tested: human phone click-through, real WhatsApp, build.
- Next action: reviewer round 1.

## Reviewer — round 1 — 2026-11-09
- APPROVED. No Critical/High. Medium: R1-1 server join_by refusal always maps to "before the gift day" even when in the past; R1-2 "You can change any of this later." promises editing (slice 13); R1-3 nine pending-copy lines already in UI. Low: R1-4 last joining day across zones; R1-5 server cuts long name; R1-6 share copy inside ShareActions; R1-7 progress status wording; R1-8 draw_blocked_reason readable by members (slice 10 watch); R1-9 DST gaps (not in West Africa).
- Next action: builder fixes R1-1 (cheap, no DB change) and R1-7; owner decides R1-2 and approves R1-3 copy.

## Builder — fix round 1 — 2026-11-09
- Task: slice-4 — reviewer round 1 fixes R1-1, R1-7
- Files: lib/validation/exchange.ts (fieldFromHint takes the plan), features/exchanges/actions.ts, tests/unit/exchanges.test.ts, docs/progress.md
- Work completed: R1-1 a join_by refusal maps to "Join by has to be in the future." when the typed join-by is still before the gift moment (manual mode also needs join day before gift day), else "before the gift day"; 3 new assertions groups cover both branches. R1-7 progress slice 4 status is "In review". typecheck, lint, tokens:check pass; npm test 194/194.
- Outstanding: R1-2 (owner), R1-3 (owner approval), Lows untouched

## Owner — 2026-11-09
- R1-2: keep "You can change any of this later." (logged as an open item, check at release). R1-3: all nine new lines approved (copy-pending updated). Commit, push and open the PR approved.
- Builder fix round 1: R1-1 and R1-7 fixed; unit 194/194, exchanges e2e 18/18.
