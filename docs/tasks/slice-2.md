# slice-2 — Wishlists core, manual entry

## Brief — main session — 2026-11-05
- Task: slice-2 — wishlists and items, manual entry (no link import, no photos)
- Requirements: GC-018–GC-021 (implementation-plan.md §10 row 2); designs S19–S22, S24; tables `wishlists` (with `kind`), `wishlist_items`
- Files/components: none yet. Branch `slice-2-wishlists`, cut from `slice-1-auth` (commit 358c040, not yet pushed: GitHub is refusing every ref update on `efua-w/Unwrap`).
- Work completed:
  - Slice 1 is reviewed (reviewer APPROVED), its security tests pass 97/97 and the owner's human checks are done. Only its GitHub CI run is pending, blocked by GitHub.
  - Building on top of slice 1 is a stacked branch; if slice 1's CI later shows a problem, fix it on `slice-1-auth` and rebase this branch.
- Outstanding issues:
  - The design canvas is readable through the Artifact tool. The main session will download S19–S22 and S24 for the builder.
  - Open item 30: `user_settings.default wishlist visibility` belongs to slice 3, not here.
  - Never-do 8: no destructive cascade when deleting a wish list.
  - Never-do 9: manual entry is the primary path.
  - Money is stored as an integer in kobo, NGN.
  - The asymmetric visibility rule: an owner never reads reservations on their own list.
- Next action: planner.

## Planner — round 1 — 2026-11-05
- Task: slice-2 — wishlists core, manual entry
- Requirements: GC-018–GC-021; plan §3–§8, §10 row 2; AC-1–AC-28
- Files/components (planned):
  - database: migration `<ts>_wishlists.sql`; tests `090_wishlists.sql`, `100_wishlist_items.sql`
  - lib: `lib/money/naira.ts`, `lib/validation/wishlist.ts`, `lib/dates/format-updated.ts`
  - components: `components/ui/{RadioGroup,MoneyField,ListRow,EmptyState}`; `features/wishlists/{types,queries,actions,components/*}`
  - routes: `app/(app)/wishlists/{page,loading}`, `[id]/{page,loading}`
  - tests: unit tests; `tests/e2e/wishlists-signed-in.spec.ts`; playwright `SIGNED_IN` regex
- Work completed: plan drafted.
  - Migration:
    - enums `wishlist_kind`, `wishlist_visibility (private|link)`, `wishlist_item_priority`
    - `wishlists` (owner → profiles, no cascade; `share_token` trigger-filled; `deleted_at`; ideas-never-link check)
    - `wishlist_items` (kobo `bigint`, whole naira, ≤ ₦1bn; http(s) link check; note 280; name 120; `photo_path` no grant)
    - column grants; no DELETE grant; owner-only RLS hiding deleted rows
    - definer RPCs `delete_wishlist`, `restore_wishlist`, `remove_wishlist_item`, `restore_wishlist_item`, `has_deleted_wishlists` (P0002 for not-yours/not-found)
    - triggers `updated_at` / `touch_parent`
- Status: NEEDS CLARIFICATION (Q1–Q12)
- Outstanding issues:
  - Q1: toast quotes conflict (curly double vs straight single).
  - Q2: the empty-list prompt promises link import.
  - Q3: the Share button (slice 3).
  - Q4: unsourced copy.
  - Q5: Private row label and the "updated" date format.
  - Q6: the delete body for a Private list.
  - Q7: ₦0 and the priority default.
  - Q8: the private/gone board (S47?).
  - Q9: the link field is stored only.
  - Q10: `share_token` and `photo_path` now.
  - Q11: sheet copy inside the UwSheet/UwModal components (fetch from the canvas).
  - Q12: Home's wishlists section later.
- Next action: main session fetches the Q8/Q11 design data; owner answers.

## Design copy read from the canvas — main session — 2026-11-05
- Task: slice-2 — planner Q8/Q11 (sheet copy inside the UwSheet/UwModal components)
- Requirements: S19–S22, S24
- Files/components: canvas `project/UwSheet.dc.html`, `project/UwModal.dc.html` and the Wishlist boards (read-only)
- Work completed (verified by a read-only helper; strings exact):
  - **S20 sheet:**
    - titles: "New wishlist" / "Edit list"
    - field "List name": placeholder "For example, Birthday or New flat", helper "People see this when you share it.", counter /60
    - error "Give your list a name so people know what it's for."
    - group "Who can see it": "Private" ("Only you, and your giver in any exchange you add it to.") / "Anyone with the link" ("Anyone you send the link to can see it. They don't need an account."), Private preselected
    - buttons: "Create list" / "Save", "Cancel"; edit only: "Delete this list…"
  - **S22 sheet:**
    - titles: "Add an item" / "Edit item"
    - fields:
      - "Link (optional)" (placeholder "Paste a link from any shop")
      - "What is it?" (placeholder "For example, a scented candle", /120)
      - "Price" (₦ prefix, placeholder 0, helper "Whole naira only, like 8500.")
      - "How much do you want it?" (segmented "Most wanted" / "Nice to have")
      - "Note for your giver" (placeholder "Size, colour, anything that helps", /280)
      - "Add a photo" (slice 17)
    - errors: name "Add a name so your giver knows what it is."; price "Use whole naira, with no kobo. For example, 8500."
    - buttons: "Add to list" / "Save", "Cancel"; no remove button
  - **S24 delete:** title "Delete “{name}”?"; body "It isn't in any exchange, so nothing else changes. Anyone with the link will see that it's gone."; buttons "Delete list" / "Keep list"; offline note "You're offline. You can delete this list once you're back online."
  - **Toasts:** "Deleted “…”." + Undo; "Added “…”." + Add another; "Saved “…”."; "Removed “…”." + Undo.
  - **Private/gone state:** no board on this canvas (S25 "This wishlist isn't available" is the public shared view, slice 3).

## Owner answers — main session — 2026-11-05
- Task: slice-2 — resolution of planner Q1–Q12 and the copy
- Requirements: planner round 1
- Files/components: none
- Work completed (owner, Tobechukwu Olih):
  - Q1: owner said "don't use curly braces for toasts". Main-session reading: **no curly quotes**. Toasts use the stories' straight quotes, e.g. `Added 'Ankara tote bag'.`, `Deleted 'Birthday list'.`, `Removed '…'.`, `Saved '…'.`. GC-018's "curly double quotes" note gets a dated rewrite. Apply the same to the delete title (`Delete 'Birthday list'?`).
  - Q2: drop "Add a link and we'll fill in the name and price." until slice 17.
  - Q3: Share button hidden until slice 3.
  - Q5: Private rows say "Only you"; dates "today", "yesterday", "N days ago" (≤ 6), then "Wed 9 Sep" (+ year if not this year).
  - Q6: a Private list's delete body is only "It isn't in any exchange, so nothing else changes."
  - Q7: minimum price ₦1. Priority required, **"Nice to have" preselected** (owner overrides the board's "Most wanted").
  - Q9: the link is stored only (`https://` added), never fetched. **The Link field has no helper** in slice 2 (the board's "We fill in the name and price…" promises link import).
  - Q10: create `share_token` and `photo_path` now.
  - Q12: Home's "Your wishlists" section is a later slice (open item).
- Approved new copy (into copy-pending as approved):
  - price over the limit: "That's over ₦1,000,000,000. Enter a smaller amount."
  - bad link: "Check the link. It should start with https://"
  - list load error: "We couldn't load this list." + "Something went wrong on our side. Nothing you've added is lost."
  - bin name "Remove {item}"; singular "1 item"
  - **The board copy wins over the proposals:** name error "Add a name so your giver knows what it is."; price error "Use whole naira, with no kobo. For example, 8500."
- Main-session decisions (recommendations taken):
  - Q8: the not-found/private/deleted detail uses EmptyState with the GC-018 copy ("This wishlist is private" / "Only its owner, and their giver in an exchange, can see it." / "Go to your wishlists").
  - Q11: answered by the canvas read above; "Create list" and "Keep list" are canvas labels (the progress item 1 approval covers them).
  - "Add a photo" is omitted until slice 17.
- Outstanding issues: none blocking.
- Next action: builder.

## Builder — round 1 — 2026-11-05
- Task: slice-2 — wishlists core, manual entry
- Requirements: GC-018–GC-021; AC-1–AC-28 as changed by the owner answers
- Files/components:
  - database: migration `20261105013747_wishlists.sql`; tests 090 (46) and 100 (54)
  - temporary type shim `lib/supabase/app-database.ts`
  - lib: `lib/money/naira.ts`, `lib/validation/{text,wishlist}.ts`, `lib/dates/format-updated.ts`
  - components: `components/ui/{RadioGroup,MoneyField,ListRow,EmptyState}`; `features/wishlists/*`
  - routes: `app/(app)/wishlists/page.tsx` and `[id]/page.tsx` (Suspense, not loading.tsx)
  - tests: unit and e2e; fixtures; playwright `SIGNED_IN` regex
  - docs: stories, copy-pending, progress (open items 39–43)
- Work completed (builder-reported): typecheck, lint, tokens, Vitest 143/143, build and secrets:check pass. Gallery + visual e2e pass. The wishlist spec skips until the migration is applied.
- Decisions:
  - delete/restore don't move `updated_at`; item changes touch the parent list
  - `share_token` gets a default as well as the trigger; pgcrypto `create if not exists`
  - stricter update policy (personal only) and note (not blank); price optional (≥ ₦1 if given)
  - `en-US` short month names ("Sep")
- Outstanding issues:
  - Migration not applied; 090/100 never run; no signed-in click-through; no screen-vs-board comparison.
  - Copy awaiting approval (3 rows, incl. the empty-list body "the new space").
- Main session note: a stray file `cls` (git branch output, created 01:31, not from this workflow) was staged; it is now unstaged and left on disk untouched.
- Next action: owner approves the apply; main session applies, runs 010–100, regenerates types, removes the shim; tester; reviewer.

## Main session — apply and security tests — 2026-11-08
- Task: slice-2 — apply the migration and run the security tests (owner approved)
- Requirements: AC-1–AC-4, AC-7, AC-26, AC-27
- Files/components: `supabase/migrations/20261105024047_wishlists.sql` (renamed from 20261105013747 to match the hosted version), tests 090/100, `lib/supabase/database.types.ts`, `lib/supabase/server.ts`
- Work completed (verified, through the connector on `ulziqspdjtjszvdcwdek`):
  - Before applying: `to_regclass('public.wishlists')`, `wishlist_items` and `delete_wishlist(uuid)` all null (the tests would fail).
  - Migration applied as `wishlists` (version 20261105024047); statements identical to the file.
  - First full run (rolled back): 010 4/4, 015 6/6, 020 11/11, 030 6/6, 040 5/5, 050 6/6, 060 22/22, 070 20/20, 080 17/17, 090 44/46, 100 52/54.
    - The 4 failures were test-expression bugs: `format('%s', boolean)` renders `t`, but the expected text said `true`. The values were correct.
    - Fixed by casting those booleans `::text` in 090 (tests 8, 44) and 100 (tests 5, 47). The expected strings are unchanged, so the tests prove the same thing.
  - Re-run: **090 46/46, 100 54/54.** Total 197/197.
  - Leftover check: 0 fixture users, 0 wishlists, pgtap not installed.
  - Dev users: 5 personas, the owner, and one leftover e2e throwaway (`del…@resend.dev`, 2026-11-04 15:30 UTC) from slice 1 runs, left untouched.
  - Types regenerated through the connector (wishlists, wishlist_items, 5 RPCs, 3 enums). Temporary shim `lib/supabase/app-database.ts` deleted; `server.ts` uses `Database`. typecheck and lint pass.
- Outstanding issues: CI types-drift may need the CLI output (as before); signed-in wishlist e2e not yet run.
- Next action: tester + reviewer.

## Reviewer — round 1 — 2026-11-08
- Task: slice-2 — review
- Requirements: GC-018–GC-021; plan §5/§6; CLAUDE.md
- Files/components: whole slice diff vs `slice-1-auth`
- Work completed (reviewer-run):
  - typecheck, lint, tokens and Vitest 143/143.
  - **Security: no defects:** RLS + column grants, no DELETE, P0002 RPCs, no side paths, no marks in types, integer kobo.
  - The `::text` fix in 090/100 is sound (rendering only; Never-do 10 not violated).
- Verdict: APPROVED (no Critical/High)
- Findings:
  - R1-1 Med: focus is lost after removing an item; move focus to the next/previous row or "Add an item".
  - R1-2 Med: the first-time body "Your giver will know exactly… until you share it…" has no recorded source and promises sharing (slice 3).
  - R1-3 Med: the rollback toast "we put it back" is inaccurate for the bin failure and the undo-delete failure; `signed-out` should redirect to login.
  - R1-4 Low: remove/restore of an item moves the list to the top (trigger on all updates); document, and assert in 100.
  - R1-5 Low: test gaps (ideas-list item update; `has_deleted` ignores ideas; share_token overwrite on a privileged insert).
  - R1-6 Low: story banners credit builder decisions to the owner.
  - R1-7 Low: GC-020 still has a curly-quote line.
  - R1-8 Low: progress slice 2 row stale.
  - R1-9 Low: `maxLength` counts UTF-16 units vs code points (an existing Field behaviour).
  - R1-10 Low (suspicion): focus return after "Delete this list…" → "Keep list".
  - R1-11 Low: slice-1 log content staged on this branch; the `cls` file must not be committed.
- Outstanding issues: tester verdict; signed-in click-through (owner); approval of the copy rows.
- Next action: tester verdict, then builder round 2 for R1-1–R1-11 + tester findings.

## Owner answers (review) — main session — 2026-11-08
- Task: slice-2 — copy decisions after reviewer round 1
- Requirements: R1-2, R1-3; copy-pending rows 23–25
- Files/components: none
- Work completed (owner, Tobechukwu Olih):
  - (a) "Something went wrong on our side." inside the wishlist sheets: approved.
  - (b) The empty-list tip, reworded: "Things that tend to land well: a gadget you've had your eye on, or a voucher for a place you love."
  - (c) The first-time body (board Wishlist-List-first) is approved as written, including "until you share it" (nothing is live before slice 3). R1-2 is resolved: it is board copy.
  - R1-3: when a bin remove or an undo-delete fails, show "Couldn't save your change." + Retry. The full GC-020 line stays only where something really is put back.
- Next action: builder round 2.

## Tester — round 1 — 2026-11-08
- Task: slice-2 — verify
- Requirements: GC-018–GC-021; AC-1–AC-28 as changed by the owner
- Files/components: wishlists feature, routes, new components, lib, e2e spec
- Work completed (tester-run): typecheck, lint, tokens, Vitest 143/143, build and secrets:check pass.
  - Targeted e2e ×2: 66 passed, 3 failed (identical). The private-state test passed against the real dev DB at 3 widths, with no names in the HTML.
  - Copy, security and money read: correct (straight quotes, Nice to have, no helper/Share/photo, explicit columns, no user id, integer kobo).
- Verdict: FAIL
- Outstanding issues:
  - T1-1 High: the "New wishlist" sheet never opens under `next dev` (StrictMode). The caller remounts the Sheet with a new key and `open=true`; the StrictMode cleanup calls `dialog.close()`, and the async `close` event lands after the re-`showModal()`, so `handleClose` calls `onClose`. WishlistDetail's Edit, Delete and Item sheets use the same pattern. Fix in the shared Sheet (root cause) and every caller.
  - Blocked by T1-1: browser checks of create/add/edit/remove/undo/delete, and the screenshot comparison.
- Main session note: the slice-1 log entries now live on `slice-1-auth` (commit 13645e5); the working copy of `docs/tasks/slice-1.md` here was restored to this branch's base.
- Next action: builder round 2 (T1-1 + reviewer R1-1–R1-11 + owner copy).

## Builder — round 2 — 2026-11-08
- Task: slice-2 — T1-1 + reviewer R1-1–R1-11 + owner copy
- Requirements: tester round 1, reviewer round 1, owner answers (review)
- Files/components:
  - components: `components/ui/{Sheet,ListRow}.tsx`, WishlistDetail, `copy.ts`, wishlists page
  - gallery fixture `MountedOpenSheetDemo`
  - tests: gallery and wishlist e2e asserts; 090 (`plan` 48), 100 (`plan` 56)
  - docs: copy-pending, stories, progress
- Work completed (builder-reported):
  - T1-1: Sheet ignores a stale `close` event when the dialog is open again; scroll-lock is removed only when no modal is open.
  - R1-1 focus after remove; R1-3 short failure line + signed-out redirect; R1-4 comment + assert; R1-5 three cases; R1-6/7/8 docs; R1-10 verified + asserted; owner (a)(b)(c) applied.
  - Checks: typecheck, lint, tokens, Vitest 143/143, secrets:check and build pass. Targeted e2e ×2: 72/72 (real dev DB). auth-entry at 390: 53/53.
- Outstanding issues: 090/100 new assertions not run (expect 48/56; total 201).
- Next action: main session runs 090/100; rebase onto main; tester round 2.

## Main session — 090/100 re-run and rebase — 2026-11-08
- Task: slice-2 — run the round-2 security tests; move onto merged main
- Requirements: R1-4, R1-5; AC-27
- Files/components: tests 090/100; working tree moved onto `origin/main` (34cb42b)
- Work completed (verified):
  - 090 **48/48**, 100 **56/56** on the dev project (rolled back). With 010–080 unchanged from earlier today, the total is **201/201**.
  - Leftover check: 0 fixture users, 0 wishlists, pgtap not installed.
  - Slice 1 merged (PR #4, 26c8130); progress marked slice 1 Done on main (34cb42b).
  - The slice 2 working changes were re-applied on top of `origin/main`. Conflicts:
    - progress.md: kept slice 1 "Done" from main and slice 2's row
    - `database.types.ts`: kept slice 2's version
  - typecheck passes. `cls` left untracked.
  - Owner asked to restart the server: `npm run dev` is now running on port 3000 (nothing was running before).
- Next action: tester round 2 + reviewer round 2.

## Reviewer — round 2 — 2026-11-08
- Task: slice-2 — re-review after builder round 2, re-run and rebase
- Requirements: R1-1–R1-11, T1-1, owner copy
- Files/components: Sheet, ListRow, wishlist components, copy, actions, tests 090/100, docs, types
- Work completed (reviewer-run): typecheck, lint, tokens and Vitest 143/143.
  - The Sheet fix is correct: no stuck dialog or scroll lock; slice-1 behaviours intact.
  - The new pgTAP cases are non-vacuous. The `saveFailed` usage and signed-out redirects are correct. R1-1–R1-10 resolved; the rebase merged correctly.
- Verdict: APPROVED
- Findings:
  - R2-1 Low: progress row stale.
  - R2-2 Med: the types file will fail CI drift; take CI output.
  - R2-3 Low: focus after quick double removals.
  - R2-4 Low: confirm the migration file matches the applied text.
  - R2-5 Low: R1-9 not logged.
  - R2-6 Low: don't commit `cls`.

## Main session — review round 2 follow-ups — 2026-11-08
- Task: slice-2 — R2-1, R2-4, R2-5, R2-3/R2-2 logging
- Requirements: reviewer round 2
- Files/components: `docs/progress.md`
- Work completed (verified):
  - R2-4: md5 of the migration file's non-comment, non-blank lines equals the same fingerprint of the hosted `schema_migrations.statements` for version 20261105024047 (`2455128ee4c99137236a28cf17bc96d6`).
  - R2-1: slice 2 progress row updated.
  - R2-5/R2-3/R2-2: logged as open items.
  - R2-6: `cls` stays untracked.
- Next action: tester round 2 verdict; then the owner approves the commit and PR.

## Tester — round 2 — 2026-11-08
- Task: slice-2 — retest T1-1, R1 findings, owner copy
- Requirements: tester round 1, reviewer round 1, owner answers
- Files/components: wishlists feature, Sheet, ListRow, copy, e2e specs
- Work completed (tester-run):
  - typecheck, lint, tokens, Vitest 143/143, secrets:check and build pass.
  - e2e run 1: **72/72** (T1-1 fixed: gallery sheet test + the full wishlist flow at 3 widths).
  - e2e run 2: 64/72; auth-entry at 390: 41/48. All failures were navigation timeouts against the owner's long-lived dev server on port 3000, which degraded (~2.7 s per request, ~85% CPU, "Jest worker encountered 2 child process exceptions").
  - Copy (b) and the `saveFailed`/rollback split verified; copy-pending approvals present.
- Verdict: FAIL (no code defect found; checks not reliably green)
- Main session note: the dev-server degradation coincided with `npm run build` running beside it and with the main session editing `next.config.ts` (fix-auth-mobile-submit), which makes `next dev` restart itself. A fresh server is needed; stopping the old one (PID 8140) was refused by the permission classifier, so the owner must stop it.
- Next action: owner restarts the dev server; short tester retest, or CI as the e2e judge.

## Main session — commit for CI — 2026-11-08
- Task: slice-2 — owner chose GitHub CI as the e2e judge (as for slice 1)
- Requirements: CLAUDE.md Git; owner decision 2026-11-08
- Files/components: all slice 2 files. Excluded: the separate fix-auth-mobile-submit change (AuthFrame, next.config.ts, .env.example, its task log; awaiting the owner's phone check) and the stray `cls`.
- Work completed: `method="post"` added to `WishlistSheet` and `ItemSheet` forms (same privacy reason as fix-auth-mobile-submit); typecheck, lint and Vitest pass.
- Next action: commit, push, open PR into main, read CI (types-drift fix expected).
