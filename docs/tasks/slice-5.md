# slice-5 — Invite and join

Branch `slice-5-invite-join` (from main, after `fix-audit-1-7` merges).

## Planner — round 1 — 2026-11-13
- Task: slice-5 — Invite and join (open joining): invite preview, invite context through sign-up/log-in, join confirmation, attach a list (participant /list and organiser S49), You're in, invite unavailable, member exchange page before the draw, Invite people sheet (link, copy, WhatsApp)
- Requirements: GC-002, GC-003/GC-004 (invite parts), GC-009, GC-010 (before draw), GC-011, GC-012 (without Ask to join), GC-013 (before draw), GCO-004 (S49 update 2026-11-09), GCO-005 (link, copy, WhatsApp), GC-008 (joined rows only). Plan §3, §5, §6 inv. 8, §10 row 5. Decisions 2026-11-03 (rejoin, removed, 100-person limit), 2026-11-09 (S49). Open items 42, 49, 56–58, 64, 74. AC-1..AC-38.
- Files/components: see "App changes"
- Work completed: read CLAUDE.md, plan, stories, progress, slice-4 and audit-fixes logs, all relevant migrations, pgTAP 030/130/140/150, exchanges/auth/wishlists/site-url code. No files changed.
- Outstanding issues: 14 owner questions; Q1–Q3 block the database work. Boards in the screens table are mostly assumed (S10–S13 mapped to GC-009..GC-012 from plan order).
- Next action: owner answers questions; main session confirms boards; audit fixes merge; builder starts B1–B3 (security tests first).

### Prerequisite
Slice 5 depends on the audit fixes (`onboarded_at` + requireProfile redirect, `exchanges_visible`, `private.enforce_rate_limit` — creating an ideas list counts against the 30/hour wishlist limit). Merge `fix-audit-1-7` first.

### Scope
In:
- GC-002 `/i/[inviteToken]` preview: inviter name, exchange name + tag, budget, join-by, gift day (date only), joined count only, 3-line explainer, skeleton; Join → Sign up (signed out) / /join (signed in) / exchange page (member); viewer's zone.
- GC-003/004: banner "You're joining {exchange}" on Sign up, Log in, Verify; after Verify with invite pending → GC-009, skipping Profile setup [Q1].
- GC-009 `/i/[inviteToken]/join`: exchange, organiser, faces + names, budget, join-by, draw date/time, gift day, note, "Joining as …"; Join exchange / Not now; member → exchange page; closed/full/cancelled → GC-012; left can rejoin; removed refused (slice 6 makes it a request); 100-person limit.
- GC-010 before draw `/exchanges/[id]/list` (S11): budget guide, picker sheet "Use this wishlist", Add items instead (ideas: add/edit/remove/Undo), Skip for now; wishlist replaces ideas, ideas kept and return; no-wishlists state; attach failed → retry; ideas never in My wishlists, never shareable, never attachable elsewhere.
- GCO-004 S49 `/exchanges/[id]/my-list` [Q11]: same feature for organiser taking part; no Skip; Back leaves without list; "Choose a different wishlist"; toasts on exchange page.
- GC-011 `/exchanges/[id]/joined`: timeline (names drawn, gift day), list status + source subline, "There's nothing else to do until names are drawn.", Go to exchange, ×. Notification/email lines and Share blocked on Q7/Q8.
- GC-012 unavailable on preview and join: incorrect/reset, joining closed (who, when), cancelled, full; "Go to Unwrap".
- GC-013 participant view of `/exchanges/[id]` before draw: "Organised by {name}.", status block, Your part › list row → /list, "Who you're buying for" placeholder, dates with draw time, faces without list status, "From the organiser". Organiser view gains Your part › S49, People, Organiser tools › Invite people.
- GCO-005 Invite people sheet (S29): "People can join until {date}.", link, Share to WhatsApp, Copy link. Reset: Q6.
- GC-008 joined rows: sublines ("You joined today. Names are drawn {date}."); replace slice-4 pending "{N} people in." with the board wording.

Out: approval/requests/Ask to join/removed rejoin by request/Activity (6); email invites, emails, notification copy (7); readiness, nudges (8); exclusions (9); draw, reveal, ActionCard (10); after-draw attach, giver reads list (11); reminders (12); edit (13); leave/repairs (14); cancel/complete incl. open item 57 (15); attached-list delete behaviour, open item 40 (16); photos (17); Home unchanged (item 56). Not v1: QR, SMS, Switch account, "Open in browser" fallback.

### Screens and boards (assumed unless noted; main session to confirm on the canvases)
| Route | Board | States | No board |
|---|---|---|---|
| /i/[token] | S02, "Entry-Invite" (verified in GC-002 update) | skeleton, default, nobody else joined, signed in, member redirect | manual-draw explainer (Q13); offline |
| unavailable | S13 | incorrect/reset, closed, cancelled, full | full, cancelled, approval (Q2) |
| /signup /login /verify banner | S03–S05 (verified) | banner | banner on Verify |
| /i/[token]/join | S10 | loading, default, busy, failed, member redirect | join failed, loading |
| /exchanges/[id]/list | S11 | default, picker, no wishlists, ideas, item sheet, attach failed, current | entered from exchange page (Q11), kept |
| /exchanges/[id]/my-list | S49, Org-List-* (verified) | as above + "Choose a different wishlist" | loading |
| /exchanges/[id]/joined | S12 | with list, skipped | without notification section (Q8) |
| /exchanges/[id] participant | S14 variants | with/without list, loading, error, offline | manual-draw variants |
| /exchanges/[id] organiser with list | Exchange-Detail-oattached / -oideas (verified) | wishlist, ideas, none | people joined, no readiness (Q14) |
| Invite people sheet | S29 (verified) | default, copied, reset (Q6) | — |
| /exchanges rows | S08 | joined today, earlier, organiser with people | joined earlier |

### Database (security tests first; nothing applied without owner approval; A = needs approval)
1. A: `exchange_members.attached_wishlist_id uuid null → wishlists(id)`, NO client column grant (list status must not leak to co-members/organiser).
2. A [Q3]: `wishlists.exchange_id uuid null → exchanges(id)`, check `(kind='exchange_ideas') = (exchange_id is not null)`, partial unique `(owner_id, exchange_id) where kind='exchange_ideas'`, no client grant.
3. New migration: `private.exchange_status(p_exchange)` holds the status CASE; `exchange_state` replaced to call it.
4. `get_invite_preview(p_token text) jsonb` definer, anon+authenticated. Malformed/unknown → null. Keys only: status (open|closed|cancelled|full), exchange_name, tint, inviter_name, budget_preset, join_by_at, gift_day, joined_count, closed_at or cancelled_at. Never ids, token, note, other names, emails, organiser_tz, avatar.
5. `get_join_details(p_token) jsonb` signed in: GC-009 fields, people [{name, is_organiser}] active only, viewer (member|can_join|removed|…), exchange_id only for active members. No user ids, emails, attachment status.
6. `join_exchange(p_token) uuid` signed in: lock row; closed/cancelled/complete/passed → 22023 hint closed|cancelled; 100 active → full [Q5]; latest removed → removed; approval_required → approval [Q2]; already active → id (idempotent, catch 23505); else insert active taking part; unknown/malformed → P0002; sets onboarded_at if null [Q1]. Token only (inv. 8).
7. `get_exchange_people(p_exchange)` [Q4] → (display_name, is_organiser, is_me, taking_part), active members only, empty otherwise.
8. `attach_wishlist(p_exchange, p_wishlist)`: caller active, taking part; own live personal list or own ideas list for this exchange; status open|joining_closed; refusals P0002; just-organising 22023.
9. `use_exchange_ideas(p_exchange) uuid`: create-if-missing ideas list (private, exchange_id, fixed internal name), attach, return id.
10. `get_my_exchange_list(p_exchange) jsonb` {source none|wishlist|ideas|kept, wishlist_id, name, item_count}, caller only; kept = attached list soft-deleted; ideas with 0 items = none but id returned.
11. A: policies `wishlist_items_insert_own_ideas`, `wishlist_items_update_own_ideas`; replace `remove_wishlist_item`/`restore_wishlist_item` to accept own ideas lists under the same rule. Closes item 42.
12. [Q6] `reset_invite_token(p_exchange) text` organiser only; refuses cancelled/complete.
Migrations: `invite_and_join` (3–7, 12), `exchange_lists` (1, 2, 8–11).

pgTAP 170_invite_and_join: definer; anon execute true for preview only; malformed tokens → null; exact preview key set as anon; joined_count rules; closed/cancelled/full statuses; get_join_details anon 42501 / outsider no exchange_id / member exchange_id; join_exchange anon 42501, outsider joins once, idempotent, organiser unchanged; unknown/malformed/exchange-id-as-token/reset → P0002; closed etc → 22023; 99→100 ok, 101 full, left not counted; left rejoin new row; removed refused; approval refused [Q2]; onboarded_at only if null, caller only; direct insert 42501; select attached_wishlist_id 42501; exchange_state null for non-member; get_exchange_people member/outsider/former; reset [Q6].
pgTAP 180_exchange_lists: shape and grants; attach_wishlist allowed/refused matrix; use_exchange_ideas single list, idempotent, survives switching; ideas items owner ok, others refused, after leaving refused, remove/restore; personal paths unchanged (re-run 090, 100), ideas not renamable/link/shared; attached Private list unreadable by co-members and organiser by every path; get_my_exchange_list caller only, kept, none; one rate-limit assertion.
030: assert anon can execute get_invite_preview(text). Re-run 010, 015, 020, 030, 040, 060, 090, 100, 120, 130, 140, 150, 160.
Traps: no grant → 42501 not zero rows; STABLE policy functions don't see same-statement rows (separate statements); wrap fixtures in do…perform; ::text for booleans; now() frozen (move join_by_at and gift_day together); 100 profiles via generate_series; unique names (item 72); for update + catch 23505.

### App changes
New: app/(public)/i/[inviteToken]/{page,loading}.tsx [Q10], app/(public)/i/[inviteToken]/join/page.tsx, app/(app)/exchanges/[id]/{list,my-list [Q11],joined}/page.tsx; features/joining/{queries,actions,types,copy,status}.ts + components {InvitePreview, InviteUnavailable, JoinConfirmation, YoureIn}; features/exchange-list/{queries,actions,copy}.ts + components {YourListPage, WishlistPickerSheet, IdeasList}; components/ui/InviteContextBanner.tsx; features/exchanges/components/{ExchangeMemberView, PeopleSection, OrganiserTools, InvitePeopleSheet, YourListRow}.
Changed: lib/auth/verify-state.ts (invite next → straight to next) [Q1]; app/(auth)/{signup,login,verify}/page.tsx banner from sanitised next `^/i/[0-9a-f]{32}(/join)?$` via get_invite_preview; AuthFrame banner slot; features/exchanges/{queries,types,copy}.ts (member view type with no token/emails/others' list status; joined_at; sublines); exchanges/[id]/page.tsx member branch; ExchangeJustStarted (S49 row, People); exchanges/page.tsx sublines; ItemSheet takes actions + helper as props (shared fix; WishlistDetail updated together); next.config.ts noindex + no-referrer for /i/:path*; generic invite metadata; regenerated types; docs.
Reuse: AppShell, Header, Button, Sheet (initialFocusRef), Toast, ShareActions, ListRow, RadioGroup, AvatarStack, Avatar, ExchangeTag, LocalDateTime, Timeline, EmptyState, Skeleton(Region), Alert, Chip, StatusPage, buildInviteUrl, budgetLabel, format-updated, listMyWishlists, readViewerTimeZone, requireProfile allowNotOnboarded, sanitizeNext.

### Steps
B0 merge audit fixes, branch. B1 [Q1–Q6] write 170, 180, 030 change; red run on dev. B2 migrations, owner-approved apply, all tests green, db:drift --strict, regenerate types. B3 pure modules + unit tests (invite-path matcher, strict parsers, hint→copy, count line, destinationAfterVerify, sublines). B4 preview + unavailable + headers + metadata. B5 banner + post-Verify destination. B6 join page + joinExchange action → /list?from=join. B7 ItemSheet refactor, YourListPage, picker, ideas, /list, /my-list. B8 /joined. B9 exchange page member view; organiser Your part, People, Invite people sheet (+reset Q6). B10 row sublines. B11 e2e + axe at 390/768/1440, docs, copy-pending.

### Copy
Story lines (verbatim): GC-002 "{Inviter} invited you", "{N} people have joined", "Everyone adds a wishlist. Names are drawn when joining closes, and you'll see only the person you're buying for."; GC-003 "You're joining {exchange}"; GC-009 "What you're agreeing to", "Joining as {name}", "Join exchange", "Not now"; GC-010 "Tell your giver what you'd like", "Your list for this exchange", "Choose a wishlist", "Use this wishlist", "Add items instead", "Skip for now", "Add an item", "Only the person who draws your name will see it. It won't be added to your wishlists.", "Your list for this exchange ({n})", "Only for this exchange", "Done", "Add another item", "Added '…'." / "Removed '…'." + Undo, "From '{wishlist name}'. Changes when you edit that list.", "Kept from a list you deleted. It can't be changed now.", "{N} items. Your giver will see them after the draw.", "You don't have any wishlists yet, so add a few items instead."; GC-011 "There's nothing else to do until names are drawn."; GC-012 "This invite can't be used", "Go to Unwrap"; GC-013 "Organised by {name}.", "You're all set", "Names are drawn on {date}.", "We'll tell you who you're buying for. Only you will see it.", "Attached. You can change it until the draw.", "From the organiser", "Who you're buying for. You'll find out on {date}.", "You're just organising."; GCO-004 S49 lines of the 2026-11-09 update; GCO-005 "People can join until {date}."; GC-008 "You joined today. Names are drawn {date}."
Pending (unless boards show them): GC-012 reasons (incorrect/reset, closed who+when, cancelled, full, approval); "1 person has joined"; manual-draw explainer; GC-013 manual-draw variants; participant without list status + "Add your wishlist"; join failed; load errors (reuse approved line); participant attach failed (reuse S49 line); ideas failures (reuse "Couldn't save your change." + Retry); invite title/OG; reset toast + confirmation (Q6); joined-earlier and member row sublines; organiser header/People with people (Q14); GC-011 skipped without email sentence (Q8); "Joining as" with email if board shows it.

### Risks
List-status leak to organiser/co-members (AC-20/21); emails only the viewer's own on GC-009 (AC-22); token-only join, strict next matcher, Q1 regression test that Landing sign-up still reaches Profile setup; forwarded link lets a signed-in stranger see names on GC-009 (accepted by story; name in review); anon first render in Africa/Lagos until tz cookie; token in URL → noindex, no-referrer, generic OG; 100th join race (lock + unique index); release: slices 4–5 (and 6 if Q2) together, SITE_URL for previews (item 47); regressions: ItemSheet refactor, replaced functions, destinationAfterVerify, listMyExchanges, 030 count, types (item 74). Log for later: slice 10 updates exchange_status/attach rules/draw_blocked_reason; slice 16 deletion of attached lists; slice 6 turns removed/approval refusals into requests.

### Acceptance criteria
AC-1 preview content, no faces/other names/note in HTML or RSC. AC-2 count line, hidden at 0. AC-3 skeleton. AC-4 Join routing (signed out/in/member). AC-5 noindex, no-referrer, no exchange data in metadata. AC-6 banner only for exact invite next. AC-7 [Q1] invitee skips Profile setup; Landing sign-up still gets it. AC-8 join page content in viewer zone. AC-9 only join_exchange(token) creates membership. AC-10 one active membership, idempotent, → attach page. AC-11 closed/cancelled/complete/passed → GC-012, nothing created. AC-12 101st refused, left not counted. AC-13 left rejoins, removed refused. AC-14 [Q2] approval exchange admits nobody directly. AC-15 attach page, picker, no-lists line. AC-16 ideas add/edit/bin/Undo, never in My wishlists/share/other exchange. AC-17 wishlist replaces ideas, ideas return. AC-18 Skip → You're in; failed attach retry. AC-19 S49 behaviour; just-organising refused. AC-20 no member learns another's list status (42501). AC-21 attached Private list unreadable by co-members/organiser. AC-22 no emails but the viewer's own. AC-23 You're in content, no reminder promise [Q8], no Share [Q7]. AC-24 member page content, no Not available/token/others' status/Leave. AC-25 organiser People + Invite people. AC-26 Invite sheet [+reset Q6]. AC-27 viewer zone; gift day as stored. AC-28 joined rows + sublines. AC-29 non-member → Not available on all four routes. AC-30 offline. AC-31 anon can't execute join/list functions; 030 passes. AC-32 wishlist pages unchanged. AC-33 170/180 + regressions run on dev; CI green. AC-34 axe 390/768/1440, sheets keyboard, actions above keyboard. AC-35 tokens:check, story IDs. AC-36 copy-pending. AC-37 types regenerated. AC-38 stories rewritten, dated.

### Tests
Unit: invite-path matcher, strict parsers, hint→copy, count line, destinationAfterVerify, sublines, budget guide, ItemSheet props. E2E `tests/e2e/invite-join-signed-in.spec.ts` at 390/768/1440 + axe: signed-out visitor (preview, no names, bad token, closed, /join → Log in), new joiner end to end, existing-account joiner, member revisit, organiser (sees joiner, invite sheet, S49 switching, just-organising no row), outsider Not available ×4, secrecy probe, former/removed member. Fixtures clean memberships, ideas lists, exchanges before users (item 32). Human: WhatsApp in-app browser Android/iOS, link-preview card, board comparison, screen reader on sheets, click-through per role.

### Owner questions (planner recommendations)
1. Invitee skips Profile setup vs onboarded_at: /join allows not-onboarded; join_exchange sets onboarded_at; "Not now" → Home → Profile setup.
2. Approval-required exchanges: DB refuses direct joins, GC-012 with neutral pending line, release 4–6 together (alt: hide option until slice 6).
3. Ideas list schema: wishlists.exchange_id + check + unique index (alt: exchange_members.ideas_wishlist_id); confirm attached_wishlist_id with no client read grant.
4. Co-member names: narrow get_exchange_people function, not a profiles policy.
5. Counts: "{N} people have joined" = active non-organiser members, hidden at 0, "1 person has joined" pending; 100 limit counts every active row incl. organiser.
6. Reset invite link: build in slice 5.
7. You're in "Share the invite link (if allowed)": leave out; token organiser-only.
8. Reminder/email promises: leave out until slices 7/12; log open item.
9. Copy conflicts (three list sublines; single vs double quotes): boards decide; participants GC-010/GC-013, organisers S49; confirm quote style once.
10. Unknown token: skeleton then GC-012, status 200 + noindex.
11. Routes: confirm /exchanges/[id]/my-list; /list shows Skip only from Join (?from=join), Back from the exchange page.
12. GC-008 "You're in" action card: defer to slice 10.
13. GC-002 explainer wrong for manual draw: pending variant.
14. Organiser page with people before readiness: People shows faces and names; header "{N} people in." (confirm against S14).

## Owner decisions — 2026-11-13
Tobechukwu Olih: "Accept all" (every planner recommendation, Q1–Q14). PR #13 (audit fixes) merged first; branch `slice-5-invite-join` from main at ec0d3f0.
1. Invitees skip Profile setup: /i/[token]/join allows a person without `onboarded_at`; `join_exchange` sets `onboarded_at = coalesce(onboarded_at, now())`, keeping the sign-up name. "Not now" goes to Home (which then shows Profile setup). A Landing sign-up still reaches Profile setup.
2. Approval-required exchanges: the database refuses direct joins (hint `approval`); the invite shows the GC-012 state with a neutral pending line. Slices 4, 5 and 6 are released together.
3. Schema approved: `wishlists.exchange_id` (check with kind, partial unique per owner and exchange, no client grant) and `exchange_members.attached_wishlist_id` with no client read grant.
4. Co-member names through `get_exchange_people`, not a profiles policy.
5. "{N} people have joined" counts active members other than the organiser and is hidden at 0; "1 person has joined" is pending copy. The 100-person limit counts every active member row, the organiser included.
6. Reset invite link is built in slice 5 (`reset_invite_token`).
7. No "Share the invite link" on You're in; the token stays organiser-only.
8. No reminder or email promises until slices 7 and 12; log an open item to add them.
9. Copy conflicts: the boards decide. Participants use the GC-010 / GC-013 sublines, organisers S49. Quote style: single quotes for names inside copy (as in GC-010 and the slice-2 toasts).
10. Unknown token: skeleton, then GC-012; status 200 with noindex.
11. Routes approved: `/exchanges/[id]/my-list` (closes open item 64), `/exchanges/[id]/list`, `/exchanges/[id]/joined`, `/i/[inviteToken]`, `/i/[inviteToken]/join`. `/list` shows Skip only when reached from Join (`?from=join`); from the exchange page it has Back.
12. The GC-008 "You're in" action card is deferred to slice 10.
13. Manual-draw variant of the GC-002 explainer: pending copy.
14. Organiser page with people before readiness: People shows faces and names; header "{N} people in.".

## Builder — round 1 — 2026-11-13
- Task: slice-5 — B1 (security tests first) and B2 (migrations written, not applied)
- Requirements: GC-002, GC-004, GC-009–GC-013, GCO-004 (S49), GCO-005; owner decisions Q1–Q6; AC-9..AC-14, AC-19..AC-21, AC-31
- Files/components: supabase/tests/security/170_invite_and_join.sql (plan 61), 180_exchange_lists.sql (plan 59), 030_function_allowlist.sql (plan 7 → 9: anon may execute get_invite_preview(text); a granted get_invite_preview(int) overload is flagged); supabase/migrations/20261113151444_invite_and_join.sql, 20261113151507_exchange_lists.sql
- Work completed: written only; nothing run, applied or regenerated. Assertion counts checked by grep; every function security definer, search_path '', revoke then grant; anon gets get_invite_preview only.
- Assumptions: preview status adds `approval` (Q2); preview always returns all ten keys (closed_at/cancelled_at null when not applicable; precedence cancelled > closed > full > approval > open); get_join_details returns people only to members or can_join viewers of an open invite, viewer member|can_join|removed, exchange_id to active members only, no viewer name/email; join_exchange returns an active member's id before any status check; latest membership = joined_at desc, left_at desc nulls first; attach refusals P0002, just-organising 22023 hint not_taking_part; ideas list internal name 'Exchange ideas', private; get_my_exchange_list null for non-members and leavers; ideas-item policies require is_member(w.exchange_id).
- Outstanding issues: (1) `wishlists.exchange_id` is readable by the list owner through the existing table-level select grant on wishlists; making it unreadable needs column-level grants on wishlists (touches slice 2). Writes are refused (tested). Only the owner's own data, so not a leak. (2) The "select attached_wishlist_id → 42501" assertion lives in 180, not 170, because the column arrives with migration 2.
- Next action: main session runs 030, 170, 180 red on dev; owner approves applying both migrations.

## Main session — red run — 2026-11-13
- Task: slice-5 — security tests red on dev before the migrations
- Work completed: 030, 170, 180 run on dev `ulziqspdjtjszvdcwdek` (each in begin … rolled back). Red, each on the object the slice 5 migrations add:
  - 030: 42883 function public.get_invite_preview(text) does not exist
  - 170: 42883 function private.exchange_status(uuid) does not exist (assertion 1)
  - 180: 42703 column exchange_members.attached_wishlist_id does not exist
  (A first attempt failed earlier on the runner itself, `tap_out` missing; runner script fixed.)
- Outstanding issues: owner approval to apply 20261113151444_invite_and_join and 20261113151507_exchange_lists to dev; owner view on `wishlists.exchange_id` being readable by the list owner (builder round 1, issue 1).
- Next action: on approval, apply both with apply_migration, run all listed pgTAP files green, db:drift --strict, regenerate types.

## Main session — apply and green run 1 — 2026-11-13
- Task: slice-5 — apply the two migrations to dev (owner approved 2026-11-13: "Apply and accept"; also accepted `wishlists.exchange_id` being readable by the list owner through the existing table-level grant)
- Work completed: applied with apply_migration; recorded as 20261113151444_invite_and_join and 20261113151507_exchange_lists, files renamed to match; `npm run db:drift -- --strict` passed (11 files, 11 recorded). Types regenerated from dev through the connector (schema part; helper tail unchanged); typecheck passes. Take CI's generated file after the first PR run (as items 52, 74).
- pgTAP on dev (each rolled back): 180 59/59, 030 9/9, 010 4/4, 015 6/6, 020 11/11, 040 5/5, 060 22/22, 070 20/20, 080 17/17, 110 10/10, 130 97/97, 140 9/9, 150 9/9, 160 12/12. 050 not run (seed personas not on dev).
- Failures: 170 60/61 (#35: a boolean printed as `t` in format(), missing `::text`; result correct). 090, 100, 120 did not run: setup inserts `exchange_ideas` lists without an exchange, now refused by `wishlists_ideas_have_exchange`.
- Next action: builder round 2 fixes the 170 cast and the 090/100/120 setup only (ideas lists point at a fixture exchange the owner is not a member of, so every assertion keeps its meaning); then green run 2.

## Builder — round 2 — 2026-11-13
- Task: slice-5 — fix 170 #35 and the 090/100/120 setup broken by `wishlists_ideas_have_exchange`
- Files/components: supabase/tests/security/170_invite_and_join.sql (`::text` on the 4th format() argument of #35), 090_wishlists.sql, 100_wishlist_items.sql, 120_get_shared_wishlist.sql (each ideas-list fixture now points at a fixture exchange organised by another user; the list owner is not a member, so every assertion proves what it proved before)
- Work completed: setup only; no assertion, plan() count or expected value changed.
- Outstanding issues: 090 #31 would have kept passing for the wrong reason (the new `wishlists_ideas_have_exchange` check fires first); flagged, not changed.

## Main session — green run 2 — 2026-11-13
- Work completed: 090 #31 restored by the main session: the exchange fixture moved above it, the insert carries that exchange, and the expected message now names `wishlists_ideas_never_link`, so only the never-link rule can satisfy it (stricter than before; same SQLSTATE and intent).
- pgTAP on dev (each rolled back, whole files): 170 61/61, 090 48/48, 100 56/56, 120 19/19. With green run 1, all 18 files pass on dev (050 seed personas not run on dev; CI runs it).
- Next action: builder round 3 — app code, steps B3 to B11.

## Builder — round 3 (first attempt) — 2026-11-13
- Stalled (no progress for 600 s) before writing any file. Work split into rounds 3a (B3–B6), 3b (B7–B8), 3c (B9–B11).

## Builder — round 3a — 2026-11-13
- Task: slice-5 — B3 pure modules and unit tests, B4 invite preview and unavailable states, B5 invite banner and post-Verify destination, B6 join confirmation
- Requirements: GC-002, GC-003, GC-004, GC-009, GC-012; owner Q1, Q2, Q5, Q9, Q10, Q13
- Files/components: new lib/auth/invite-path.ts; features/joining/{types,parse,status,copy,queries,actions}.ts, invite-banner.tsx, components/{InviteFrame,DetailRows,InviteActions,InvitePreviewView,InviteUnavailable,InviteSkeleton,JoinContent,JoinForm}.tsx; components/ui/InviteContextBanner.tsx; app/(public)/i/[inviteToken]/{page,loading,error}.tsx and join/{page,loading}.tsx; tests/unit/invite-join.test.ts (56). Changed: lib/auth/verify-state.ts (exact invite next → /i/<token>/join for both flows; Landing sign-up still /welcome), components/auth/AuthFrame.tsx (banner slot), features/auth/{Signup,Login,Verify}Form.tsx, app/(auth)/{signup,login,verify}/page.tsx, next.config.ts (/i/:path* noindex, nofollow; no-referrer), docs/copy-pending.md (9 rows).
- Boards: Entry-Invite-default/alone/loading/offline; Entry-Signup/Login/Verify-invite; Joining-Confirm-default/alone/busy/error/loading/offline; Joining-Unavailable-incorrect/closed/cancelled.
- Checks: typecheck, lint, tokens:check pass; unit 263/263 (12 files); build pass. Smoke against `npm start`: unknown token → 200, noindex and no-referrer headers, "This invite can't be used". No e2e, no browser comparison, no signed-in click-through yet.
- Decisions: refusals re-render the server page (`router.refresh()`), so the database decides; unavailable facts always come from get_invite_preview; a signed-in member is redirected from both routes; /i error page reuses app/(app)/error.tsx; Go to Unwrap → /home signed in, / signed out.
- Outstanding issues: (1) get_invite_preview has no draw_mode/draw_at, so an organiser-draws exchange shows the join-by moment as "Names drawn" on the preview (owner decision; fix = new migration adding the keys). (2) Verify banner shows only when the uw_verify cookie holds next (not when only localStorage restores it). (3) S13 closed omits "Ask to join" and its line (slice 6). (4) Board vs story copy differences listed for owner approval. (5) Redirect after Join targets /exchanges/[id]/list?from=join, built in 3b. (6) 8 touched files normalised CRLF → LF.
- Next action: owner decisions on (1) and the copy table; builder round 3b.

## Builder — round 3b — 2026-11-13
- Task: slice-5 — B7 (ItemSheet made reusable; shared attach-list feature; /list and /my-list) and B8 (/joined)
- Requirements: GC-010, GC-011, GC-029 pattern, GCO-004 (S49); owner Q7, Q8, Q9, Q11; AC-15..AC-19, AC-23, AC-29, AC-30
- Files/components: changed features/wishlists/components/{ItemSheet,WishlistDetail}.tsx (sheet takes actions/description/priceHelper), components/ui/Timeline.tsx (optional note), features/joining/components/InviteFrame.tsx (optional close), features/exchanges/queries.ts (fromView exported), app/(app)/exchanges/[id]/page.tsx (shared NotAvailable), docs/copy-pending.md (10 rows). New features/exchanges/components/NotAvailable.tsx; features/exchange-list/{types,parse,copy,joined,queries,actions}.ts and components/{YourListPage,WishlistPickerSheet,IdeasList,ListContent,ListSkeleton,JoinedContent}.tsx; app/(app)/exchanges/[id]/{list,my-list,joined}/page.tsx; tests/unit/exchange-list.test.ts (14).
- Boards: Joining-Attach-* → /list; Org-List-* → /my-list; Joining-In-attached/ideas/skipped/noreminders → /joined.
- Guards: active member, not cancelled, state open/joining_closed; otherwise NotAvailable. Organiser taking part on /list → /my-list; organiser on /joined → NotAvailable.
- Checks: typecheck, lint, tokens:check pass; unit 277/277; build pass; wishlists-signed-in e2e 6/6 at 390/768/1440 after the ItemSheet change (run against the running port-3000 dev server; a second next dev cannot start in this directory).
- Outstanding issues: no browser/board comparison or e2e for the new routes yet (3c); exchange page does not yet link to /list or /my-list (B9); a kept (deleted) list still offers "Choose a different wishlist" before the draw (database allows it; revisit with open item 40 in slice 16); copy differences listed for the owner.
- Next action: builder round 3c (B9–B11).

## Owner decisions — round 3 copy — 2026-11-14
Tobechukwu Olih: "Accept all".
1. Invite preview gets draw_mode and draw_at through a small new migration (test 170's exact-key set grows by those two keys); organiser-draws exchanges then show the right "Names drawn" line.
2. Board wording approved where it differs from the stories (preview count lines incl. "You'd be one of the first to join.", "How it works" list, time-zone and privacy lines, "I already have an account"; join page "Who's in (N)", "From {organiser}", three agreement bullets, "Joining as {name}, {email}" own email only; unavailable reasons).
3. The nine round-3a copy-pending lines approved; "Ask to join" stays out of the closed state until slice 6.
4. Round-3b wording approved (per-audience budget guide, "more than ₦50,000", "Add one before {day}." without the email promise, single quotes) and its ten copy-pending lines.
5. A deleted attached list can still be swapped before the draw; revisit in slice 16 (open item 40).

## Builder — round 3c — 2026-11-13
- Task: slice-5 — B9 exchange page (participant and organiser), B10 Exchanges rows, B11 e2e, stories, copy-pending
- Requirements: GC-002, GC-003, GC-008–GC-013, GC-029, GCO-004, GCO-005; owner Q1–Q14; AC-24..AC-30
- Files/components: new `features/exchanges/people.ts`, `ExchangeMemberView`, `PeopleSection`, `YourPart`, `OrganiserTools`, `tests/unit/exchange-people.test.ts`, `tests/e2e/invite-join-signed-in.spec.ts`; changed `app/(app)/exchanges/[id]/page.tsx`, `app/(app)/exchanges/page.tsx`, `features/exchanges/{types,queries,copy,actions}.ts`, `ExchangeJustStarted.tsx`, `features/exchange-list/copy.ts`, `features/joining/actions.ts`, `tests/e2e/fixtures/auth.ts`, `tests/e2e/exchanges-signed-in.spec.ts`, `docs/user-stories.md`, `docs/copy-pending.md`.
- Work completed:
  - Bug fix: `join_exchange` returns the membership id; Join redirected to `/exchanges/<membership id>/list`. `joinExchange` now reads the exchange id back through `get_join_details`. No database change.
  - Organiser page: People section (just-organising viewer excluded), S49 row, Organiser tools with the Invite people sheet and Reset link. Member view. Exchanges row sublines.
  - Stories got dated "Updated 2026-11-13" paragraphs, not full rewrites. 9 copy rows added as Awaiting approval (numbered 1–9 in the builder report).
  - Checks (builder-run): typecheck, lint, tokens pass; unit 283/283; build passes (not re-run after the late fixes); e2e invite-join 24/24, wishlists 6/6, exchanges 18/18; axe passes on new pages and sheets.
- Outstanding issues: no real-phone check; no side-by-side board check at 768 and 1440; build not re-run after final fixes; story paragraphs appended, not rewritten; 9 new copy rows await the owner; ideas screen has no way to switch to a wishlist (design check).
- Next action: main session adds draw_mode/draw_at to the invite preview; then the tester.

## Main session — preview draw keys — 2026-11-14
- Task: slice-5 — get_invite_preview returns draw_mode and draw_at (owner round 3 decision 1)
- Requirements: GC-002; owner decision 2026-11-14 item 1
- Files/components: `supabase/migrations/20261114131116_invite_preview_draw.sql` (new), `supabase/tests/security/170_invite_and_join.sql` (preview key set +2), `features/joining/{parse,types}.ts`, `features/joining/components/InvitePreviewView.tsx`, `tests/unit/invite-join.test.ts`
- Work completed (verified):
  - Test first: 170 red on dev, 60/61, only #6 (key set) failed.
  - Applied with apply_migration; recorded as 20261114131116 (local file renamed to match). db:drift --strict passed (12 files, 12 recorded).
  - Green on dev: 170 61/61, 030 9/9, 040 5/5.
  - Generated types: unchanged (function still returns jsonb).
  - Preview date rows now follow JoinContent: organiser-draws shows the approved "when {first name} is ready" line and end-of-day join-by. No new copy.
  - typecheck, lint, tokens pass; unit 286/286.
- Outstanding issues: e2e and build not re-run after this change (tester to run).
- Next action: tester verifies all of slice 5.

## Tester — round 1 — 2026-11-14
- Task: slice-5 — verify invite and join, exchange lists, exchange page
- Requirements: GC-002/003/004/008–013, GC-029, GCO-004, GCO-005; AC-1..AC-30
- Files/components: features/joining/*, features/exchange-list/*, features/exchanges/*, app/(public)/i/*, app/(app)/exchanges/[id]/*, tests/e2e/invite-join-signed-in.spec.ts
- Work completed (tester-verified): typecheck, lint, tokens pass; unit 286/286; build passes; e2e signed-in 48/48 on rerun (first run had 2 failures during a network drop, not reproduced); signed-out suite 237 passed, 6 skipped. Secrecy checked in code: no query reads attached_wishlist_id or assignments; only the viewer's own email is read. Join redirect fix verified.
- Verdict: PASS, with Low items:
  - T1-1: no e2e renders the organiser-draws invite preview.
  - T1-2: two flaky first-run failures (signed-out join click while offline; organiser-chooses at 1440).
  - T1-3: mobile full-page screenshot of the preview shows the sticky footer over "How it works" steps 2–3 and the privacy alert; likely a capture artefact, not confirmed at 390.
- Outstanding issues: no board side-by-side; loading/error states not observed in a browser; docs not reviewed.
- Next action: reviewer.

## Reviewer — round 1 — 2026-11-14
- Task: slice-5 — review invite and join, exchange lists, exchange page
- Requirements: GC-002/003/004/008–013, GC-029, GCO-004, GCO-005; Q1–Q14; round 3 decisions
- Files/components: three migrations; pgTAP 170, 180, 030/090/100/120 diffs; features/joining/*, features/exchange-list/*, features/exchanges/*; InviteFrame; docs/user-stories.md
- Work completed: security read of every definer function, grant and policy; no assertion weakened; types carry no other person's data; join redirect fix verified; story updates accepted (file convention).
- Verdict: APPROVED. Findings:
  - R1-1 (Medium): DoD item 4 open — boards side by side at 390/768/1440 incl. loading/error states; also eye-check T1-3 at 390.
  - R1-2 (Medium): apply migrations before deploying the app (parser needs draw_mode/draw_at). Note in the PR.
  - R1-3 (Low): closed_at is the join-by moment even when closed for a later reason; confirm copy.
  - R1-4 (Low): join_exchange should return the exchange id later to drop the second read.
  - R1-5 (Low, T1-1): add an e2e for the organiser-draws preview.
  - T1-3 resolved: sticky (not fixed) footer; screenshot artefact.
- Outstanding issues: R1-1 board check and signed-in phone click-through before "done".
- Next action: owner approves commit, push, PR.

## Main session — closed card (mid-slice request) — 2026-11-14
- Task: slice-5 change — show the "Joining has closed" card on the organiser page once joining closes, only when no other card applies (lowest priority)
- Requirements: owner request 2026-11-14; GCO-004; board Exchange-Detail-oclosed (m, d)
- Files/components: new `features/exchanges/components/JoiningClosedCard.tsx`; `ExchangeJustStarted.tsx` (branch after InviteSection, WHY comment for slice 10 cards); `features/exchanges/copy.ts`; `tests/e2e/invite-join-signed-in.spec.ts` (+2 tests: closed card, and organiser-draws preview, closing R1-5/T1-1); `docs/copy-pending.md` (+1 row)
- Work completed (verified): typecheck, lint, tokens pass; the 2 new e2e tests pass at 390/768/1440 (6/6); axe passes; 390 screenshot matches the board card.
- Deviations from the board: no "Edit exchange" action and no "change the join-by date" sentence (editing not built; copy rule). Logged in copy-pending.
- Outstanding issues: the timeline's step 1 still says "Anyone with the link can join until {day}." after the date passes; names-drawn step stays future-tense until slice 10.
- Next action: owner approves the commit.
- Copy: owner approved all slice 5 copy-pending rows (incl. the closed card) on 2026-11-14.
