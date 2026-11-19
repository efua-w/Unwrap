# Slice 8 — Readiness and nudges

- Branch: slice-8-readiness (from main cced575)
- Stories: GCO-006, GCO-008 (implementation plan row 8: S30, S32, S07; `get_readiness`; nudge limits from the outbox)
- Started 2026-11-18 at the owner's request.

## Planner — round 1 — 2026-11-18
- Task: slice-8 — Readiness (GCO-006) and Nudge (GCO-008)
- Requirements: GCO-006, GCO-007, GCO-008, GC-026; plan §5–§8; items 86, 91, 97, 101
- Files/components: features/participants/*, features/exchanges/* (new ReadinessBlock, NudgeSheet), supabase/functions/_shared/emails (E10), new migration readiness_and_nudges, pgTAP 260_readiness, 270_nudges (+030, 220 edits)
- Work completed: plan. DB objects for approval: D1 private.member_has_list (shared predicate; get_participants uses it); D2 public.get_readiness (organiser only; member_id, display_name, has_wishlist, nudged_recently; taking-part members only); D3 add E10 to template check; D4 two partial indexes; D5 enqueue_email gains p_send_after; D6 public.send_nudge (organiser only, before draw, skips no-list/recent, 20/hour, send_after now()+20s, no activity event); D7 public.undo_nudge (cancels caller's unsent E10 in that exchange); D8 claim_due_emails for E10 (organiser name, draw mode/time; cancels E10 'not_needed' if recipient left or added a list).
- Outstanding issues: boards to extract (Org-Nudge-*, Org-People-*, Exchange-Detail organiser states, Exchanges organiser variants, Email-E10, S07); owner Q1–Q14.
- Next action: main session extracts boards; owner answers Q1–Q14; builder starts with pgTAP 260/270.

## Boards (extracted 2026-11-18; read-only local copies, untrusted data)
- Part 2 folder: C:\Users\P\AppData\Local\Temp\claude\9216d52471611509\192197f4-557d-4210-a98c-c7d84c1587c8\scratchpad\artifact-files\47637980-257d-40d0-bf53-d053d5129ee7\project\ — Org-Nudge-{default,busy,sent,recent,offline}-{m,d}, Org-People-default-{m,d} (+offline, few), Exchange-Detail-obefore-{m,d}, Exchange-Detail-ojust-m.
- Part 1 folder: ...\artifact-files\e419cb4a-5935-4f92-9043-cd6d39bc7527\project\ — Email-E10.dc.html.
- S32 Nudge: opens over the exchange page (sheet on mobile, dialog max 480 on desktop). Preview: "Nudge 3 people?" / meta "Emeka, Tolu and Ada" (first names, no avatars, no emails) / "They'll get this by email:" / quoted preview "“{Organiser} is waiting on your wishlist for {exchange}. Names are drawn {day}.”" / privacy line "Anyone nudged in the last 12 hours is skipped." / "Send nudge" / "Cancel". Busy: Send nudge busy. Offline: body "You're offline. You can send this once you're back online. They'll get this by email:", Send disabled. Recent: title "Everyone was nudged recently", body "Everyone here was nudged in the last 12 hours. Give them a little time.", Send disabled, second button "Close". Sent: toast "Nudge sent to Emeka, Tolu and Ada." with "Undo".
- S30 Participants: "Still need a wishlist (3)" header link "Nudge all 3…"; rows sub "{email} · No wishlist yet" with trailing "Nudge"; offline disables "Nudge all". No nudged-row state.
- Exchange page organiser (obefore): header "5 of 8 wishlists are in. Names are drawn Fri 27 Nov."; readiness block card: meta "Needs you by {day}", headline "5 of 8 wishlists are in", body "Emeka, Tolu and Ada haven't added theirs.", button "Nudge 3 people…" (side by side with the join-request card on desktop). ojust: "3 of 4 wishlists are in" / "Seun hasn't added theirs yet." / "Nudge Seun…". No dashed avatars (stack missing="0"). No all-ready alert.
- E10: subject "{organiser} is waiting on your wishlist"; preview "Add it before names are drawn on {draw_at}."; heading "Add your wishlist for {exchange}"; "Hi {first},"; "{Organiser} is waiting on your wishlist for {exchange}. Names are drawn on {day, time zone}."; "A wishlist gives whoever draws your name a few ideas, so you get something you'll actually like. Only they will see it."; button "Add my wishlist"; paste-link line; "Happy gifting, / The Unwrap team"; footer "You're getting this because {Organiser} sent you a reminder in {exchange}." No unsubscribe/settings link.
- S07 = Home (has the same readiness card) — deferred.

## Owner decisions — 2026-11-18 (Tobechukwu Olih)
1. Scope: exchange page readiness card + Participants Nudge only. Home (S07) card and the Exchanges-list subtitle wait for the Home slice (item 56). The all-ready alert/Run draw waits for slice 10.
2. Copy approved: single person title "Nudge {First}?" (exchange-page button "Nudge {First}…"); manual draw preview and E10 "Names are drawn when {Organiser} is ready."; failure "We couldn't send the nudge. Nothing was sent, so you can try again."; partly nudged: send to the rest, toast names only them.
3. Rate limit: 20 nudge emails/hour per organiser, counting emails; undone nudges don't count; an over-limit send is refused whole: "You've sent a lot of nudges in the last hour. Try again later."
4. DB objects D1–D8 approved, and the 220 template assertion update (adds E10). Rules: no activity event; E10 always sent (no toggle); 12-hour skip counts any sender; claim cancels E10 ('not_needed') if the recipient left or added a list; a kept deleted list counts as ready; E10 link to /exchanges/[id] on APP_BASE_URL.

## Builder — round 1 — 2026-11-18
- Task: slice-8 — Phase A (DB, tests first) and Phase B (app)
- Requirements: GCO-006, GCO-007, GCO-008, GC-026; D1–D8; owner decisions 1–4
- Files/components: supabase/migrations/20261118232507_readiness_and_nudges.sql (not applied); supabase/tests/security/260_readiness.sql (25), 270_nudges.sql (43), 220_email_outbox.sql (72→74); supabase/functions/_shared/emails/{types,render}.ts (E10), send-emails/process.ts; features/participants/{components/NudgeSheet,components/ReadinessBlock,readiness,rpc,actions,queries,types,copy}.ts(x), ParticipantsView/Content; features/exchanges/components/ExchangeJustStarted.tsx; app pages; tests/unit/{emails,participants}.test.ts; tests/e2e/nudge-signed-in.spec.ts; copy-pending.
- Work completed: typecheck, lint, tokens:check pass; unit 389/389. pgTAP and e2e not run; migration not applied.
- Deviations: get_readiness adds is_me; private.recently_nudged helper; undo marks last_error_code 'undone' (not counted); advisory lock per organiser; Participants no-list rows keep "Remove…" beside "Nudge"; header line 2 unchanged; closed/cancelled show generic failure. Pending copy rows: "Needs you before names are drawn", manual-draw header, "Nudge undone." / "It had already gone out, so it can't be undone.", E10 manual preview "Add it before names are drawn."
- Outstanding issues: red run 260 → 270 → 220 on dev; apply; types; delete features/participants/rpc.ts; redeploy send-emails (E10) after merge.
- Next action: main session red run.

## Red run — 2026-11-18 (main session, dev, execute_sql, rolled back)
- 260: failed as expected — 42883 public.get_readiness(uuid) does not exist (trimmed run: setup + first assertions).
- 270: failed as expected — 42883 public.send_nudge(uuid, uuid[]) does not exist (trimmed run).
- 220: failed as expected (full file) — 42883 8-argument private.enqueue_email does not exist.
- Nothing persisted (no new functions, no test users, outbox unchanged).
- Next: owner approves applying 20261118232507_readiness_and_nudges to dev.

## Apply — 2026-11-19 (main session, owner-approved)
- Applied readiness_and_nudges to dev with apply_migration; recorded version 20261118232507; local file renamed to match. db:drift --strict passed (20 files, 20 recorded).
- Owner approved the builder's new copy lines and keeping both "Nudge" and "Remove…" on no-list rows.
- Types: features/participants/rpc.ts cast stays until CI's generated database.types.ts is taken on the PR; then remove rpc.ts.
- IMPORTANT before nudges are used on dev: redeploy send-emails (the live function has no E10 template; an E10 it claims would fail and retry up to 5 times, then give up).
- Next: green run of 260, 270, 220 + regressions.

## Green run — 2026-11-19 (dev, execute_sql, each file whole in begin…rollback)
- 260 25/25, 270 43/43, 220 74/74, 210 27/27, 030 9/9, 040 5/5, 020 11/11, 230 10/10, 250 14/14.
- 240 first run 12/14: #12 and #14 counted 2 leftover dev E07 rows (setup gap: 240 never cleared the outbox). Fixed the setup only — added the in-transaction `delete from private.email_outbox;` the other files use; assertions unchanged. Re-run 240: 14/14.
- Nothing persisted (outbox, users, exchanges counts unchanged).
- Next: tester (e2e nudge spec + regressions, visuals vs boards); owner redeploys send-emails before nudging on dev.

## Tester — round 1 — 2026-11-19
- Task: slice-8 — verify app vs decisions and boards
- Requirements: GCO-006, GCO-007, GCO-008, GC-026
- Files/components: tests/e2e/nudge-signed-in.spec.ts, features/participants/*, ExchangeJustStarted.tsx, copy-pending
- Work completed: typecheck, lint, tokens:check pass; unit 389/389; nudge spec 12/21 (preview/send/toast/Undo, undo-then-renudge, Participants Nudge all/row/single title, offline pass at 3 widths); exchanges 21/21; approval-participants 16 completed all pass (5 unverified, time cap). Verdict FAIL.
- Outstanding issues: T1-1 (Medium) spec seeds 2 of 4 lists but expects "3 of 4" (app correct); T1-2 (Medium) everyone-ready test asserts no "wishlists are in" text but the header keeps "4 of 4 wishlists are in…" — member/outsider secrecy checks after it never ran; T1-3 (Low) four copy rows still "Awaiting approval" though owner approved 2026-11-19. Board comparison not done (needs green run).
- Next action: builder fixes spec (T1-1, T1-2: header stays; scope assertion to the readiness block) and copy-pending (T1-3); tester retests incl. member/outsider and board comparison.

## Builder — round 2 — 2026-11-19
- Task: slice-8 — fix T1-1, T1-2, T1-3
- Requirements: GCO-006, GCO-008
- Files/components: tests/e2e/nudge-signed-in.spec.ts, docs/copy-pending.md
- Work completed: expectations now "2 of 4" (seed unchanged, plural kept); everyone-ready check scoped to the readiness block + header line, so member/outsider secrecy checks run; four copy rows approved 2026-11-19. Nudge spec 21/21 at 3 widths; typecheck, lint pass. Screenshots: readiness-block, nudge-default/sent/recent/offline, participants-nudge. No app code changed.
- Outstanding issues: None.
- Next action: tester retest + board comparison.

## Owner request mid-slice — 2026-11-19 (own change, own commit): card and Participants per the latest boards
- Owner screenshot of the readiness card: grey card, meta "Needs you by Fri 27 Nov", Bona Nova headline "5 of 8 wishlists are in", a face row of the people whose lists are in (initials) followed by dashed empty circles for each person missing, body "Emeka, Tolu and Ada haven't added theirs.", and the CTA "Nudge 3 people…" as a SECONDARY button (white, black border), not filled.
- Owner: Participants with Nudge must look exactly like the latest S30 Default board (Part 2, artboard link #artboard-8a594c86674c — id not mappable; the latest Org-People-default-m/-d are taken as the board).
- Latest board files (version 1795064539-9d08), saved at C:\Users\P\AppData\Local\Temp\claude\9216d52471611509\192197f4-557d-4210-a98c-c7d84c1587c8\scratchpad\p2-latest\project\: Org-People-default-{m,d}, Org-People-offline-m, Exchange-Detail-obefore-{m,d}, Exchange-Detail-ojust-{m,d}, and component specs UwCard, UwListItem, UwButton, UwAvatar.
- From the specs: UwCard kind=block = bg surface-subtle, radius 16, padding 24, gap 20; meta 14/600 grey; headline Bona Nova 700 (18 mobile / 24 desktop); face stack (36 mobile / 40 desktop, ring = card bg) with dashed missing circles; body 14 mobile / 16 desktop; action = UwButton variant "secondary" (white bg, 1.5px ink border, pill, min-height 48, 16/600). The join-request card is the same UwCard, so its action is secondary too. UwListItem with trailing link + trailingLabel2 = two UwButton link siblings after the row content, in the row's flex with gap 12px (Nudge then Remove…). Participants rows now show "Nudge" AND "Remove…" on the board (matches the owner's 2026-11-19 decision).

## Builder — round 3 — 2026-11-19 (owner design change)
- Task: slice-8 — block card and Participants rows per latest boards (own commit)
- Requirements: GCO-006, GCO-007, GCO-008; boards Exchange-Detail-obefore/ojust, Org-People-default; specs UwCard, UwListItem, UwButton, UwAvatar
- Files/components: features/participants/components/{BlockCard (new),JoinRequestBlock,ReadinessBlock,ParticipantsView}.tsx, features/participants/{readiness,copy}.ts, features/exchanges/components/ExchangeJustStarted.tsx, components/ui/{Avatar,AvatarStack,ListRow}.tsx, docs/copy-pending.md
- Work completed: shared BlockCard (secondary action, face stack with dashed missing, UwCard sizes) used by readiness and join-request cards; Avatar tone "on-subtle"; AvatarStack tone + max (default 5; card uses 8, missing first); ListRow gap 12 and action wrapper gap-12 (all ListRow users); Participants Nudge + Remove… as siblings. typecheck, lint, tokens:check pass; unit 389/389; e2e nudge + approval-participants 51/51.
- Outstanding issues: face-row label copy pending ("{n} people have added a wishlist, {m} haven't" + singular/zero forms); other ListRow screens not visually checked.
- Next action: tester visual retest incl. other ListRow screens; owner approves the face-row label.
- Owner approved the face-row label wording (2026-11-19).

## Tester — round 3 — 2026-11-19
- Task: slice-8 — retest owner design change
- Work completed: typecheck, lint, tokens:check pass; unit 389/389; e2e nudge, exchanges, wishlists, approval-participants 78/78 at 3 widths; activity 13 passed before timeout. Card (outlined CTA, faces + dashed), join-request card, Participants Nudge/Remove… gap, ListRow screens checked by eye. Axe passes. Verdict PASS.
- Outstanding issues: T3-1 (Low) "Nudge all 1…" with one person — main session fixed: header link only when 2+ (row link covers one). T3-2 face label — owner approved. T3-3 (Low, unverified) Wishlists list at 1440: "Anyone with the link" chip sits outside the 640 column; probably pre-existing, reviewer to check.
- Next action: reviewer.

## Reviewer — round 1 — 2026-11-19
- Task: slice-8 — full review
- Requirements: GCO-006, GCO-007, GCO-008, GC-026; owner decisions 2026-11-18/19
- Files/components: migration 20261118232507, pgTAP 260/270/220/240, features/participants/*, components/ui/{Avatar,AvatarStack,ListRow}, E10 render
- Work completed: Verdict APPROVED conditional on docs. Security verified by code read (organiser-only, definer + search_path '', grants, booleans/names only, skip, limit with advisory lock, undo scope vs lease, E10 content). 240 setup change acceptable. T3-3 not caused by this branch (pre-existing).
- Outstanding issues: R1-1 progress.md slice 8 row + items; R1-2 rewrite GCO-006/007/008 stories; R1-3 stale comment copy.ts:17; R1-4 undo cancels all unsent E10 of caller in that exchange (ok); R1-5 limit counts not_needed/no_recipient (state in story); R1-6 slice 10: cancel pending E10 on draw.
- Next action: builder fixes R1-1–R1-3; then commit.

## Builder — round 4 — 2026-11-19
- Task: slice-8 — R1-1, R1-2, R1-3 (docs + one comment)
- Files/components: docs/progress.md, docs/user-stories.md, features/participants/copy.ts
- Work completed: slice 8 row "Built, security tests green on dev"; items 86 closed, 97 and 101 updated; new items 106–109; Decisions rows; GCO-006/007/008 rewritten (2026-11-19, Tobechukwu Olih); stale comment removed. typecheck, lint pass.
- Outstanding issues: None.
- Next action: owner approves commit and PR; take CI's database.types.ts and delete rpc.ts (item 106); owner click-through.
