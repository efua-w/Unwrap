# slice-6 — Approval, participants, Activity v1

Stories: GCO-003, GCO-007 (before draw), GC-012 (ask to join), GC-006/008 request rows, GC-007. Plan §10 row 6.
Branch: slice-6-approval (from main at 1bf00cc). Owner go-ahead 2026-11-14.

## Planner — round 1 — 2026-11-14
- Task: slice-6 — join requests (Ask to join), approve/decline/remove before the draw, Participants (S30/S31), requester pending row, organiser "Needs you now" block, Activity v1 (S09) with unread badge
- Requirements: GCO-003, GCO-005 (approval line, waiting note), GCO-006 (request block), GCO-007 (before draw), GC-006/007/008/009/012/029; plan §3, §5, §6 inv. 8–10, §10 row 6; open item 77. AC-1..AC-42 below.
- Files/components: see "App" and "Database".
- Work completed: read docs, migrations, pgTAP 030/170, joining and exchanges code, saved boards. No files changed.
- Outstanding issues: owner questions Q1–Q18. Q1–Q4 block database work; Q18 (unsaved boards) blocks UI.
- Next action: owner answers; main session saves boards; builder B1 (tests first).

### Approach
Same as slice 5. Every rule lives in SECURITY DEFINER functions with an empty search_path; calls take a token or an object id, never a user id. Both new tables have RLS on and no client grants, so a direct read gives 42501. Reads go through narrow functions that return names and times only. `join_exchange` keeps refusing removed and approval (170 #39/#40 unchanged); a request is created only by an explicit Ask to join through `request_to_join(token)`. Status allow-lists (open, joining_closed) refuse slice 10's drawn automatically. Strict exact-key parsers in the app. The Activity badge is fixed once in AppShell.

### Database (needs approval, Q1–Q2). Order: activity_events, then join_requests.
- Enum `activity_kind` ('member_joined', 'join_requested'). Table `activity_events`: id, user_id (reader), exchange_id, kind, subject_user_id (null), created_at, read_at (null). Check: subject only on the two people events. Indexes on (user_id, created_at desc, id desc) and unread partial. RLS on, no grants, no cascade.
- `private.add_activity_event` (no grants). `get_my_activity(p_before_at, p_before_id, p_limit)` returns id, kind, exchange_id, exchange_name, exchange_tint, subject_name, created_at, is_unread; limit 30, clamped 1..50. `get_unread_activity_count()`. `mark_all_activity_read()`.
- `join_exchange` create or replace: writes one member_joined event for the organiser, on insert only.
- Enum `join_request_status` ('pending', 'approved', 'declined', 'closed'). Table `join_requests`: id, exchange_id, user_id (requester), status, created_at, decided_at, dismissed_at, with checks. Partial unique (exchange_id, user_id) where pending. RLS on, no grants, no cascade.
- `request_to_join(token)`: anon 42501; bad token P0002; locks the exchange; hints member, cancelled, closed, full, can_join; idempotent 'pending'; inserts the request and a join_requested event; sets onboarded_at (Q10); rate limit (Q9).
- `get_join_requests(exchange)` returns request_id, display_name, requested_at. Organiser only, pending, oldest first.
- `approve_join_request(request)` returns the membership id. Non-organiser P0002; decided, full, cancelled, closed 22023; already active means approved.
- `decline_join_request(request)`. `list_my_join_requests()` returns request_id, exchange_name, exchange_tint, organiser_name, status, requested_at for the caller's pending rows.
- `get_participants(exchange)` returns member_id, display_name, is_me, is_organiser, taking_part. Organiser only.
- `remove_member(member)`: organiser only; never the organiser's own row (22023 organiser); open or joining_closed only; sets state removed and left_at.
- [Q15] `get_removed_exchange_name(exchange)`.
- `get_invite_preview` and `get_join_details` gain can_ask. Join details viewer gains 'requested'; people are also shown to can_join when status is approval; a removed person still sees no names.
- Grants: authenticated only. The 030 allowlist is unchanged.
- Tests: new 190_join_requests and 200_activity_events; 170 #6 and #16 key sets each gain can_ask.

### App
- New: app/(app)/activity, app/(app)/exchanges/[id]/participants, features/activity/*, features/participants/*, JoinRequestBlock, InvitePeopleSheet (extracted from OrganiserTools), RemovedFromExchange [Q15], AskToJoinForm, RequestPending, unit and e2e specs.
- Changed: joining parsers, status, copy, actions and pages (remove the unreachable approval/removed lines); exchanges queries, types, copy; ExchangeJustStarted; OrganiserTools; PeopleSection ("See all"); JoiningClosedCard (Q16); Exchanges page; AppShell (async unread count, 0 on failure); e2e auth fixture teardown; generated types; docs.

### Steps
- B0: boards saved, owner answers logged.
- B1: pgTAP 190, 200 and the 170 key sets, run red on dev.
- B2: migrations (owner approval), apply, green re-runs, drift check, types.
- B3: parsers, page decision, day grouping, unit tests.
- B4: joining states.
- B5: Participants.
- B6: exchange page request block, See all, invite sheet lines, removed state.
- B7: Exchanges pending rows and organiser block.
- B8: Activity and badge.
- B9: e2e and axe at three widths; stories, copy-pending, progress.

### Acceptance criteria (summary)
- AC-1 Approval exchange shows Ask to join with the board line; join_exchange still refuses.
- AC-2 A removed person never joins directly; can request while open or joining closed.
- AC-3 After join-by: "You can still ask to be let in. {Organiser} decides." and Ask to join; visitors go through Sign up or Log in.
- AC-4 No Ask to join when cancelled, gift day passed, complete or full.
- AC-5 Token only; bad tokens give P0002 and write nothing.
- AC-6 A second Ask is idempotent; "You've already asked".
- AC-7 Failure line with Try again; offline disables.
- AC-8 Request-sent state per Q6; no email promise.
- AC-9 Requester's pending row on Exchanges; not a link; icon or label.
- AC-10 Organiser request block, one and several variants, goes to Participants.
- AC-11 Invite sheet approval line and waiting note.
- AC-12 Participants is organiser-only; rows show name and "Asked {time}"; no email.
- AC-13 Approve rules. AC-14 Decline rules. AC-15 Remove rules (confirm first, not own row, not after the event).
- AC-16 A removed person loses every read; stale link state [Q15].
- AC-17 Privacy line; no pairs or list status.
- AC-18 Both tables refuse with 42501.
- AC-19 Events written only by functions; own rows only; exact columns.
- AC-20 Check constraint; no event names a pair.
- AC-21 Event writes per Q11.
- AC-22 Activity grouped by day in the viewer's zone; unread marker with a label; tap goes to Participants.
- AC-23 Mark all as read affects the caller only.
- AC-24 Empty, loading, error, offline and older states.
- AC-25 Badge on every signed-in page; a failed count shows no badge.
- AC-26 Approval preview is the normal preview; key set gains only can_ask.
- AC-27 Join details people matrix.
- AC-28 onboarded_at [Q10]. AC-29 Rate limit [Q9].
- AC-30 No anon functions (030 9/9); definer with empty search_path (040).
- AC-31 No user-id parameters.
- AC-32 Superseded copy rows 61, 62, 65, 84 and their code removed.
- AC-33 Slice 5 e2e still green.
- AC-34 Axe, keyboard, focus return.
- AC-35 Tokens check; story IDs in comments and commits.
- AC-36 Viewer time zone, tested with a non-Lagos zone.
- AC-37 Types regenerated. AC-38 Stories rewritten. AC-39 Copy sources.
- AC-40 Deploy order in the PR.
- AC-41 The organiser never sees emails anywhere.
- AC-42 Non-organiser members see no request data.

### Owner questions (planner recommendation in brackets)
1. Schema: activity_events, join_requests (plus created_at and decided_at), two enums, no client grants. [Approve]
2. The function list; preview and join details gain can_ask (170 #6 and #16 grow by one key). [Approve]
3. join_exchange keeps refusing; an explicit Ask to join calls request_to_join. [Explicit Ask]
4. Who may ask: open with approval; removed people while open or joining closed; anyone after join-by until the draw; never when full, cancelled, gift day passed or complete; open without approval and not removed means Join instead. [As listed]
5. Removed person on /join: S13-style page, no names, Ask to join, pending line. [Yes]
6. After Ask: the board's request-sent state; Go to Unwrap leads to /exchanges. [Board state]
7. Requester rows on Exchanges only; Home rows deferred (item 56); closed-by-draw row and Dismiss in slice 10. [Yes]
8. Decline, requester side: the row disappears silently; they may ask again within the rate limit. [Yes]
9. Rate limit: enforce_rate_limit, action request_to_join, for example 20 an hour. [Yes]
10. Ask sets onboarded_at like Join. [Yes]
11. Activity writes only member_joined and join_requested; none for approve, decline or remove. [Yes]
12. Only Mark all as read marks events read; the preferences link waits for slice 7. [Yes]
13. S30 without readiness: one list "Taking part ({n})", no "Invited by". [Yes]
14. Removal email, E08 and E09 in slice 7; no email promises now. [Yes]
15. Build "You're no longer in {exchange}" now. [Now]
16. Copy: drop the email promise; reword JoiningClosedCard (for example "New people can only ask to join now."); a request block variant after join-by; the full several-requests body. [Owner wording]
17. Precedence: request block first, then the invite section or the closed card; on Exchanges the request block wins over "Only you so far". [Yes]
18. Unsaved boards: main session saves them; "Join request would make 3" belongs to slice 8. [Slice 8]


## Main session — boards saved (B0, part) — 2026-11-14
- Saved locally every slice 6 board the planner listed as missing (Activity-* m/d; Joining-Confirm-requested, -approval-d; Joining-Unavailable-sent/asking-d/pending-d/drawn/expired-d; Org-People-approved/offline/few/fewreq/fewapproved and -d variants; Org-Remove-before/busy/done/after; Acc-NA-removed-d; Exchange-Detail-obefore; Exchanges-active).
- Board lines that answer planner copy questions:
  - Activity: "{n} unread" / "No unread activity", "Mark all as read", day labels "Today" / "Yesterday" / "{Thu 29 Oct}", rows "{Name} joined {exchange}." (sub "{time}") and "{Name} asked to join {exchange}." (sub "{time} · Approve or decline"), "Load older activity" / "Loading older activity", error "We couldn't load your activity. Nothing you've done is lost.", offline banner disables Mark all and Load older. Rows link to the exchange page (board), not Participants. "Choose which emails you get" link waits for slice 7.
  - Request sent (Joining-Confirm-requested, -Unavailable-sent): "Request sent" / "Waiting for {organiser}" / "Go to Home"; body promises email and a Home row, neither built.
  - Approve toast "Chidi is in. They've been emailed." (email not built). Remove confirm "Remove {first name} from {exchange}?" / "Remove {first name}" / "Keep", body promises an email. Remove done toast "{first name} was removed from {exchange}."
  - Request block (Exchange-Detail-obefore): "Needs you now" / "{Name} wants to join." / "Approve or decline {first name}'s request. People can join until {day}." / "Review request". No after-join-by or several-requests variant.
  - Participants rows "Asked today at 8:12 am. Invited by Tolu." — no inviter data exists.


## Owner decisions — 2026-11-14 (Tobechukwu Olih: "accept all")
Q1–Q18 accepted as recommended, with the board adjustments:
- Q6 request-sent screen without the email and Home promises; body line drafted for approval; button goes to /exchanges.
- Q12 Activity rows link to the exchange page (board); emails link omitted until slice 7.
- Q13 one people list, no "Invited by".
- Q14 approve toast "{first name} is in."; Remove confirm drops the email sentence, keeps "Their wishlist stays theirs."
- Q16 builder drafts the closed-card line ("New people can only ask to join now."), the after-join-by and several-requests request-card variants, for owner approval (copy-pending).
- Q9 rate limit 20 requests an hour per person.
Migrations are applied to dev only after the owner approves the apply.


## Builder — round 1 — 2026-11-14
- Task: slice-6 — B1 security tests and B2 migration files (not applied)
- Requirements: GCO-003/005/007, GC-006/008/009/012/029; AC-2, 4–6, 12–21, 26–31, 41, 42; Q1–Q18
- Files/components: new supabase/tests/security/200_activity_events.sql (plan 51), 190_join_requests.sql (plan 97); 170 key sets #6/#16 gain can_ask (2 lines); new migrations 20261114205923_activity_events.sql, 20261114205927_join_requests.sql (replaces private.enforce_rate_limit adding request_to_join 20/hour).
- Work completed: typecheck and lint pass. No SQL executed.
- Interpretations to confirm: a 'requested' viewer sees no names (like removed); list_my_join_requests has no exchange-status filter; request_to_join hits the rate limit last so refusals don't count; get_join_requests/get_participants give an empty set to non-organisers.
- Outstanding issues: SQL unverified until red/green runs.
- Next action: main session red run of 170/190/200 on dev; owner approves apply.


## Main session — red run — 2026-11-14
- 170: 59/61; only #6 (preview keys) and #17 (join details keys) fail, each missing only can_ask.
- 200: stops with 42704 type "public.activity_kind" does not exist (first new object).
- 190: first run hit a syntax error from a stray `end $fx$;` in the test file (13 block ends, 12 starts). Removed that one line; no assertion changed. Re-run stops with 42883 function public.request_to_join(text) does not exist (first new object).
- Next: owner approves applying 20261114205923_activity_events then 20261114205927_join_requests to dev.


## Main session — apply and green run — 2026-11-14
- Owner approved the apply. Applied activity_events (recorded 20261114213747) then join_requests (20261114213838); local files renamed. db:drift --strict passed (14 files, 14 recorded).
- Green on dev: 010 4/4, 015 6/6, 020 11/11, 030 9/9, 040 5/5, 060 22/22, 070 20/20, 080 17/17, 090 48/48, 100 56/56, 110 10/10, 120 19/19, 130 97/97, 140 9/9, 150 9/9, 160 12/12, 170 61/61, 180 59/59. 190 not yet run (network errors).
- 200 first run 48/51:
  - #11 and #16 compared booleans printed by format() as 't' with 'true'. Test fix: each comparison cast ::text. Meaning unchanged.
  - #33 wanted 55 rows from one page, but the approved page cap is 50, so it could never pass. Test fix keeps its meaning (a before-time alone excludes every event at that instant): want a full page and zero rows at that instant, '50/0'.
- 200 re-run 50/51: #33 have '50/5' — a real bug. get_my_activity with a before-time and no before-id still returned events at that instant (coalesce to ffff… id). Fix: new migration 20261114224443_activity_paging_fix.sql (strictly earlier when no before-id). Awaiting owner approval to apply.

- Owner approved the paging fix; applied as 20261114224557_activity_paging_fix (file renamed). db:drift --strict passed (15 files, 15 recorded).
- 190 first run 93/97: #54, #60 boolean format (cast ::text); #57, #62 called a function and read the table in the same statement, so the read used a snapshot from before the call (CLAUDE.md trap). Test fix: the call runs in its own statement (set_config), then the read. No assertion's meaning changed.
- Final green on dev: 190 97/97, 200 51/51, plus the 18 files above. All 20 files green (050 runs in CI only).
- Types regenerated from dev through the connector (generated output written unchanged; CI's file to be taken on the PR).
- Next action: builder B3 onward (app code).


## Builder — round 2 — 2026-11-15
- Task: slice-6 — B3 parsers/decision/unit tests, B4 joining UI
- Requirements: GC-002, GC-009, GC-012, GCO-003; AC-1..8, 26, 27, 32, 33; Q5, Q6, Q16
- Files/components: features/joining/{types,parse,status,copy,actions}.ts; InviteActions, InviteUnavailable; new AskToJoin, RequestPending, JoinBySummary; app/(public)/i/[inviteToken]/{page,join/page}.tsx; tests/unit/invite-join.test.ts; invite-join e2e removed-member case; copy-pending rows 61, 62, 65 superseded, 4 new rows awaiting approval.
- Work completed (builder-run): typecheck, lint, tokens pass; unit 298/298; invite-join e2e partly run (timeouts): 17/18 then flake passed alone 3/3; 12 of 30 not run.
- Decisions: refusals re-read the page; 'requested' wins over everything but member; signed-in pending/removed viewers on the preview go to /join; rate limit and other errors show the one failure line.
- Drafted copy (awaiting approval): "Your request to join {exchange} is waiting for {Organiser}."; "{Organiser} has your request and decides."; "Go to Exchanges"; removed variant "You can't join {exchange} with this link. You can ask to be let in. {Organiser} decides."
- Outstanding issues: no e2e/axe for the new joining states (round 4); row 84 left for B6.
- Next action: builder round 3 (B5–B7).


## Builder — round 3 — 2026-11-15
- Task: slice-6 — B5 Participants, B6 exchange page (organiser), B7 Exchanges list
- Requirements: GCO-003/005/006/007, GC-008, GC-012, GC-029; AC-9–12, 16, 17, 41, 42; Q13–Q17
- Files/components: new app/(app)/exchanges/[id]/participants/page.tsx; features/participants/{copy,types,format,queries,actions}.ts; ParticipantsContent, ParticipantsView, JoinRequestBlock, RemovedFromExchange; InvitePeopleSheet (extracted); tests/unit/participants.test.ts. Changed OrganiserTools, ExchangeJustStarted, PeopleSection (See all), exchanges copy (closedBody), exchange and Exchanges pages, invite-join e2e removed-member case (Q15), copy-pending (row 84 superseded, 22 new rows).
- Work completed (builder-run): typecheck, lint, tokens pass; unit 304/304; build passes; exchanges e2e 18/18; invite-join e2e 30/30 after updating the removed-member assertion for Q15.
- Outstanding issues: builder did not compare with the boards (folder not given in its brief). Alone subtitle built as "Only you so far"; board Org-People-alone shows "{exchange} · Only you so far". No e2e/axe for the new screens.
- Next action: builder round 4 (B8 Activity, B9 e2e/axe, board check, stories, progress).


## Builder — round 4 — 2026-11-15
- Task: slice-6 — B8 Activity page and unread badge; board check of rounds 2–3
- Requirements: GC-006, GC-007, GCO-003, GC-008; AC-22–25, 36; Q12–Q14
- Files/components: new app/(app)/activity/page.tsx; features/activity/{types,parse,copy,group,queries,actions}.ts; ActivityFeed; tests/unit/activity.test.ts (20). Changed AppShell (async unread count, 0 on failure), ListRow (quiet), participants alone subtitle, copy-pending (8 rows).
- Work completed (builder-run): typecheck, lint, tokens pass; unit 324/324; build passes; e2e serial: exchanges 18/18, invite-join 30/30, wishlists 6/6.
- Board check (copy and structure, not rendered): alone subtitle fixed to "{exchange} · Only you so far". Remaining differences all follow owner decisions (Q6, Q12, Q13, Q14, Q18) or later slices.
- Outstanding issues: /activity not opened in a browser; no e2e/axe for new screens; stories and progress not updated.
- Next action: builder round 5.

## Mid-slice change — 2026-11-15 — alone block after join-by (own commit)
- Owner request: the Exchanges "Share the invite link" block showed for an exchange whose join-by date had passed. Sharing is impossible then.
- Change: `app/(app)/exchanges/page.tsx` only picks an "Only you so far" exchange whose `joinByAt` is still in the future. Hidden, not replaced (no board; no new copy). The exchange row still links to the page with the "Joining has closed" card.
- Checks: typecheck and lint clean. Needs an e2e case (past join-by, organiser alone → no block) in the tester round.

## Mid-slice change — 2026-11-15 — exchange list page design fixes (own commit)
- Requested by the owner. Boards: Org-List-default-m/-d, Org-List-additem-m, Org-List-ideas-m, Exchange-Detail-oattached-m, Joining-Attach-default-m/-d, components UwTabs and UwListItem.
- Item 1 (ExchangeTag beside a semibold title): NOT done. No saved board shows it. Org-List-default has the serif regular h1 with the exchange name as a plain line under it; Joining-Attach-default has the "You've joined" card with the tag. Artboard d77062c7f351 is not in the saved copies. Needs the owner's call or the board.
- Item 2: organiser page, choose state, at md and up the two buttons sit in one wrapping row at auto width (Org-List-default-d: gap 8px 16px). Mobile and the participant page stay stacked full width (Org-List-default-m, Joining-Attach-default-m/-d).
- Item 3: ItemSheet's priority switcher now uses SegmentedTabs kind "choice" (UwTabs: track, 44px pills, selected pill white with border and weight 600). RadioGroup's "segmented" variant removed, as nothing else used it; dev gallery updated.
- Item 4: Your part "Your list for this exchange" row has a trailing CaretRight via ListRow `meta` (UwListItem trailing="chevron"; same as ActivityFeed). "Who you're buying for" has none, as on the board.
- Files: features/exchange-list/components/YourListPage.tsx, features/wishlists/components/ItemSheet.tsx, features/exchanges/components/YourPart.tsx, components/ui/RadioGroup.tsx, app/dev/components/Interactive.tsx.
- Follow-up (owner, 2026-11-15, board d77062c7f351): finding 1 resolved. Under the serif h1, the organiser page shows ExchangeTag (row size) beside the exchange name in body-base-semibold, text-secondary. The organiser page column is narrowed at md and up with md:max-w-dialog. The participant page is unchanged: its header is a different design (the "You've joined" card and the title "Tell your giver what you'd like", boards Joining-Attach-default-m/-d). The lock line stays in its grey card (the owner dropped that item; Alert.tsx is unchanged).
- Files added to the list above: features/exchange-list/components/YourListPage.tsx (header row, narrow column).
- The shared-wishlist signed-out mobile-390 test re-run alone: passed, so the earlier failure was a flake under load.

## Builder — round 5 — 2026-11-15
- Task: slice-6 — B9: e2e and axe at three widths, board check, stories and progress
- Requirements: GC-006/007/008/009/012/029, GCO-003/005/006/007; AC-9–12, 16, 17, 22–25, 33, 34, 36, 41, 42; Q1–Q18
- Files/components: new tests/e2e/approval-participants-signed-in.spec.ts (9/width), activity-signed-in.spec.ts (2/width), fixtures/exchange-seed.ts; auth.ts teardown deletes activity_events and join_requests; nav-items.ts accessible name capped "9+" (axe label-content-name-mismatch; open item 90); helpers.test.ts and shell.spec.ts updated for it; AskToJoin + join page request-sent header follow the board; user-stories.md (10 stories, dated 2026-11-15); progress.md items 83–90.
- Work completed: typecheck, lint, tokens, unit 324/324 and build pass. New specs pass 9/9 and 2/2 at 390, 768 and 1440. Older specs: 18/18 at 768 and 1440; at 390 three failed once (sign-in redirect under load) and passed on re-run. Shell + gallery: 64 passed, 2 skipped. Board comparison: only the request-sent header needed a fix; the other differences follow owner decisions or later slices.
- Outstanding issues: open item 90 (screen readers hear "9+"); the 390 failures are called load flakes by inference only; the tmpdebug spec file is still in the tree; invite-join spec keeps its own seed helpers.
- Next action: tester verifies slice 6 plus the two mid-slice changes.

## Tester — round 1 — 2026-11-15
- Task: slice-6 — verify approval, participants, Activity v1 and the two mid-slice changes
- Requirements: AC-1..42; GCO-003/005/006/007, GC-006/007/008/009/012/029
- Work completed: typecheck, lint, tokens, unit 324/324, build pass. E2E (--workers=1, one width at a time): approval and activity 33/33; exchanges, invite-join and wishlists 54/54; shared-wishlist and shell all pass (skips as designed). No flakes. Secrecy ACs checked in code and e2e. Mid-slice changes pass by code reading (not rendered).
- Outstanding issues: T1-1 no e2e case for past join-by alone block (Low/Medium); T1-2 leftover tmpdebug spec (Low). The main session deleted T1-2's file (untracked; it logged the signed-in user's own email).
- Verdict: PASS
- Next action: builder adds T1-1; reviewer in parallel.

## Reviewer — round 1 — 2026-11-15
- Task: slice-6 — review
- Work completed: security, grants, search_path, no user-id params, no email leaks verified by reading; migrations confirmed not edited after apply.
- Outstanding issues: R1-1 (Remove/Approve offered after the event; always refused), R1-2 (N+1 join-request reads on Exchanges), R1-3 (stale "Approve or decline" on decided requests), R1-4/R1-5 (stale comments in applied migrations; note in PR), R1-6 (viewAfterRequestRefusal test-only code), R1-7 (alone subtitle when organiser not taking part).
- Verdict: APPROVED
- Next action: main session sends R1-1, R1-6 and R1-7 to the builder; R1-2 and R1-3 logged as open items; R1-4 and R1-5 go in the PR description.

## Builder — round 6 — 2026-11-15
- Task: slice-6 — T1-1 test, open item 90 (owner: exact unread number), reviewer R1-1, R1-6, R1-7
- Requirements: GCO-004, GCO-007, GC-006, GC-012
- Files/components: tests/e2e/exchanges-signed-in.spec.ts; components/layout/nav-items.ts, NavLinks.tsx; components/ui/Chip.tsx; app/globals.css; tests/unit/helpers.test.ts; tests/e2e/shell.spec.ts; features/participants/components/ParticipantsContent.tsx, ParticipantsView.tsx; features/exchanges/types.ts, queries.ts; features/joining/status.ts; tests/unit/invite-join.test.ts; docs/progress.md
- Work completed: T1-1: new e2e (seeded organiser alone, closeJoining): no "Only you so far" meta line, no "Share the invite link" heading or "Share invite link" action, row links to /exchanges/<id>; 3/3 at 390, 768, 1440. Item 90: navAccessibleName returns the exact count; shell test and unit test say "Activity, 12 unread"; closed in progress.md. axe still failed because it reads visible text nodes even under aria-hidden, so the Chip now draws its number from CSS (data-count + .chip-count::after in globals.css, aria-hidden); axe passes at 35 unread. R1-1: ParticipantsView takes canManage (from new OrganiserExchange.canManagePeople = open or joining_closed); Approve and Remove hidden otherwise, Decline stays. Board Org-Remove-after shows draw-stage groups ("Still need a wishlist", "Ready"), which need the draw, not built: not built, no new copy. R1-6: viewAfterRequestRefusal and its unit test removed. R1-7: "Only you so far" subtitle only when the organiser is in the people list, otherwise no subtitle. R1-2 and R1-3 logged as open items 91 and 92.
- Outstanding issues: None known. R1-1 has no e2e case for the post-event state (needs a drawn exchange; draw not built).
- Next action: tester re-runs affected areas; reviewer re-checks.

## Tester — round 2 — 2026-11-15
- Verdict: PASS. Typecheck, lint, tokens, unit 323/323 and build pass; shell, activity, approval-participants and exchanges e2e pass at all three widths (54/54 signed-in). No defects.

## Reviewer — round 2 — 2026-11-15
- Verdict: APPROVED. R2-1 (Low): the count chip is silent to screen readers; the main session added a contract comment to components/ui/Chip.tsx. R2-2 (Low): duplicate aria-hidden wrapper, harmless, left as is.
- Next action: owner approves the copy, then commit, push and open the PR.
