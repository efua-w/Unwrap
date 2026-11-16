# my-list-boards — participant list page to the new My-List boards, and drop "(organising)"

Mid-slice change requested by the owner on 2026-11-15. It's logged separately from slice 6 and gets its own commit.

## Owner decisions (2026-11-16, Tobechukwu Olih)
- The "(organising)" suffix no longer shows anywhere. The boards drop it, and the owner said it "should not show". This supersedes copy-pending line 58, approved on 2026-11-14.
- After attaching, switching or adding an item, the person stays on the list page and sees a toast with Undo, as the boards show. This applies to both the participant and the organiser list pages, and supersedes the GCO-004 "S49 update" of 2026-11-09 (navigate back with a toast).
- Names stay in single quotes (decision Q9), even though the boards use curly double quotes.

## Main session handoff — round 0 — 2026-11-16 (board spec, from a board refresh)
- Task: my-list-boards — build the in-app participant "Your list for this exchange" page from the new `My-List-*` boards, and remove "(organising)"
- Requirements: GC-009/GCO-004 S49; the owner decisions above
- Boards (refreshed 2026-11-16): `C:\Users\P\AppData\Local\Temp\claude\9216d52471611509\192197f4-557d-4210-a98c-c7d84c1587c8\scratchpad\artifact-files\47637980-257d-40d0-bf53-d053d5129ee7\project\My-List-*-{m,d}.dc.html` (52 boards, "S49 Your list for this exchange · participant"). Each is the matching `Org-List-*` board with participant data. Part 1 `Joining-Attach-*` (the from-Join page, `?from=join`) is unchanged, so leave that path as it is.
- Files: `features/exchange-list/components/YourListPage.tsx`, `copy.ts`, `IdeasList.tsx`, `app/(app)/exchanges/[id]/list/page.tsx`, `features/exchanges/people.ts`, `features/joining/copy.ts` and its tests

### Spec (in-app participant page; where the organiser page differs from its board in the same way, fix it too)

**Header**
1. Remove the "You've joined" card on the in-app page.
2. The h1 is "Your list for this exchange".
3. Under the h1: a 24px tag, a 12px gap, then the name in `text-body-base-semibold text-text-secondary`.
4. The heading size gap (30 / 36px) has no exact token. Use the nearest heading token, as the organiser page does today.

**Layout**
5. Mobile: 32px gap between blocks. The action bar is pinned above the tab bar (padding 12px 20px 16px, white, column, 8px gap, full width). Pin it on every in-app screen, not only `toJoined`.
6. Desktop: content column about 520px, using an existing token. Buttons sit in one wrapping row (gap 8px 16px, auto width) on every screen, for both modes.
7. The back label is "Go back".

**Copy and sections**
8. Choose: the participant intro uses "Everyone spends {range}", as the organiser does, not "Gifts here cost".
9. Current (attached):
   - Intro: "Your giver will see it after the draw. You can change it until then."
   - h2 "Attached wishlist" (`text-body-lg-semibold`), with the row "{list} / {n} items · updated {day}".
   - This replaces the 16px "Your list for this exchange" h2 and the `currentIntro`.
10. Ideas:
   - Intro: "Your giver will see these after the draw. You can change them until then." This is participant only.
   - h2 "Your list for this exchange ({n})" in `text-body-lg-semibold`, then "Only for this exchange" in muted 14px.
   - Rows "₦8,500 · Most wanted" with a bin.
   - Below the list, a link button "Choose a wishlist instead" that opens the picker.

**Buttons**
11. No wishlists: primary "Add items instead" first, then secondary "Choose a wishlist" disabled.
12. Current: secondary "Choose a different wishlist", then a text button "Add items instead" that always shows.
13. Every page button is disabled when offline, while the picker is open, or while busy.

**States**
14. Only one wishlist:
   - "Choose a different wishlist" is disabled.
   - A muted row above the privacy alert: "This is your only wishlist, so there's nothing to switch to yet." with a link button "Go to Wishlists" to /wishlists.
15. Picker opened from ideas: the sheet note "Choosing a wishlist takes your items off this exchange. We'll keep them, so Add items instead brings them back."
16. Item sheet when a wishlist is attached:
   - Note: "Adding items takes '{list}' off this exchange. The wishlist itself won't change, and you can attach it again until the draw."
   - The empty-state item sheet has no note. Drop the current always-on `itemSheetNote` where the boards don't show it.
17. Toasts stay on the page (owner decision):
   - emptyattached: "Wishlist attached. Your giver will see it after the draw."
   - switched: "Switched to '{list}'." with Undo.
   - added: "Added '{item}'. '{list}' is no longer attached." with Undo.
   - reattached: "Attached '{list}'. We've kept your items for later." with Undo.
   - emptyadded: "Added '{item}'." with Undo.
   - Placement: mobile above the action bar; desktop bottom-left, 400px wide.
18. Switch error: an error alert before the privacy alert: "We couldn't switch to '{list}'. '{old}' is still attached, so you can try again." No button.
19. Offline: an inline offline alert as the first block, "You're offline. Pages you've opened stay on screen.", with all buttons disabled.

**"(organising)"**
20. Remove the "(organising)" suffix:
   - `features/exchanges/people.ts:14-23` (`peopleSentence`, `peopleStackLabel`)
   - `features/joining/copy.ts:48-54`
   - the tests at `tests/unit/exchange-people.test.ts:13-20`, `tests/unit/invite-join.test.ts:284-286` and `tests/e2e/invite-join-signed-in.spec.ts:319,436`. These follow the copy change; their meaning stays.
   - The boards: "Ngozi Eze, Femi Adeyemi, … and you."; the organiser sees "You, Ifeoma Nwosu, … and Obinna Obi."; Join: "5 people are in: …" with no suffix.

**Copy**
21. Copy that is not word for word from a board goes in `docs/copy-pending.md`. Board copy is approved; record it as "Approved (board)".

## Builder — round 1 — 2026-11-16
- Task: my-list-boards — in-app participant list page to the My-List-* boards, "(organising)" removed
- Requirements: spec items 1–21; owner decisions of 2026-11-16
- Files/components: features/exchange-list/{copy.ts, components/YourListPage.tsx, IdeasList.tsx, WishlistPickerSheet.tsx, ListContent.tsx}, app/(app)/exchanges/[id]/{list,my-list}/page.tsx, components/ui/{Toast.tsx, ExchangeTag.tsx}, features/exchanges/people.ts, features/joining/copy.ts, docs/copy-pending.md, tests (unit: exchange-list, exchange-people, invite-join; e2e: invite-join-signed-in)
- Work completed: one page for participant and organiser (the from-Join page keeps its own header, copy, Skip and navigation). New header, "Attached wishlist" and ideas sections, button rules, only-one-wishlist row, picker note, item-sheet note, switch error, and on-page toasts with Undo (attach/detach/restore actions only; no new action, table or migration). "(organising)" removed. Typecheck, lint, tokens:check, 323 unit tests and build pass. e2e on :3000, one worker, per width: invite-join 11/11 at 390, 768 and 1440; wishlists 2/2 and activity 2/2 at all widths; exchanges 7/7 at 390 and 1440, and 6/7 at 768 (the "outsider and signed-out visitor" test failed once, passed alone on rerun).
- Outstanding issues: spec 19 (inline offline alert) not added, because the shell's OfflineBanner already shows that exact text as the first block on every in-app page. Board toast offset above the action bar assumes a two-button bar (120 token). Desktop toast left edge = sidebar max + 80, so about 40px right of the content edge at 768.
- Next action: tester.

## Owner decisions — 2026-11-16 (Tobechukwu Olih)
- Item 19: no inline offline alert on the list page. The shell's OfflineBanner shows the same message, so it's accepted as built.
- Copy approved: "Your item is back. / Your {n} items are back. '{list}' is no longer attached." (Undo), and reuse of "Couldn't save your change, so we put it back." for a failed Undo.

## Tester — round 1 — 2026-11-16
- Verdict: FAIL (no Critical or High defect).
- Checks: typecheck, lint, tokens, unit 323/323 pass. E2E invite-join, exchanges, wishlists and approval pass at all three widths. One exchanges test at 1440 failed once and passed when rerun alone.
- T1-1 (Medium): the mobile action bar isn't pinned when the content is short. AppShell's inner container isn't a flex column; fix it there.
- T1-2 (Medium): a retry of a failed "Added…" Undo re-runs the remove, gets not-found and never re-attaches. Retry only the attach.
- Item 19: decided by the owner (no inline alert).
- Next action: builder fixes T1-1 and T1-2; tester retests.

## Builder — round 2 — 2026-11-16
- Task: my-list-boards — fix tester findings T1-1 and T1-2
- Requirements: spec items 5, 17; T1-1, T1-2
- Files/components: components/layout/AppShell.tsx, features/exchange-list/components/YourListPage.tsx
- Work completed:
  - T1-1: AppShell's content column, `main` and inner container are now flex columns that fill the height, so `mt-auto` pins the bar on short pages. The from-Join frame (InviteFrame) was already a flex column and is unchanged. Side effect found by e2e and fixed: `mt-auto` also pushed the desktop buttons to the page bottom, where the toast covered them, so the bar now has `md:mt-0`. 390px screenshots before and after for Exchanges, Wishlists and Activity are byte-identical; the exchange page differs only in the random invite token text; only the list page changed (bar now at the bottom).
  - T1-2: the "Added…" Undo remembers that the remove succeeded (`removedItem`), so a retry only attaches.
  - Checks: typecheck, lint, tokens:check pass; npm test 323/323; build not run (as instructed). e2e (:3000, one worker): invite-join 11/11 at 390 and 11/11 at 768 (after the md:mt-0 fix); exchanges 7/7 at 768. At 390 exchanges is 6/7.
- Outstanding issues: exchanges "discard: Close…" fails at 390 every time since the dev server restart: the Next.js dev-tools badge (round "N", top-right at 390) sits over the Start-flow Close button and intercepts the click (confirmed by screenshot and Playwright's "nextjs-portal intercepts pointer events"). It passed earlier in this task before the restart, the page does not use AppShell, and none of my files are on it. It looks like an environment change (dev indicator), not this change, but I did not prove that by reverting. The T1-2 retry path has no automated test.
- Next action: tester retests T1-1 and T1-2.

## Builder — round 2 — fixed T1-1 (AppShell flex column, md:mt-0) and T1-2 (Undo retry skips the done remove). See the builder report.

## Tester — round 2 — 2026-11-16
- Verdict: PASS. T1-1 fixed (screenshots at 390, 768 and 1440); T1-2 fixed (code read); no AppShell regressions seen. 59/60 e2e; the 60th was the dev badge over Close at 390. The main session hid nextjs-portal in openFlow, and the test now passes 3/3.

## Reviewer — round 1 — 2026-11-16
- Verdict: CHANGES REQUIRED. R1-1 (High): only-one-wishlist disabled switching on a kept list (GC-030).
- Main session fix: `onlyOneList` now requires `attachedList !== null` (YourListPage.tsx). No test covers the kept-list case yet.
- Low, logged as open items: R1-2 (cancelling after a server "invalid" leaves the wishlist detached), R1-3 (toast offset below about 1400px / with three buttons), R1-4 (stale Undo closure after two changes), R1-5 (no test for the Undo retry).

## Builder — round 3 — 2026-11-16
- Task: my-list-boards — cover R1-1 with a test, log R1-2..R1-5
- Work completed: new e2e in tests/e2e/invite-join-signed-in.spec.ts ("kept list with exactly one wishlist"): a soft-deleted attached list plus one live wishlist leaves "Choose a different wishlist" enabled and no only-one row; passes at 390, 768 and 1440. Open items 93–96 added to docs/progress.md for R1-2..R1-5.
- Checks: typecheck, lint, npm test run (see below); build not run.
- Next action: tester/reviewer re-check.

## Reviewer — round 2 — 2026-11-16
- Verdict: APPROVED. R1-1 fixed and proven by the new e2e. R2-1 (Low): no assertion yet for the live-list only-one case.
- Main session: npm run build passes; dev server restarted.
