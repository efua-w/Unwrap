# slice-10-actioncard-banner — ActionCard banner width and Dismiss

Task ID: slice-10-actioncard-banner
Stories: GC-006 action card, GC-013 (after the draw), GC-014 (reveal prompt). No story wording changes.
Origin: owner request 2026-11-23, a mid-slice change to slice 10 (own note, own change, not part of PR #25's commits).
Request: "The banners are 1040px wide on the boards, for desktop, but 640px wide in the app. Fix the width to match. Also include the close icon at the far right and required functionality wherever necessary."

---

## Builder — round 1 — 2026-11-23
- Task: slice-10-actioncard-banner — banner at the board width (1040 at 1440) and a Dismiss that is remembered per device
- Requirements: GC-006, GC-013, GC-014 action card; owner request above. CLAUDE.md: design tokens only, shared-place fixes, no new table/column/route/dependency, no data the caller may not see in localStorage
- Files/components:
  - `components/ui/ActionCard.tsx` (new `dismiss` slot, banner only; stale "WHY no dismiss" comment replaced)
  - `features/draw/card-dismiss.ts` (new: keys, device flag, subscribe, reset)
  - `features/draw/components/CardDismiss.tsx` (new, client: `CardGate`, `CardDismissButton`, `CardReset`)
  - `features/draw/components/DismissibleActionCard.tsx` (new, server: ActionCard + gate + button)
  - `features/draw/copy.ts` (`dismissCard: "Dismiss"`); `docs/copy-pending.md` (row, Awaiting approval)
  - `features/exchanges/components/ExchangeMemberView.tsx`, `features/exchanges/components/ExchangeDrawn.tsx`, `app/(app)/exchanges/page.tsx` (banner moved out of the 640 column; keys)
  - `tests/unit/card-dismiss.test.ts` (new), `tests/e2e/draw-reveal-signed-in.spec.ts`, `tests/e2e/exchanges-signed-in.spec.ts`
  - `docs/progress.md` (item 120)
- Work completed: see Decisions. Verified results are in the handoff message that accompanied this log entry (typecheck, lint, tokens:check, Vitest; Playwright run recorded below).
- Outstanding issues: copy row "Dismiss" awaits owner approval; the drawn-state ("Names are drawn for X") card is not click-tested (needs a real draw); board visual comparison of the banner not done by eye
- Next action: tester retests the three pages at 390/768/1440 signed in; main session commits as its own commit after PR #25 CI settles

### Decisions
- Width cause: all three pages wrap their content in `md:max-w-reading-max` (640) and the banner was a child of that column. The content area is exactly 1040 at 1440 (1440 - 280 sidebar - 80 left - 40 right padding) and AppShell already caps it at `max-w-content-max` (65rem = 1040, an existing token; no new token). Fix: the banner now sits outside the 640 column, in a full-width parent, and the rest of each page sits in its own 640 column. The banner is left-aligned with the page below it (same left edge) and extends right. At 768 the content area is about 408 wide, so the banner fills it; below 768 the tray is unchanged and is inside the column as before.
- Tray: no close. The owner spoke of the banner only and no mobile board shows one. The tray still honours a dismissal made at desktop width (same key), so a device that dismissed it shows neither.
- Storage: `unwrap:card-dismissed:<kind>:<id>` = "1". Kinds: `wishlist` (exchange id, Add your wishlist), `reveal` (assignment id, "Names are drawn for X", used by both the exchange page and Exchanges so one Dismiss hides it on both). Only ids the caller already sees are keyed; no name, pair or address is stored.
- States: server render and hydration give "pending", which renders the card `invisible` (holds its space, out of the focus order), then the device answer shows or removes it. A storage failure shows the card; a failed write hides it for the page session only.
- Never stuck hidden: `CardReset` clears the flag where the condition is gone (wishlist attached; assignment revealed, on both pages). A new assignment has a new id, so it is a new card.
- Reveal path stays: dismissing removes only the card. The exchange page still shows the Who-you're-buying-for row (`RecipientRow`, links to /reveal) and Activity still links Names drawn to /reveal (read in `features/activity/group.ts`).
- Known limit: on Exchanges the server picks the first unrevealed exchange for the card, so after a Dismiss the next exchange's card does not appear until that choice changes (it cannot be made on the server without the device flag).
