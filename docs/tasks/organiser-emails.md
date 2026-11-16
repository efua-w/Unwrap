# organiser-emails — organisers can see participants' email addresses

## Owner decision — 2026-11-15 (Tobechukwu Olih)
- Organisers can now see their participants' email addresses.
- This reverses the product rule "The organiser never sees participants' email addresses" in CLAUDE.md and the stories.
- Pair secrecy and asymmetric visibility are unchanged: emails never reveal who gives to whom.
- This is its own change, with its own branch or commit after slice 6.

## What the refreshed boards show (2026-11-16, Part 2 `C:\Users\P\AppData\Local\Temp\claude\9216d52471611509\192197f4-557d-4210-a98c-c7d84c1587c8\scratchpad\artifact-files\47637980-257d-40d0-bf53-d053d5129ee7\project`)
- **Participants:** rows read "chidi.okeke@gmail.com · Today at 8:12 am". See Org-People-default/few/fewapproved/fewreq/approved/offline. Check whether request rows show emails too.
- **Pickers:** the Hand-over and Exclusions pickers list emails (Org-Hand-*, Org-Excl-pairfirst/pairsecond). These screens belong to later slices.
- **Remove sheet:** "a short email at ifeoma.nwosu@gmail.com" (Org-Remove-*).
- **Nudge sheet:** says the organiser can see their addresses (Org-Nudge-*).
- **Account and Profile:** "Organisers of your exchanges can see your email, never your phone." (Acc-*)
- **Join confirmation (Part 1 Joining-Confirm-*):** adds a bullet saying the organiser can see your email address.
- **Organiser-setup inventory (Part 1):** "The organiser can see addresses on Participants".
- **UwListItem:** gains an optional `note` line (14px, muted).

## Planner — round 1 — 2026-11-16
- Task: organiser-emails — the organiser sees the email addresses of their own exchange's members and pending requesters on Participants
- Requirements: owner decision 2026-11-15; GCO-007, GCO-003, GC-009, GCO-008 (story text only); slice-6 AC-12/17/41 superseded
- Approach:
  - New migration drops and recreates `get_participants` and `get_join_requests` with an `email text` column read from `auth.users`. The organiser's own row is null.
  - Grants are re-issued after the recreate.
  - pgTAP 210 is written first.
  - TypeScript splits a names-only `getJoinRequests` (exchange page and Exchanges) from `getJoinRequestsWithEmail` (Participants only).
  - Member types never get an email field.
- In scope: Participants request and member rows, and the join confirmation bullet.
- Later slices: Hand-over and Exclusions pickers, Nudge, the Remove-sheet email line (slice 7), the Account line (slice 16) and the setup inventory.
- Acceptance criteria: AC-1..14 (see the planner report). Main points:
  - Members, requesters, outsiders and other organisers get zero rows; anon gets 42501.
  - No member-facing read carries an email; 060 stays unchanged.
  - Removed or left members and decided requests are excluded.
  - Long addresses don't overflow.
- Board check (main session): the Joining-Confirm bullet reads "{Organiser}, the organiser, can see your email address."
- Open questions: Q1 (member subline: email only, or wishlist status as well), Q2 (organiser's own row subline), Q3 (change the return shape, or add separate functions), Q5 (Account "never your phone"; slice 16), Q6 (truncate or wrap long addresses).
- Next action: the owner answers. The build starts after slice 6 is merged, on its own branch.

## Owner decisions — 2026-11-16 (Tobechukwu Olih)
- Q1: member rows show "{email} · Wishlist added / No wishlist yet", as on the boards. This reverses slice-6 Q13 for wishlist status. Status means only whether a list is attached; nothing about items or reservations.
- Q2: no email on the organiser's own row. Reading Q1 and Q2 together, the own row shows the wishlist status alone, as the board does. The main session will confirm this with the owner at review.
- Q3: not asked. Use the planner's recommendation: drop and recreate both functions with the new columns.
- Q5: the Account line in slice 16 becomes "Used for sign-in codes. Organisers of your exchanges can see your email."
- Q6: long addresses wrap.

## Board spec — Participants — 2026-11-16
Source: Part 2 boards refreshed 2026-11-16 (version 1794819295-6faa), saved in `C:\Users\P\AppData\Local\Temp\claude\9216d52471611509\192197f4-557d-4210-a98c-c7d84c1587c8\scratchpad\artifact-files\47637980-257d-40d0-bf53-d053d5129ee7\project`. Compared with the copy saved earlier the same day (`scratchpad\old-boards-3`): all 498 `project/*` files are byte-identical, so no board is new, changed or removed.

**Artboard 8a594c86674c:** not found. The id isn't in `canvas.json` (v3: `boards`, `order`, `notes` and `pages` map file names to positions and have no artboard ids) or in any saved board file, and it isn't a md5/sha1/sha256 prefix of a board name. The Design type names artboards by file name. The spec starts from **Org-People-default** (canvas title "S30 Participants · Default", page `exchanges`). The owner should confirm that this is the board they meant.

Values below were read from the board HTML and the code. Tokens are from `styles/tokens.css`.

### Conflicts to settle before building (stop and ask)
1. **Sections.** Every board with members splits them into "Still need a wishlist ({n})" and "Ready ({n})". The code has one "Taking part ({n})" list, per slice-6 Q13. Slice-6 Q18 and the GCO-007 note in user-stories.md put the readiness split and Nudge in **slice 8**. Owner Q1 reverses Q13 only for the status text in the sub line. Building "exactly as on the boards" would bring in the split now. Ask: keep one list with the status in the sub line, or split it?
2. **Nudge controls.** Rows in "Still need a wishlist" have a trailing **Nudge** link, not Remove…. The section header has the link **"Nudge all {n}…"**, but only when n ≥ 2 (fewapproved, with n = 1, has none). Nudge is GCO-008, slice 8. If the split is built now, decide what these rows show meanwhile: Remove…, or nothing.
3. **Toasts.** The approved board says "Chidi is in. They've been emailed." and fewapproved says "Chidi is in. You have enough people to draw names." The code says "{first} is in." (Q14: no email is sent yet). The fewapproved line is new copy that isn't in the code.
4. **Back label.** The board says "Go back" (mobile UwNav, desktop UwButton back). The code says "Back" (`PARTICIPANTS_COPY.back`).
5. **Just-approved sub line.** fewapproved shows "{email} · Joined just now · No wishlist yet". The code has no such segment.

### Layout and widths
| | Board (m 390 / d 1440) | Code now | Change |
|---|---|---|---|
| Mobile padding | main `8px 20px 24px`, gap 32 | AppShell `pt-8 px-20 pb-24`, view `gap-32` | none |
| Desktop padding | main `40px 40px 64px` | AppShell `md:pt-40 md:pr-40 md:pb-64 md:pl-80` | shell-level; leave it |
| Desktop column | outer max 1040 (`max-w-content-max`), inner column **max 760px**, gap 32 | `md:max-w-reading-max` (640) | 760 = 47.5rem has **no token**; it needs a new spacing token (owner) or stays at reading-max |
| Desktop back | UwButton `back` above the header in the column, then 32 | AppShell BackButton `pb-32` | label only |
| m vs d | same structure; only the h1 (30 → 36) and card h2 (18 → 24) sizes change | requests go side by side on md | see Requests |

### Header
- h1 "Participants": Bona Nova 400, **30px m / 36px d**, lh 1.3. The code's `text-heading-2` is **24px** m / 36 d, so mobile is 6px small. Use `text-heading-1 md:text-heading-2` (heading-1 is 30 m), then check that the md variant beats heading-1's own 48px media rule. If it doesn't, the token set has no 30/36 style.
- Subtitle: 16px 400, **#414347 = `text-text-secondary`** (the code uses `text-text-default`).
- Header gap: **8** (`gap-8`; the code uses `gap-4`).
- Copy matches the code. The header, with its subtitle, also appears on the loading and error boards.

### Section headings
- `<h2>` in `flex justify-between items-center min-height:44` (`min-h-touch-target`). Type: **Plus Jakarta Sans 18px 600 lh 1.5 = `text-body-lg-semibold`**. The code's `text-heading-4` is the wrong font (Bona Nova 700) and becomes 24px on desktop.
- Section `flex-col gap-4` (already right). Order: Wants to join → Still need a wishlist → Ready → privacy line → CTA.
- The card headings ("1 more person needed", "Nobody has joined yet") are Bona Nova 700 18/1.4 m and 24/1.3 d. `text-heading-4` is correct for those.

### Member rows (UwListItem kind="person")
- Row: min-h 72 (`min-h-row`), `py-12`, gap 12, items centred. Divider on rows after the first is 1px **#f3f3f3 = `border-border-subtle`**; the code uses `border-border-default` (#e8e8e8).
- Avatar: face, **40px at both widths**, bg #e8e8e8, 2px white ring, initials 12px 600. The code's `size-avatar-sm md:size-40` is 36px on mobile. `size-40` exists.
- Title: `text-body-base-semibold`, already right. The own row reads "{name} (you)", already right.
- Sub line: 14px 400 lh 1.5, **#6b6b6e = `text-text-muted`**. One span with no clamp.
  - Members: "{email} · Wishlist added" / "{email} · No wishlist yet".
  - Own row: "Wishlist added" (status only; matches Q2).
  - Separator: " · ".
  - The code has no sub line. It has to wrap long emails (Q6): ListRow's `line-clamp-2` with no `break-words` would clip or overflow.
- Trailing: none on the own row; **"Remove…"** on Ready rows; "Nudge" on Still-need rows (conflict 2).

### Request rows (Wants to join)
- Row: the same person row, `trailing="none"`. Sub: **"{email} · Today at 8:12 am"**, with no "Asked" prefix. The code's `askedLabel` says "Asked today at …" / "Asked {day}, {time}". The board shows only today; the wording for older days goes to copy-pending.
- Buttons: a separate block **under** the row, `flex gap-8 pb-8`, **the same at m and d**, natural width.
  - **Approve** is `primary`.
  - **Decline** is **`text`**; the code uses `secondary`.
  - The code puts the buttons beside the name on md (`md:flex-row`) and stretches them on mobile (`*:flex-1`). Both differ from the board.
- Offline: both buttons disabled (the same as the code's `!online`).

### Trailing Remove control
- UwButton `link`: **14px 600**, #191a1c, underline dotted, min-h 44, padding 0; disabled #afafb0.
- The code's Button `link` is `text-body-base-semibold` (**16px**). Every board link (See all, Change, Try again, Nudge all) is 14px, so fix the shared Button: `link` → `text-body-sm-semibold`.

### Privacy line ("Nobody can see who drew whom, not even you.")
- Board UwAlert `privacy` (checked in UwAlert.dc.html): **no background, no padding, no radius**. `flex gap-8 items-start`, lock icon **16px** (`size-icon-sm`) in #6b6b6e with `padding-top:3px`, text `text-body-sm-regular text-text-muted`.
- The code's Alert privacy is `bg-surface-subtle rounded-xl p-16 gap-12` with a 20px icon. **The owner is right: there is no grey box on the board.** Fix the shared variant: drop the bg, padding and radius; use `gap-8` and `size="sm"`. The icon offset `mt-2` (2px) is the closest token to 3px.
- Shown on default, few, fewreq, fewapproved, approved and offline. **Not on alone**; the code always renders it.

### CTA "Invite more people"
- UwButton **`secondary`** with icon **`plus`**, which is Phosphor **`Plus`** (regular, 20px = `size-icon-md`) before the label, gap 8. Height 48, px 24, `border-1-5 border-border-emphasis`, pill shape. It sits in a plain div, so it takes its **natural width at m and d**.
- The code uses `secondary fullWidth md:w-auto` with **no icon**. Change: `icon={Plus}` and drop `fullWidth`.
- Shown on default, fewapproved, approved and offline (disabled). **Hidden on few and fewreq** (the card replaces it) and on alone. The code shows it whenever `inviteUrl && !alone`.

### Few-people card (few, fewreq): not in the code
- `bg-surface-subtle rounded-2xl p-24 gap-12`. h2 `text-heading-4` "1 more person needed". Body **16px** `text-body-base-regular text-text-secondary`.
- few: "Names need at least 3 people to draw. People can join until {day}." plus **Invite people** (primary, natural width).
- fewreq: "Approve {first} and you'll have the 3 people needed to draw. People can join until {day}." **No button.** The card comes before Wants to join.
- Slice-6 Q18 put "Join request would make 3" in slice 8; confirm the scope.

### Alone
- Header plus the card: "Nobody has joined yet" / "Names need at least 3 people to draw. Share the invite link so people can join by {day}." / **Invite people** (primary). There's no privacy line and no CTA.
- The code uses EmptyState. Its body is 14px (`text-body-sm-regular`) where the board has **16px**, and its action is full width on mobile where the board's is natural width. The bg, radius, padding and gap match.

### Loading
- Real header (title plus subtitle), then **5** UwLoading rows: min-h 72, gap 12, `border-subtle` between rows, a 48px square placeholder with radius 12 in #f3f3f3, bars at 60% × 14 and 40% × 12 (gap 8, pill), and a trailing 88 × 29 radius-8 block.
- The code has line skeletons in place of the header, then **3** rows.

### Error
- Header with subtitle, then UwAlert `error`: `bg-surface-error-subtle`, radius 12, padding `12px 16px 4px`, 20px warning icon, 14px text, and a "Try again" link.
- The code uses LoadError. It drops the subtitle, uses Alert `p-16`, and its link is 16px (fixed by the Button change). The copy matches.

### Offline
- UwAlert `offline` sits **above the header** inside main. Approve, Decline, "Nudge all" and Invite more people are disabled; the row links have no state set.
- The code uses the shell's OfflineBanner plus `!online`. Check that the banner sits above the h1.

### Shared components that would change
| Component | Change | Other callers |
|---|---|---|
| `components/ui/Alert.tsx` privacy | no bg/padding/radius, gap 8, 16px icon | exchange-list WishlistPickerSheet, YourListPage; joining InvitePreviewView, JoinContent; app/dev/components/page.dev.tsx |
| `Alert.tsx` error/offline (optional) | padding `12px 16px 4px` instead of `p-16` | every error/offline Alert: exchanges and wishlists LoadError, OfflineBanner, ParticipantsView |
| `components/ui/ListRow.tsx` | divider `border-border-subtle`; sub wraps (`break-words`) with no `line-clamp-2`, or a no-clamp option | app/(app)/exchanges/page, profile/page, wishlists/page; activity ActivityFeed; exchange-list IdeasList, JoinedContent, YourListPage; exchanges OrganiserTools, YourPart; shared-wishlist SharedWishlistView; wishlists WishlistDetail; app/dev Interactive, page.dev |
| `components/ui/Button.tsx` link | `text-body-sm-semibold` (14px) | OfflineBanner, SkeletonRegion, app/page.tsx, ProfileSetupForm, ActivityFeed, auth LoginForm/SignupForm/VerifyForm (×3), WishlistPickerSheet, YourListPage (×3), exchanges LoadError, PeopleSection, StartExchangeFlow (×2), AskToJoin, JoinForm, ParticipantsView, SharedFrame, wishlists LoadError, ShareSheet, WishlistDetail, page.dev (×2). Check Part 1 boards first |
| `components/ui/Avatar.tsx` | a 40px list-row face at all widths (better as a new size than changing `face`) | profile/page, Header, Sidebar, AvatarStack, ProfileSetupForm, InvitePreviewView, JoinContent, SharedWishlistView, page.dev |
| `components/ui/EmptyState.tsx` | 16px body; natural-width action on mobile | activity/page, (app)/error, wishlists/page, wishlists/[id]/page, not-found, exchanges NotAvailable, participants RemovedFromExchange, WishlistDetail, page.dev. Check the UwEmpty boards first; this may be a Participants-only card instead |

### Files for the builder (Participants)
`features/participants/components/ParticipantsView.tsx` and `ParticipantsContent.tsx` (header, width, loading, error subtitle), `features/participants/copy.ts`, `features/participants/format.ts` (`askedLabel`), and `app/(app)/exchanges/[id]/participants/page.tsx` (back label). Plus the shared components above, if the owner approves fixing them in the shared place.

## Owner decisions — 2026-11-16 (Tobechukwu Olih), Participants board
- Build Participants exactly from Org-People-default and its states, with "Go back". (Artboard 8a594c86674c could not be found; the owner confirmed this board.)
- Split the list now into "Still need a wishlist" and "Ready", and add the "1 more person needed" card. No Nudge until email exists. This reverses slice-6 Q13/Q18 for the split.
- The approve toast stays "{Name} is in." (no email line, no draw line).
- A newly approved row shows "{email} · Joined just now" until reload, as on the board.
- Privacy line: no grey background. CTA "Invite more people" is secondary with the Phosphor Plus icon.

## Builder — round 1 (database only) — 2026-11-16
- Task: organiser-emails — steps 1 and 2: pgTAP 210 and the migration. No app code.
- Requirements: owner decisions 2026-11-15 and 2026-11-16 Q1, Q2, Q3; GCO-007, GCO-003.
- Files/components: supabase/tests/security/210_organiser_emails.sql (new, plan 24), supabase/migrations/20261116125300_organiser_emails.sql (new), supabase/tests/security/190_join_requests.sql (6 assertions edited for the new shapes; plan stays 97).
- Work completed: get_participants gains `email` (null on the organiser's own row) and `has_wishlist` (attached_wishlist_id is not null); get_join_requests gains `email`. Both dropped and recreated, definer, search_path '', revoke then grant to authenticated. Nothing applied; no local database here (Docker not running), so no test has run.
- Outstanding issues: migration not applied; 210 and 190 not run; database.types.ts not regenerated.
- Next action: main session, with the owner's approval, applies the migration to the hosted dev project, runs 210, 190, 030, 040, 060, 170 (all plain SQL in begin/rollback), expects "ok 1".."ok 24", "1..24", no "not ok" in 210 (and 97 in 190), then regenerates types and runs `npm run db:drift -- --strict`.

### Builder — round 1 addendum — 2026-11-16
- Owner decisions: the 190 edit is approved; apply is approved (main session does it); has_wishlist must mirror the member's own screen.
- Rule mirrored from get_my_exchange_list: attached AND NOT (exchange_ideas list with no live items). An empty real wishlist and a soft-deleted ("kept") list stay true. Implemented as exists() over wishlists and live wishlist_items; no item data returned.
- Files: migration 20261116125300_organiser_emails.sql (not yet applied, edited in place) and 210 (plan 24 to 27: ideas list empty = false, one live item = true, empty real wishlist = true). Pass: ok 1..27, 1..27. Not run (no database).

## Main session — apply and security tests — 2026-11-16
- Red run before the apply: 210 gave 14 ok and 13 not ok, all on the new columns (42703 or the function shape).
- Applied with apply_migration after owner approval. The recorded version is 20261116125300 and the local file is renamed to match. The SQL sent is the file's statements with a shortened header comment.
- db:drift --strict: passed (16 files, 16 recorded).
- Green on dev: 210 27/27, 190 97/97, 030 9/9, 040 5/5, 060 22/22, 170 61/61.
- Types regenerated from dev with the connector. Note: the generator types `email` as `string`, but it is null on the organiser's own row, so the mapper must accept null.
- Next action: builder round 2 (app), covering the TypeScript split, the Participants page from the board spec, docs and e2e.

## Builder — round 2 (app) — 2026-11-16
- Task: organiser-emails — TypeScript split, Participants from the boards, join bullet, docs, tests.
- Requirements: owner decisions 2026-11-15 and 2026-11-16 (Q1, Q2, Q5, Q6, Participants board); GCO-007, GCO-003, GCO-008, GC-009.
- Files/components: features/participants/{queries,map,types,format,copy}.ts, components/{ParticipantsView,ParticipantsContent}.tsx; components/ui/{Alert,ListRow,Button,Avatar}.tsx; features/joining/{copy.ts,components/JoinContent.tsx}; docs (user-stories, copy-pending, progress); tests/unit/participants.test.ts; tests/e2e/approval-participants-signed-in.spec.ts and fixtures/exchange-seed.ts (attachWishlist).
- Work completed: names-only getJoinRequests (no email in type), getJoinRequestsWithEmail and getParticipants (email string | null, hasWishlist) via pure mappers in map.ts; Participants rebuilt (Go back, split lists, few/fewreq/alone cards, sub lines, Approve/Decline under the row, Joined just now, plus-icon CTA, privacy line bare, 5 loading rows, error subtitle); shared fixes in Alert (privacy), ListRow (subtle divider, wrapping sub), Button (link 14px), Avatar (new "row" 40px size); join bullet. Checks: typecheck, lint, tokens:check, 331 unit tests pass; e2e participants spec 10/10 at 390, 768, 1440 (E2E_PORT=3000, one width at a time); mobile-390 stubbed project 80 passed, 1 skipped. `npm run build` not run, as instructed.
- Outstanding issues: see progress items 97 and 98 (desktop column 640 not 760; loading subtitle is a skeleton; Alert error padding and EmptyState left alone; Nudge not built).
- Next action: tester, then reviewer.

## Owner decisions — 2026-11-16 (Tobechukwu Olih), copy and CLAUDE.md
- "Back" everywhere, replacing "Go back". Changed on the list pages, Participants, Privacy, the auth frame and the dev shell.
- The closed-joining fewreq line is "Approve {first name}."
- The error subtitle is the exchange name only, with no count.
- "{day}, {time}" and "{n} more people needed" are approved (not objected to).
- The CLAUDE.md product rule is replaced with the approved wording (main session edit).

## Reviewer — round 1 — 2026-11-16
- Verdict: APPROVED.
- R1-1 (Medium): the lock line lost its grey card on every caller (list page, picker, invite preview, join screen). Owner decision 2026-11-16: plain everywhere, matching the UwAlert board. This supersedes the slice 6 note that kept the list page grey.
- R1-2 (Low): unused `fewAction` copy, removed by the main session.
- R1-3 (Low): nested list on request rows; screen readers announce "list, 1 item". Logged, not blocking.
- R1-4 (Low): "Joined just now" is keyed by address. Acceptable.
- R1-5: the "Go back" mention above is superseded by "Back" everywhere.
- Tester round 1 was cut off by a usage limit. The main session ran the checks instead: typecheck, lint, tokens and unit tests 331 pass; signed-in e2e at 390 31/33 (the 2 failures pass on rerun), 768 33/33, 1440 33/33; Participants screenshots match the boards.
