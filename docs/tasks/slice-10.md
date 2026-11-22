# Slice 10 — Draw, names drawn, reveal

Task ID: slice-10
Stories: GCO-011 (manual draw), GCO-012, GC-014, GC-013 (after draw), GC-006 action card
Designs: S35, S36, S15, S14; boards Org-Draw-*, Org-Drawn-*, Exchange-Detail-odrawn/-drawn/-revealed/-hidden/-changed/-nolist/-offline, Exchange-Reveal-*, Exchanges-active, Email-E19, Email-E21, Activity-default
Plan ref: implementation-plan.md slice 10

---

## Planner — round 1 — 2026-11-22
- Task: slice-10 — Draw, names drawn, reveal (GCO-011 manual draw, GCO-012, GC-014, GC-013 after the draw, GC-006 action card)
- Requirements: GCO-011, GCO-012, GC-014, GC-013, GC-006; links read: GC-007 (Names drawn event), GC-008 (Exchanges rows), GC-010/GC-015 (list after the draw, slice 11), GC-012 (request closed by the draw), GC-017 (out of scope), GC-026 (Names are drawn toggle), GCO-006 (Draw names now… row, all-ready alert), GCO-009 (exclusions locked view). Plan §3, §5, §6 invariants 1–5, 7, 9, 10, 12, §7, §10 row 10. Open items 76, 84, 108.
- Files/components: see "Affected areas"
- Work completed: read CLAUDE.md, the stories, the plan, progress.md, the slice-9 log, all migrations that touch state, the outbox, join requests and activity, the exchange page code, and the local snapshots of the boards
- Outstanding issues: 12 owner questions (below). The schema needs approval before any step can start.
- Next action: the main session takes Q1–Q12 to the owner and has the live canvas boards checked (see Sources). After the answers, the builder starts at step 1 (security tests first).

### Status: APPROVED — building

### Owner answers — 2026-11-22

All 12 questions accepted as recommended:
- **Q1**: Schema approved (private.assignments, exchange_status returns drawn, draw_round, outbox E19/E21, new functions, names_drawn activity kind)
- **Q2**: Drawing before join-by accepted. Closes joining immediately.
- **Q3**: Count emails actually queued ("{told} of {n}"). Copy needed for partial email case.
- **Q4**: ActionCard on exchange page and Exchanges rows. Add-your-wishlist card included. All-ready alert deferred. Revealed card to slice 11.
- **Q5**: Closed-request row with Dismiss on Exchanges. Accepted.
- **Q6**: Activity "Names drawn" event included. Accepted.
- **Q7**: Hide "View their wishlist", plain rows for Most wanted, person row links to /reveal, list row plain. Accepted.
- **Q8**: After draw, Organiser tools shows only the Exclusions row. Accepted.
- **Q9**: Most wanted: up to 3, recently changed first. Accepted.
- **Q10**: /drawn organiser-only while drawn; /reveal anyone with assignment while drawn/event_passed. Accepted.
- **Q11**: Copy with no board to copy-pending.md. Accepted.
- **Q12**: Cancel pending E10 nudges at draw. Accepted.

### Questions for the owner

**Q1. Schema approval.**
- (a) A new table `private.assignments` with columns: `id`, `exchange_id`, `giver_member_id`, `receiver_member_id`, `draw_round int`, `kind` enum (`full` / `rematch` / `assignment`), `created_at`, `superseded_at`, `revealed_at`, `list_last_opened_at`, `ref_salt` (16 random bytes as hex). Member ids, not user ids. Partial unique index on (exchange_id, giver_member_id) where superseded_at is null, and a check that giver ≠ receiver. A trigger that blocks DELETE and blocks every UPDATE except: setting `superseded_at` once, setting `revealed_at` once, and changing `list_last_opened_at`. RLS on, no policy, no grant.
- (b) `private.exchange_status` returns `drawn` when a current assignment exists. Order: cancelled, then complete, then event_passed, then drawn, then joining_closed, then open.
- (c) `exchanges.draw_round` goes up by 1 on each draw, and `draw_blocked_reason` is cleared.
- (d) Outbox: widen `email_outbox_template_known` to allow E19 (Names are drawn) and E21 (Names are drawn, just organising). `enqueue_email` honours `notify_names_drawn` for both. `claim_due_emails` returns budget preset, gift day and people count.
- (e) New public functions: `draw_names`, `get_draw_summary`, `get_my_assignment`, `get_my_recipient`, `mark_assignment_revealed`. If Q5 accepted: extended `list_my_join_requests` and new `dismiss_join_request(id)`.
- (f) If Q6 accepted: a new value `names_drawn` in `activity_kind`.

**Q2. Drawing before join-by.** The boards show "Draw names now…" while joining is still open. Please confirm: the organiser can draw any time the exchange is open or joining has closed, in both draw modes. Drawing closes joining straight away: the link stops working and pending requests close. Recommendation: when names are drawn before join-by, the invite preview's `closed_at` shows the draw moment.

**Q3. "Everyone told" counts (S36, Exchange-Detail-odrawn, E21).** The boards say "8 of 8 people, by email" but E19 can be turned off. Recommendation: count the emails actually queued, so the line reads "{told} of {n} people, by email". The owner then needs wording for the odrawn sentence and E21 when not everyone was emailed. The alternative is to count everyone taking part and drop "by email".

**Q4. Where the action card goes.** There is no ActionCard component yet.
- Recommendation: build ActionCard (tray on mobile, banner on desktop). Show it on the exchange page for an unrevealed draw. Show it on Exchanges too with the drawn row subline.
- Also build the pre-draw "Add your wishlist" card (Exchange-Detail-nolist), which was moved to slice 10.
- The revealed card ("You're buying for Kemi." with View their wishlist) moves to slice 11 (its button goes to the recipient's list).
- The all-ready alert with Run draw (GCO-006, open item 108) has no board found. Recommendation: defer and log as open item.

**Q5. Requests closed by the draw (GC-006, open item 84).** The Exchanges-active board shows "Names were drawn before {first} could let you in." with Dismiss. Recommendation: build it on Exchanges in this slice.

**Q6. Activity "Names drawn" event (GC-007).** It goes to everyone taking part and links to Reveal. The Activity-default board has the row. Recommendation: include it.

**Q7. Links to slice-11 screens.** These targets don't exist until slice 11:
- Reveal's "View their wishlist" button and Most wanted rows
- The revealed person row on the exchange page
- "Your list for this exchange" after the draw

Recommendation: hide "View their wishlist", show Most wanted rows as plain rows with no chevron, make the person row link to `/reveal`, make the list row a plain row with the board's subline.

**Q8. Organiser tools after the draw.** The boards show Edit details, Hand over and Cancel (slices 13 and 15) and no Exclusions row. But slice 9 built the locked Exclusions view that's shown when drawn, and the Exclusions row is the only way to reach it. Recommendation: after the draw, show Organiser tools with only the Exclusions row.

**Q9. Most wanted on Reveal.** The board shows 2 items; the story says "top". Recommendation: up to 3 items, recently changed first. Hide the section when no items are Most wanted. Empty list: "They haven't added anything yet." No list: "{first} hasn't added a wishlist yet."

**Q10. Who can open the new pages.** Recommendation:
- `/exchanges/[id]/drawn`: organiser only, while names are drawn
- `/exchanges/[id]/reveal`: anyone with a current assignment as giver, while drawn or event_passed
- Everyone else gets S47 "isn't available"

**Q11. Copy with no board** (to go in copy-pending.md):
- Draw sheet body when every list is in
- Draw sheet exclusions note for 2+ pairs
- Draw row subline in "When I choose" mode while joining is open
- "Not enough people yet" body when the organiser is just organising, and for 2 others
- Generic draw failure
- E19 when the recipient is the organiser ("Only you will see it.")
- The Q3 wording

**Q12. Pending nudges at the draw (open item 108).** Cancel unsent E10 rows for the exchange when names are drawn. Recommendation: yes.

### Scope

**In:**
- Manual draw: the Draw names sheet and its states (GCO-011)
- The Names drawn page (GCO-012)
- E19 and E21 emails (GCO-012; boards Email-E19 and Email-E21)
- Reveal: privacy check, opening, revealed, empty, error and offline states; Hide again per device (GC-014)
- The exchange page after the draw for a participant, an organiser taking part and an organiser just organising: unrevealed, revealed, and hidden on this device (GC-013)
- The ActionCard (GC-006 / GC-013)
- If accepted: Q4 Exchanges rows, Q5, Q6, Q12

**Out:**
- Scheduled draw and the blocked state (slice 12)
- Recipient list, item detail, got-it marks, item refs in links, and the list after the draw (slice 11)
- Re-draw, re-match, blind assignment, "Your person has changed", E20 and E22 (slice 14)
- Leave (slice 14). Edit after the draw (slice 13). Cancel, hand over, complete and event-passed pages (slice 15)
- The populated Home
- Not in v1: hints (GC-016) and web push

### Approach
- **Engine reused, no retry.** `draw_names` locks the exchange row (`for update`). Checks state, refuses < 3 people (22023 `few`) or impossible exclusions (22023 `exclusions`). Calls `private.compute_matching` once. Inserts `kind='full'` rows, bumps `draw_round`, closes pending requests, cancels E10 rows, queues E19/E21, writes activity events.
- **Secrecy by function shape.** `get_my_assignment` returns only the caller's own row id and revealed flag. `get_my_recipient` returns the person's display name, budget, gift day and up to 3 Most wanted items. It never returns a list name, source, or item id.
- **Hide again** is per device in `localStorage`, keyed by assignment id.
- **State follows the architecture.** `exchange_status` stays calculated.

### Acceptance criteria
AC-1 through AC-17 (see planner output for full list). Key ones:
- AC-1: anon/authenticated get 42501 on private.assignments
- AC-3: organiser just organising gets zero rows from assignment functions
- AC-5: each member sees only the person they give to; no function holds a giver or receiver id
- AC-7: draw writes exactly n rows forming a permutation, no self-assignments, no excluded pairs; second call writes nothing
- AC-8: after draw, state is `drawn`; join/ask/approve/remove/save-exclusions/attach refused
- AC-12: server HTML never contains the recipient's name
- AC-13: privacy check until first reveal; Hide again per device

---

## Builder — round 1 — 2026-11-22
- Task: slice-10 — Draw, names drawn, reveal (steps 1-2: security tests and migration only)
- Requirements: GCO-011, GCO-012, GC-014, GC-013, GC-007, GC-012; AC-1 to AC-11, AC-13 (database side); owner answers Q1-Q12
- Files/components: supabase/migrations/20261122200000_draw_and_reveal.sql (placeholder timestamp); supabase/tests/security/300_assignments.sql (17 assertions), 310_draw_names.sql (37), 320_reveal.sql (17); edited 200_activity_events.sql (enum list), 220_email_outbox.sql and 270_nudges.sql (claim columns, E19/E21 details)
- Work completed: tests written first, then the migration. NOT run (no local database; the main session applies the migration and runs the tests). No app code written.
- Outstanding issues: (1) exchanges.draw_round and draw_blocked_reason and join_requests.dismissed_at already exist, so no ALTER TABLE was needed (plan Q1c). (2) Q2's "invite preview closed_at shows the draw moment" is NOT done: get_invite_preview is a separate long function outside the listed migration scope; today a drawn-before-join-by exchange reads status closed with closed_at = the future join-by. Needs a decision. (3) Existing tests 200, 220, 270 were edited for approved schema changes only (new enum value, new claim column, E19/E21 details).
- Next action: main session applies the migration (rename the file to the Supabase version), runs db:test (300, 310, 320 plus the full suite), regenerates database.types.ts, then the builder starts step 3 (app code).

### Status: DATABASE DONE — WAITING ON MIGRATION APPLY
