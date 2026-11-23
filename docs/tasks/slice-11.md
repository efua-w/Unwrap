# Slice 11 — Recipient wishlist and got-it marks

Task ID: slice-11
Stories: GC-015 (recipient list, item sheet, got-it marks), GC-010 (after the draw), plus the slice-10 Q7 deferrals (GC-013, GC-014). Item 110.
Designs: S16, S17, S11 (after the draw), Exchange-Detail-revealed. Boards could not be read by the planner; see docs/tasks/slice-11-boards.md when it exists.
Plan ref: implementation-plan.md slice 11 (`private.gift_marks`, opaque refs)

---

## Planner — round 1 — 2026-11-23
- Task: slice-11 — recipient wishlist, item sheet, got-it marks, list after the draw
- Requirements: GC-015, GC-010 (after the draw), GC-013, GC-014 (slice-10 Q7 deferrals), item 110; AC-1 to AC-11
- Files/components: supabase/tests/security/340, 350, 360 (new), 210 (edit); new migration; app/(app)/exchanges/[id]/recipient (new); features/gifting/* (new); features/draw/components/RevealFlow.tsx, RecipientRow.tsx, actions.ts, types.ts, copy.ts; features/exchanges/components/ExchangeDrawn.tsx; features/exchange-list/components/ListContent.tsx, YourListPage.tsx, copy.ts, queries.ts; lib/money/budget.ts; docs/copy-pending.md
- Work completed: read the docs, migrations and code. Boards S16, S17 and S11 (after the draw) were not readable (no local snapshots, no notes in docs).
- Outstanding issues: Q1 to Q9; boards need a live canvas check
- Next action: main session takes Q1 to Q9 to the owner and has the boards checked. The builder then starts at step 1 (security tests first).

### Status: NEEDS CLARIFICATION

### Scope
**In:** GC-015 (recipient list, item sheet, marks, the Updated / You got this / Over budget badges, the taken-off note, empty list, no list, no link, no price). GC-010 after the draw (attach when nothing is attached, ideas, Remove wishlist… with Undo, a kept list cannot be removed). The slice-10 Q7 deferrals: Reveal's "View their wishlist" button and Most wanted rows as links, the revealed person row going to the list, the list row opening Attach, and the revealed ActionCard. Item 110 for the new functions.

**Out:** GC-016 hints (not in v1). Home "Gift bought" (Home slice, item 56). Photos (slice 17). Changed person, re-match and two givers in the UI (slice 14). Deleting an attached list (slice 16). Read-only complete state (slice 15). Item 112. Item 119 (Q8).

### Database objects (all need owner approval, Q1)
1. New table `private.gift_marks`: `assignment_id` (FK), `item_id` (FK to wishlist_items), `created_at`, primary key on the pair. RLS on, no policy, no grant to any role.
2. New `open_recipient_list(p_exchange)`, volatile. Who: the caller's current, revealed assignment only, while the state is `drawn` or `event_passed`. Returns name, avatar, list_state and items `{ref, name, priority, note, price_kobo, link, updated, got}`, recently changed first; also `taken_off[{ref, name}]` (items the giver marked that are no longer on the attached list). Then sets `list_last_opened_at` to now; `updated` means the item's `updated_at` is later than the old value. Never returns an item id, wishlist id, list name or source.
3. New `set_gift_mark(p_exchange, p_ref, p_got)`. Resolves the ref through `md5(ref_salt||id)` for the caller's row only. Idempotent. P0002 for anyone else.
4. Replace `get_my_recipient` to add the same state check (closes item 110 in the database).
5. Widen `attach_wishlist` and `use_exchange_ideas` to `drawn`/`event_passed`, only when nothing is attached. New `detach_wishlist(p_exchange)`, refused for a kept list.
6. Add the new functions to the 210 allowlist.

### Core security rule
- Marks are scoped by assignment, so the owner, the organiser and other givers have no path to them.
- A mark never changes `wishlist_items`/`wishlists` `updated_at`, writes no activity and sends no email.
- Refs are salted per assignment. A ref from another giver, or from a replaced row, resolves to nothing.
- The name is never in server HTML (slice-10 AC-12). The page loads by Server Action after mount and honours Hide again.

### Steps
1. Write pgTAP 340_gift_marks, 350_recipient_list and 360_list_after_draw first. Edit 210.
2. Write the migration (Q1). The main session applies it, runs drift and db:test, regenerates the types.
3. TS budget compare (Within/Over/Under) and strict parsers with exact keys, plus Vitest tests.
4. `/exchanges/[id]/recipient`: client loader and RecipientList reusing ListRow, Chip, Naira and EmptyState.
5. Item Sheet (`?item=ref`): Open the shop, Copy link (ShareActions), I got this with Undo, I haven't got it after all.
6. Reveal: "View their wishlist" and Most wanted links. RecipientRow goes to the list once revealed.
7. Revealed card as a client component (Q4).
8. ListContent/YourListPage after the draw: no Skip, after-draw intro and toasts, Remove sheet.
9. Exchange page list row becomes a link. E2E (opt-in draw) at three widths, then docs.

### Acceptance criteria
- AC-1: anon and authenticated get 42501 on `private.gift_marks`.
- AC-2: the owner (taking part or organiser) cannot tell whether an item is marked, and their items' `updated_at` is unchanged.
- AC-3: an organiser who only organises, an outsider, an unrevealed giver and a cancelled exchange all get P0002 / no rows.
- AC-4: the output keys are exactly the listed set: no id, list name or source.
- AC-5: a foreign ref or a ref from a replaced row is refused. Two givers each see only their own marks.
- AC-6: Updated is computed against the previous open, then the time is stamped.
- AC-7: a marked item removed from the list shows in the taken-off note and can be unmarked.
- AC-8: after the draw, attaching works only when nothing is attached. Detach keeps marks and Undo restores them. A kept list cannot be detached.
- AC-9: the recipient's name is absent from the server HTML of `/recipient` and the exchange page.
- AC-10: exact strings: "They haven't added anything yet", "{first} hasn't added a wishlist yet.", "No shop link. The name and note are all there is.", "Marked “{name}” as got. Only you can see this.", "Only you can see this. {name} never will.", "Within / Over / Under the {budget} budget.", "Your giver will see the list you pick as soon as you attach it.", "Wishlist attached. Your giver can see it now.", the Remove sheet text, "Wishlist removed from {exchange}."
- AC-11: loading, error and offline states at 390, 768 and 1440 pass axe.

### Risks
- Pair leaks through side effects or timing.
- A server-rendered revealed card would leak the name.
- The ideas insert policy allows adding to the hidden ideas list while a wishlist is attached (harmless, note it).
- Regressions in slice-5 attach before the draw.
- Real-draw e2e stays out of CI (item 115).

### Copy needing approval
The taken-off note, the Remove-failed and mark-failed errors, the revealed-card sub line, the Hidden state on `/recipient`, and the item-not-found message.

### Questions for the owner (planner's recommendation first)
- **Q1.** Approve the schema and functions above. Recommendation: yes.
- **Q2.** Updated badge: compare against the previous open and stamp on load. A reload or a second tab clears the badges. A list attached after the last open shows no badges (no `attached_at` column, none would be added).
- **Q3.** Hidden on this device and `/recipient`: show "Hidden on this device" with Show (to /reveal) and load nothing.
- **Q4.** Revealed card: exchange page only, client-loaded, dismissible per item 120 with the key `recipient:<assignment id>`, not shown while hidden. Open: is there a revealed card on the Exchanges rows?
- **Q5.** List and marks after the gift day: allowed during `event_passed`, refused once complete or cancelled.
- **Q6.** Taken-off note also covers marked items on a list the recipient removed.
- **Q7.** Remove wishlist… for ideas: personal wishlists only; ideas are removed item by item.
- **Q8.** Item 119 (`get_invite_preview` after the gift day): its own task, not this slice.
- **Q9.** Exchange page after the draw with no list: the Your part row only, no card. The Reveal card wins.

### Status: APPROVED — building (database first)

### Owner answers — 2026-11-23

All nine questions accepted as the planner recommended:
- **Q1**: Schema approved (`private.gift_marks`, `open_recipient_list`, `set_gift_mark`, `detach_wishlist`, changed `get_my_recipient`, `attach_wishlist`, `use_exchange_ideas`, 210 allowlist).
- **Q2**: Updated badge compares against the previous open and stamps on load. A reload or second tab clears it. A list attached after the last open shows no badges.
- **Q3**: Hidden on this device: show "Hidden on this device" with Show (to /reveal), load nothing.
- **Q4**: Revealed card on the exchange page only, client-loaded, dismissible with key `recipient:<assignment id>`, not shown while hidden. No revealed card on the Exchanges rows.
- **Q5**: List and marks allowed in `event_passed`, refused once complete or cancelled.
- **Q6**: Taken-off note also covers marked items on a list the recipient removed.
- **Q7**: Remove wishlist… for personal wishlists only; ideas are removed item by item.
- **Q8**: Item 119 is its own task, not this slice.
- **Q9**: Exchange page after the draw with no list: Your part row only, no card.

### Board decisions — 2026-11-23

Boards read from the live canvas by an agent: see docs/tasks/slice-11-boards.md (21 conflicts and gaps). Not yet compared by eye.

**Owner decided (4 conflicts):**
- **B1 (conflict 1)**: the revealed card is NOT dismissible (board `dismiss="false"`). This overrides Q4's "dismissible". The Add-your-wishlist and unrevealed cards keep their Dismiss.
- **B2 (conflict 2)**: list and item sheet hint is the board wording, "Only you can see what you mark. {first} never will." The Reveal page keeps "Only you can see this. {first} never will." GC-015 is rewritten to match.
- **B3 (conflict 5)**: the `/recipient` loading state has a neutral heading (no name) with skeleton rows; the name appears after the Server Action returns. Neutral line goes in copy-pending.
- **B4 (conflict 6)**: the hidden row's Show goes to `/reveal` (privacy check), as Q3 said.

**Main session decided, to be flagged to the owner at review (follow the board, note the gap):**
- Budget note follows the board's range form ("Within the ₦15,000 to ₦25,000 budget"); Over and Under wording has no board, goes to copy-pending (conflict 3).
- "Over budget" is a trailing badge on the row per the board; GC-015 is rewritten (conflict 4).
- One badge slot per row. Priority when more than one applies: You got this, then Over budget, then Updated (conflict 9). Copy-pending note.
- No-list body follows the board ("{organiser first} can send a reminder. Until then, the budget is your best guide."). Nudges are built (slice 8), so this promises nothing unbuilt (conflict 7).
- Taken-off note keeps the board text for a removed item; the whole-list-removed case (Q6) needs its own wording, copy-pending. It gets an Unmark control (design gap, conflict 8).
- Gaps with no board (ideas after the draw, kept list, attach toast, no-price row, hidden `/recipient`, revealed with no list, item sheet dismissal, offline sheet, load-error string) use the story or plan strings where they exist and go to copy-pending where they do not (conflicts 13 to 16, 20, 21).
- The count row excludes taken-off items (conflict 18). Reveal Most wanted rows link to the item sheet (conflict 19).
