# Unwrap — Implementation plan

Approved 2026-11-03 by Tobechukwu Olih; revised the same day after an architecture review (see "Revision log" at the end). Read with [CLAUDE.md](../CLAUDE.md), [user-stories.md](user-stories.md) and the design canvases. The stories and designs win over this plan if they disagree. Slice status lives in [progress.md](progress.md).

Design screens are cited as S01–S48 and emails as E01–E28, as numbered on the canvases.

## 1. Product

Unwrap replaces WhatsApp-run Secret Santa for 18–40 year olds in Nigeria and West Africa. An organiser creates an exchange (₦ budget, join-by, draw time, gift day as a date only) and shares a link. People join with a passwordless email-code account, attach a wishlist or add ideas, names are drawn, and each giver privately reveals their person, browses their list and privately marks what they bought. Wishlists also stand alone and can be shared by link. Nobody, the organiser included, can read the pairs; wishlist owners never see purchase marks; repairs after someone leaves are blind.

Limits: at most **100 people** per exchange (this is GCO-005's invite limit and GC-009's "full"). People who left may **rejoin** under the normal join rules. People the organiser **removed** may rejoin only through a join request the organiser approves, even when approval is off.

## 2. User journeys

| # | Journey | Stories | Designs |
|---|---|---|---|
| J1 | Invitee joins from WhatsApp: preview → sign up → verify → join confirmation → attach list → You're in | GC-002, 003, 009–012 | S02, S03, S05, S10–S13 |
| J2 | Organiser starts an exchange: three steps → exchange page "just started" → share invite | GCO-001–005 | S26–S29, S14 |
| J3 | Organiser runs it: readiness, approve/decline, nudge, exclusions, edit, draw | GCO-006–011 | S30–S35 |
| J4 | Draw and gifting: names drawn → reveal → recipient's list → item → "I got this" | GCO-012, GC-014, 015 | S36, S15–S17 |
| J5 | Change after the draw: leave/remove → blind re-match, full re-draw, only-2-left, blind assignment | GC-017, GCO-007, 011 | S18, S37, S38 |
| J6 | Wrap-up: mark complete or auto-complete; cancel; hand over | GCO-013–015 | S39–S41 |
| J7 | Wishlists alone: create, items, share, public view, delete (incl. attached) | GC-018–023, 030 | S19–S25 |
| J8 | Landing sign-up → profile setup → Home first time | GC-001, 003, 005, 006 | S01, S06, S07 |
| J9 | Account: profile, email change, notifications, privacy/export, delete | GC-024–028 | S42–S46 |
| J10 | System: not available, removed, offline, errors | GC-029 | S47, S48 |

## 3. Routes

Approved with this plan. Sheets and dialogs are client overlays on their parent route. There are **no custom API routes**: reads happen in Server Components and every write, including Reveal and link preview, is a Server Action.

| Route | Access | Stories |
|---|---|---|
| `/` | public | GC-001 |
| `/i/[inviteToken]` (preview, or the unavailable state) | public | GC-002, 012 |
| `/i/[inviteToken]/join` (join confirmation) | auth + valid invite token | GC-009 |
| `/w/[shareToken]` (noindex) | public | GC-023 |
| `/signup`, `/login`, `/verify` | signed out | GC-003, 004 |
| `/welcome` | auth | GC-005 |
| `/home`, `/activity` | auth | GC-006, 007 |
| `/exchanges` (`?view=past`), `/exchanges/new` | auth | GC-008, GCO-001–003 |
| `/exchanges/[id]` | member | GC-013, GCO-004, 006, 015 |
| `/exchanges/[id]/list`, `/joined` | member | GC-010, 011 |
| `/exchanges/[id]/my-list` (S49 "Your list for this exchange", organiser taking part; route name pending owner OK) | organiser | GC-010, GCO-004 |
| `/exchanges/[id]/reveal`, `/recipient` (`?item=<ref>`), `/drawn` | giver / member | GC-014, 015, GCO-012 |
| `/exchanges/[id]/participants`, `/exclusions`, `/edit` | organiser | GCO-006, 007, 009, 010 |
| `/wishlists`, `/wishlists/[id]` | owner | GC-018, 020 |
| `/profile`, `/profile/account`, `/profile/notifications`, `/profile/privacy` | auth | GC-024–027 |
| `/dev/components`, `/dev/shell` | development builds only; absent from production | none (component gallery) |

**Joining is authorised by the invite token, never by an exchange id.** `join_exchange(token)` and `request_to_join(token)` accept only a token, so resetting a leaked link (GCO-005) really closes it.

These open as sheets or dialogs: Invite people, Nudge, Draw names, Remove person, Leave, Cancel, Hand over, Pair repairs, Mark complete, New / edit wishlist, Add / edit item, Share, Delete list, Delete account. Not available and "You're no longer in {exchange}" are states rendered by each route.

## 4. Components (`components/ui`, tokens only)

- **Button:** primary, brand (only Draw names and Reveal), secondary, destructive, text, destructive-text, link, icon. States: hover, pressed, focus, disabled, busy. "…" in a label means it confirms first.
- **Fields:** text, money (₦, whole naira ↔ kobo), textarea with counter, date, time (shows the zone).
- **OtpInput:** **one** `<input inputmode="numeric" autocomplete="one-time-code" maxlength="6">` styled as six boxes, so phone autofill, paste and screen readers work. Auto-submits on the sixth digit, announces "Checking code" in a live region, and keeps the Verify button the design shows.
- **Sheet:** built on the native `<dialog>` element (focus trap, Esc, inert background built in). Bottom sheet under 768px, 480px dialog from 768px. Confirm, destructive (no backdrop close) and form variants. No swipe-to-close in v1. Returns focus to the opener on close.
- **Toast:** 4s; 8s with Undo. The timer pauses while the toast has focus or the pointer is on it. Announced through `aria-live="polite"`.
- **Alert:** offline, section error, privacy line (lock). The offline banner is this component's offline variant.
- **EmptyState, Skeleton** (hidden for 300ms, "Taking longer than usual" after 8s, `aria-busy` on the region), **Spinner.**
- **Identity:** Avatar (initials fallback), AvatarStack (max 5, dashed for missing), ExchangeTag (decorative, `aria-hidden`; always shown beside the exchange name).
- **Content:** ListRow (whole row a link; trailing actions are siblings), Card (block, prompt), **ActionCard** (the one personal action; docks as a tray above the tabs on mobile and a banner above the content on desktop), **Chip** (all non-tappable labels: dates, Most wanted, Nice to have, Updated, You got this, Over budget, count badge), Timeline, SegmentedTabs, RadioGroup, Checkbox.
- **Layout:** AppShell (BottomTabs < 768px, Sidebar ≥ 768px, Activity badge), **Header** (one component with a `back` prop).
- **Shared pieces:** `<LocalDateTime format>`, `<Naira>`, `ShareActions`, `InviteContextBanner`.

UI strings live in the components beside their story IDs. There is no central strings module; unapproved copy goes in [copy-pending.md](copy-pending.md).

## 5. Data model (Postgres, RLS on every table)

Two schemas:

- **`public`**: tables the app reads through RLS, and the `SECURITY DEFINER` functions it calls.
- **`private`**: tables nobody may ever read directly: `assignments`, `gift_marks`, `email_outbox`. This schema is not exposed by the Supabase API at all; only definer functions in `public` touch it.

| Entity | Notes | Who can read |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; display name, avatar path, photo prompt dismissed, anonymised_at. No email. | self; people sharing an active exchange |
| `user_settings` | 4 notification toggles, default wishlist visibility, **time zone** (captured on sign-in; used for emails) | self |
| `wishlists` | `kind` (`personal` / `exchange_ideas`), owner, name (60), visibility (`private` / `link`), permanent share token, deleted_at. A check stops `exchange_ideas` lists being `link`. | owner; public via `get_shared_wishlist(token)`; giver via assignment |
| `wishlist_items` | name (120), link, price_kobo (bigint, `≤ 100000000000`, `% 100 = 0`), priority, note (280), photo path, updated_at, deleted_at | as the wishlist |
| `exchanges` | name (40), note, organiser_id, `budget_preset` enum, join_by_at, draw_mode, draw_at, `gift_day date` (replaces `event_at`, 2026-11-09; a date in `organiser_tz`, passed at the end of that day in `organiser_tz`), organiser_tz, approval_required, invite token (resettable, ≥ 128-bit random), tint, cancelled_at, completed_at, reopened_join_by_at, draw_blocked_reason, draw_round | members; non-members via `get_invite_preview(token)` (inviter, count, dates) |
| `exchange_members` | taking_part, state (`active` / `left` / `removed`), joined_at, left_at, `attached_wishlist_id`. The organiser always has a member row, with `taking_part = false` when just organising. Partial unique index on (exchange, user) **where state = 'active'**, so people who left can rejoin. Join is refused at 100 active members. | co-members; organiser readiness via function (booleans only) |
| `join_requests` | status (`pending` / `approved` / `declined` / `closed`), dismissed_at | requester, organiser |
| `email_invites` | invited email, sent_by, created_at | organiser of that exchange |
| `exclusions` | unordered member pair | organiser only |
| `activity_events` | one row per reader; written only by the database | own rows |
| `private.assignments` | giver, receiver, draw_round, kind (`full` / `rematch` / `assignment`), superseded_at, revealed_at, list_last_opened_at, ref_salt. Rows are immutable apart from those timestamps; a change of person writes a new row. Partial unique index on (exchange, giver) where superseded_at is null. | **nobody directly**; `get_my_assignment(exchange)` returns the caller's current giver row only |
| `private.gift_marks` | (assignment_id, item_id) | **giver only**, via function |
| `private.email_outbox` | recipient, template, payload, `kind`, `sender_id`, `exchange_id`, `for_at`, send_after, sent_at, cancelled_at, dedupe_key | service role only |

How the stories map onto this model:

- **Exchange state is calculated, never stored.** `exchange_state(exchange)` derives open / joining closed / drawn / event passed / complete / cancelled from the timestamps and the current assignments. Time-based states change with the clock, so storing them would go stale.
- **Your list for this exchange (GC-010)** is the member's `attached_wishlist_id`:
  - Attached wishlist: points at a `personal` wishlist.
  - Ideas: points at that member's `exchange_ideas` wishlist for this exchange. Choosing a real wishlist just re-points; the ideas list stays hidden and "Add items instead" points back at it.
  - Kept from a deleted list (GC-030): the attached `personal` wishlist has `deleted_at` set. Nothing is copied. The owner can no longer reach it, so it's frozen; Undo clears `deleted_at` and the items follow the list again. Deleting an empty attached list also detaches it.
- **Opaque item references (GC-015):** `item_ref = md5(assignment.ref_salt || item_id)`, computed only when returning items to the giver. No global key.
- **Rate limits and dedupe** query `private.email_outbox`: 12-hour nudge skip and 20 nudges an hour per organiser (GCO-008), 3 data exports a day (GC-027), reminder dedupe with "resend only if the new date is later" (GC-026).
- **Budget presets (GCO-002):** `budget_preset` enum `5k_10k`, `10k_20k`, `20k_50k`, `50k_plus`. One SQL function and one TypeScript map give the ranges (₦5,000–₦10,000; ₦10,000–₦20,000; ₦20,000–₦50,000; Above ₦50,000) for display and "Within / Over / Under the budget".
- **Images:** public Storage buckets with unguessable paths (a new UUID per upload, a fresh path on replace, listing disabled). Avatars and item photos aren't secret; the data around them is protected by RLS. This lets the invite preview and shared wishlist show photos to visitors without signed URLs or the service role.

Glossary: host = organiser; reservation = got-it mark; wish list = wishlist.

## 6. Authentication and authorisation

- Supabase Auth email OTP only: 6 digits, 10-minute expiry, code-only email. **Custom SMTP through Resend and tuned OTP rate limits are set up in slice 1**, because Supabase's built-in email sending is too rate-limited for real users. No phone or SMS login in v1, no social sign-in, no passwords.
- Next 16 `proxy.ts` refreshes the session. Verify state (email, invite context, cooldown) persists mainly in a short-lived cookie, with `localStorage` as a backup, because WhatsApp's in-app browser may clear storage. Cleared on success. Deep links kept in a sanitised `next`.
- Roles to test: visitor, signed-in outsider, requester, member taking part, organiser taking part, organiser just organising, giver, receiver, former member, anonymised user.
- **Authorisation lives only in the database** (RLS and definer functions). Server Actions parse input and call the database; they don't repeat permission checks. Request handlers use the user's session; the service role is only for the email worker and the scheduled job.

**Function hardening (first migration):**

- Revoke the default `EXECUTE` from `PUBLIC` on functions and set default privileges so new functions start closed; grant execute per function to `authenticated` or `anon` as needed.
- Every `SECURITY DEFINER` function sets `search_path = ''` and uses schema-qualified names.
- RLS helper functions (`is_member`, `is_organiser`) are definer functions, so policies on `exchange_members` don't recurse.

**Security invariants** (each a pgTAP test written before its migration):

1. `anon` and `authenticated` are refused on every table in `private`; the API exposes no `private` schema.
2. A test fails if any function in `public` is executable by `anon` without being on an explicit allowlist (`get_invite_preview`, `get_shared_wishlist`).
3. `get_my_assignment` returns only the caller's current giver row.
4. A wishlist owner can't read marks on their items by any path (table, function, Activity, export).
5. A receiver can't learn their giver from any function, event payload or email.
6. Profiles are readable by co-members only; email is readable by its owner only.
7. A private wishlist is readable by its owner and, after the draw, by the giver of an exchange it's attached to. An `exchange_ideas` list is never readable by link.
8. Joining requires a valid, unreset invite token; an exchange id alone joins nothing. Joining is refused at 100 active members. A user whose latest membership is `removed` always gets a pending join request, never a direct join, whatever the approval setting.
9. Activity events and the outbox are written only by database functions; users read only their own events.
10. Organiser functions check `organiser_id = auth.uid()`; client-sent user ids are never trusted.
11. Only the organiser can read `exclusions`.
12. Completed exchanges are read-only.

Tests that expect a refused read check for `insufficient_privilege`, not zero rows.

## 7. Risks

| Risk | Level | Mitigation |
|---|---|---|
| Pairs leak via API, props, logs, errors, emails, events | Critical | Secret tables in `private`; pairs leave the database only via `get_my_assignment`; view types without forbidden fields; leak tests first |
| Functions callable by anyone by default | Critical | Default `EXECUTE` revoked; per-function grants; allowlist test |
| Joining without a valid invite | High | Token-only join RPCs and route |
| Draw without a retry loop | High | Pure `compute_matching(people, forbidden, seed)` in plpgsql: maximum bipartite matching (no self, no excluded pair either way) with randomised edge order and augmenting paths; feasibility comes from the same function. Writes happen separately in a transaction with a lock, so drawing is idempotent. pgTAP loops over many random inputs. 100 people is well within range. |
| Blind repairs (re-match, re-draw, assignment, several leavers) | High | Same engine; property tests |
| Viewer time zone on server-rendered pages | High | `tz` cookie set by a client script; until then render in `Africa/Lagos`; refresh only if the zone differs. Store `timestamptz`; do wall-clock conversions in Postgres with `AT TIME ZONE` |
| Email dates in the wrong zone | Med | Format with the recipient's `user_settings.timezone` |
| Session lost in WhatsApp's in-app browser | High | Cookie-first verify state; tested on real Android and iOS WhatsApp in slice 1 |
| Auth email rate limits | High | Resend SMTP and tuned OTP limits in slice 1 |
| Link import fetches arbitrary URLs | Med | Server Action: https only, resolve the host and block private and metadata IPs, no redirects to them, size and time limits, NGN prices only; manual entry stays primary |
| Reveal data must not be in the HTML | Med | Fetched by a Server Action after the tap; "Hide again" per device in `localStorage`, keyed by assignment id (a changed person is a new row, so every device resets) |
| Contrast | Med | `text/pending` (3.67:1), `text/placeholder` (3.49:1), `text/brand` on `brand-subtle` (4.13:1) and `border/pending` / `border/success` fall short; they never carry meaning alone (see §8) |
| Account deletion keeps pairs intact | Med | Anonymise profile, remove auth user, soft-delete wishlists, run leave repairs |
| Large queries on Home and Exchanges | Low | Faces for all rows in one query; indexes on `join_by_at`, `draw_at`, `gift_day` for the scheduled job |
| Token drift | Low | Tokens generated from `design/variables_tokens.json`; check script fails on arbitrary values |

## 8. Architecture

- **App:** Next.js 16 App Router, TypeScript strict, server-rendered by default. Reads in Server Components via `@supabase/ssr`; writes via Server Actions that call RLS-protected tables (plain wishlist edits) or database RPCs (anything with rules: join, draw, repair, hand over, cancel, complete, nudge, reveal, delete account). No `app/api`.
- **Validation:** database `CHECK` constraints are the source of truth, plus small hand-written form validation. No validation library unless approved.
- **Secrecy-critical logic lives in Postgres:** draw engine, repairs, readiness, event and outbox writes, giver reads.
- **Scheduling:** one `pg_cron` job runs `tick()` every minute. It handles every time-based change: auto-draw (and the blocked state), join-by and event reminders, closing pending requests at the draw, auto-complete 7 days after the event. It never stores time-based state (see `exchange_state()`).
- **Email:** `tick()` and the RPCs write to `private.email_outbox`. One Supabase Edge Function sends due rows (`send_after <= now()`) through Resend and marks them sent; Undo cancels a row before then. Nudges get `send_after = now() + 20s`, so a once-a-minute sender still honours the Undo window. Templates are plain TypeScript functions returning HTML in `supabase/functions/_shared/emails/` (Edge Functions can only import from inside `supabase/functions/`). Sign-in codes are the one exception: Supabase Auth's own template, sent through Resend SMTP.
- **Dates:** conversions in Postgres; formatting with `Intl.DateTimeFormat`. No date library.
- **Client components only for:** the OTP input, sheets, toasts, optimistic wishlist edits, Reveal, the offline banner, share/copy, the `tz` cookie script, and the three-step create flow (kept in client state; nothing is written until "Start exchange").
- **Tokens:** a script turns `design/variables_tokens.json` into a Tailwind v4 `@theme` file. The `sizing/:25`, `sizing/:5` and `sizing/1:5` primitives are emitted as `sizing-0-25`, `sizing-0-5` and `sizing-1-5` (the export names `sizing/:5` as `sizing-5`, which collides with `sizing/5`). A check script fails on hex, `px` or arbitrary `[...]` values outside the generated file.
- **Colour use:** `text/pending`, `text/placeholder`, `text/brand` on `brand-subtle`, `border/pending` and `border/success` always appear with an icon or a text label that carries the meaning on its own; they are never the only signal (decided 2026-11-03).
- **Icons:** Phosphor through the server-safe import (`@phosphor-icons/react/dist/ssr`).
- **Breakpoint:** one breakpoint, 768 (`md`). From 768 the Sidebar replaces BottomTabs, sheets become dialogs, and headings use the desktop sizes. Below it, mobile. Page content at 768 is judged against the mobile designs.
- **Focus ring:** `border/focus` (ink) on light surfaces; `border/inverse` (white) on ink surfaces such as the toast.
- **Mobile layout:** viewport meta with `interactive-widget=resizes-content`; `dvh` units; the tab bar is hidden on form pages and inside sheets; the main action is pinned above the keyboard; the action tray shrinks on scroll. Reveal and celebration motion respect `prefers-reduced-motion`.
- **Offline:** the banner shows when `navigator.onLine` is false **or** a request fails with a network error, and clears on the next success.
- **Tests:** pgTAP via `supabase test db` (local stack, Docker); Vitest for pure functions; Playwright end-to-end with seeded users per role at 390, 768 and 1440 wide, with `@axe-core/playwright` accessibility checks. 768 is judged against the mobile designs. Screenshot tests compare against earlier app screenshots; the first baselines are approved by hand against the canvases.
- **Hosting:** Vercel; a local Supabase stack plus one staging project. Supabase branch databases (a paid feature) are deferred. Error monitoring later, ask first.

## 9. Folder structure

```
app/
  (public)/            page.tsx · i/[inviteToken]/ (page, join/) · w/[shareToken]
  (auth)/              signup · login · verify
  (app)/               layout.tsx (AppShell + auth gate)
    welcome/ home/ activity/
    exchanges/ new/ [id]/ (list, joined, reveal, recipient, drawn, participants, exclusions, edit)
    wishlists/ [id]/
    profile/ account/ notifications/ privacy/
proxy.ts               (Next 16 session refresh)
components/
  ui/  layout/
features/
  auth/ exchanges/ joining/ draw/ gifting/ wishlists/ activity/ account/
    components/  actions.ts  queries.ts  types.ts
lib/
  supabase/  dates/  money/  validation/
styles/
  tokens.css           (generated; do not edit)
scripts/
  build-tokens.ts  check-tokens.ts
supabase/
  migrations/
  tests/               security/  engine/
  functions/           send-email/  _shared/emails/ (E01–E28)
  seed.sql  config.toml
tests/
  e2e/  unit/
docs/
  user-stories.md  user-stories.baseline.md  implementation-plan.md  progress.md  copy-pending.md  tasks/
```

## 10. Slices

Each slice: branch `slice-<n>-<topic>`, handoff log `docs/tasks/slice-<n>.md`, planner → builder → tester → reviewer. Done only when its security tests have run and passed and the definition of done in CLAUDE.md is met, including a signed-in click-through for every role it touches.

| # | Slice | Stories | Designs | Database work (tests first) |
|---|---|---|---|---|
| 0a | App foundation: scaffold, strict TS, lint, token build + check, fonts, Phosphor, `components/ui` primitives (Button, Field, Sheet, Toast, Alert, Skeleton, Avatar, Chip, Header), AppShell, offline Alert, viewport and `tz` cookie script, CI (typecheck, lint, tokens, Vitest, build) | none | component boards | none |
| 0b | Database and test harness: local Supabase, `private` schema, default `EXECUTE` revoked, migration conventions, pgTAP, seeded users per role, Playwright at 3 widths + axe, CI security tests | none | none | "RLS on every table", "no `private` access", "function allowlist" tests |
| 1 | Sign up, log in (email), profile setup, Home first time, log out; **Resend SMTP and OTP rate limits**; real-WhatsApp verify test | GC-001, 003, 004, 005, 006 (first time), 024 (log out) | S01, S03–S07 | `profiles`, `user_settings` (incl. time zone), sign-up trigger |
| 2 | Wishlists core, manual entry | GC-018–021 (no link import or photo) | S19–S22, S24 | `wishlists` (with `kind`), `wishlist_items` |
| 3 | Share and public view, default visibility | GC-022, 023, 027 (default) | S23, S25, S45 | `get_shared_wishlist` |
| 4 | Start an exchange | GCO-001–004, GC-008 (basic), GC-013 (just started) | S26–S28, S14, S08 | `exchanges` (budget enum), `exchange_members`, `exchange_state()` |
| 5 | Invite and join (open joining) | GC-002, 009–012, GC-013 (before draw), GCO-005 (link, copy, WhatsApp) | S02, S10–S13, S29, S49 (boards Org-List-*, Exchange-Detail-oattached / -oideas) | `get_invite_preview`, token-only `join_exchange`, 100-member limit, rejoin, `attached_wishlist_id`, ideas lists |
| 6 | Approval, participants, Activity v1 | GCO-003 (approval), GCO-007 (before draw), GC-012 (ask to join), GC-006/008 request rows, GC-007; removed people rejoin by request only | S30, S31, S09, S13 | `join_requests`, `activity_events`; join RPC routes removed users to a request |
| 7 | Email outbox, sender, notification preferences, email invites | GC-026, GCO-005 (email) | S44, emails | `private.email_outbox`, send-email function, `email_invites` |
| 8 | Readiness and nudges | GCO-006, 008 | S30, S32, S07 | `get_readiness`; nudge limits from the outbox |
| 9 | Exclusions and draw engine | GCO-009 | S33, S35 | `exclusions`, `compute_matching` + property tests |
| 10 | Draw, names drawn, reveal | GCO-011 (manual), 012, GC-014, GC-013 (after draw), GC-006 action card | S35, S36, S15, S14 | `private.assignments`, draw RPC, `get_my_assignment`, reveal RPC |
| 11 | Recipient wishlist and got-it marks | GC-015, GC-010 (after draw) | S16, S17, S11 | `private.gift_marks`, opaque refs |
| 12 | Scheduled jobs | GCO-011 (scheduled, blocked), GC-026 reminders, GCO-015 (auto) | S14, emails | `tick()` via `pg_cron`; reminder dedupe from the outbox |
| 13 | Edit exchange | GCO-010 | S34 | locked-field rules, "Tell everyone" email |
| 14 | Leaving and blind repairs | GC-017, GCO-007 (after draw), GCO-011 (re-draw, assignment), reopen | S18, S37, S38 | repair RPCs on the engine |
| 15 | Cancel, hand over, complete | GCO-013–015 | S39–S41, S14 | completion and read-only guards |
| 16 | Account | GC-024, 025 (email change), 027 (explainer, export), 028, GC-030 | S42, S43, S45, S46, S24 | anonymisation, export, kept lists (soft delete + detach empty) |
| 17 | Link import and photos | GC-021 (link, photo), GC-005/024 photo | S22 | public buckets with random paths + policies |
| 18 | Hardening | GC-029 all variants, GC-006 edge cases, accessibility, screenshot baselines | S47, S48 | none |

Not in v1 (do not build): phone/SMS login and phone numbers, invite QR code, hint requests (GC-016), web push, SMS/WhatsApp sending, wishlist dates, claim-an-item mode, switch account, swipe-to-close sheets.

## Revision log

**2026-11-09 (decided by Tobechukwu Olih):**

- **Gift day:** a date only, with no gift time. `exchanges.event_at` becomes `gift_day date` through a new migration; the applied `exchanges` migration is not edited. The gift day is set in `organiser_tz` and has passed at the end of that day in `organiser_tz`. The join-by day must be before the gift day, in both draw modes. The gift day is shown as stored, the same date for every viewer; only the end-of-day cutoff uses the organiser's time zone (owner, Q2, 2026-11-09). Join-by and draw times show in each viewer's own time zone. The E24 reminder goes at 9:00 am the day before the gift day, in each recipient's time zone.
- **S49 Your list for this exchange:** its own route (`/exchanges/[id]/my-list`, name pending owner OK), entered from S14 › Your part for an organiser taking part. It attaches a whole wishlist or ideas, never single items, and is built in slice 5 with the attach work.

**2026-11-03, after the architecture review (approved by Tobechukwu Olih):**

- **Security:** joining by invite token only (`/i/[inviteToken]/join`); default function `EXECUTE` revoked with an allowlist test and `search_path = ''`; secret tables moved to a non-exposed `private` schema; public image buckets with random paths instead of signed URLs; recipient time zones stored for emails.
- **Data model:** exchange state calculated by `exchange_state()`; kept lists are soft-deleted wishlists (no copies); ideas are a hidden `exchange_ideas` wishlist; `exchange_lists`, `exchange_list_items`, `giver_list_views`, `draws`, `reminders_sent`, `nudges` and `data_export_requests` removed; assignments immutable with `ref_salt`; marks keyed by item id; `budget_preset` enum; whole-naira check; 100-member limit; rejoin allowed (removed people only through an approved request).
- **Layers:** no `app/api`; authorisation only in the database; one `tick()` job; email templates under `supabase/functions/_shared/emails/`; no date, validation, email-template or dialog library.
- **Components:** ActionCard, Chip, Alert, Header and `<LocalDateTime>` merged; `lib/copy` dropped; single-input OTP; native `<dialog>` sheets.
- **Accessibility and mobile:** contrast rule for weak tokens; toast timers pause; reduced motion; viewport and keyboard handling; offline detection from failed requests; Resend SMTP moved into slice 1.
