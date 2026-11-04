# fix-0a-followups — progress items 11, 12, 22, 24

## Brief — main session — 2026-11-04
- Task: fix-0a-followups — owner asked to fix 11 (Firefox textarea auto-grow) and 12 (toast inert under a modal Sheet), correct the migration comment (22), and set the key name (24)
- Requirements: docs/progress.md open items 11, 12, 22, 24
- Files/components: Field, Toast, Sheet, top-layer; `supabase/migrations/20261104080111_harden_defaults.sql` (comment only); `.env.example`
- Work completed (main session):
  - 22: header comment corrected; no statements changed. Owner-approved exception to "never edit an applied migration".
  - 24: `.env.example` uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; URL and key are in the gitignored `.env.local`.
- Outstanding issues: none
- Next action: builder for 11 and 12.

## Builder — round 1 — 2026-11-04
- Task: fix-0a-followups — items 11 and 12
- Requirements: progress items 11, 12
- Files/components: `components/ui/{Field,TextareaAutoGrow(new),textarea-fit(new),Toast,Sheet,top-layer}`, `app/dev/components/Interactive.tsx`, `tests/e2e/gallery.spec.ts`, `tests/unit/helpers.test.ts`, progress.md rows 11/12
- Work completed (builder-reported):
  - 11: client-only fallback, used only when `field-sizing` is unsupported; the pure fit function is unit-tested.
  - 12: a toast shown while a modal is open is held and presented on modal close, with the full duration starting then; the popover re-show code was removed.
  - Checks: typecheck, lint, tokens:check, test (63/63), build and e2e (73 passed, 2 skipped) all pass.
- Outstanding issues: item 11 not checked in a real Firefox; the Sheet unmount-cleanup path is untested; 2 skipped offline tests are unexplained.
- Next action: tester + reviewer.

## Reviewer — round 1 — 2026-11-04
- Task: fix-0a-followups — review items 11, 12, 22, 24
- Requirements: progress items 11, 12, 22, 24
- Files/components: Toast, Sheet, top-layer, Field, TextareaAutoGrow, textarea-fit, e2e/unit tests, migration (comment), .env.example
- Work completed: typecheck and the helpers unit tests re-run (pass). Item 12 flow verified by reading: nested sheets, busy re-open, newest-wins, never lost or shown twice. Item 11 is SSR-safe and inert where `field-sizing` is supported. 22 is comment-only (accepted under the owner exception). 24: no key value tracked or staged.
- Verdict: APPROVED
- Findings (all Low):
  - R1-1: `dialog:modal` throws in Safari < 15.6, so every toast would crash there. Use try/catch, or `dialog[open]`.
  - R1-2: the toast popover comment gives the wrong reason; rewrite it, or drop the popover.
  - R1-3: the textarea fallback doesn't re-measure on a programmatic `value` change or a width change.
  - R1-4: e2e lacks the Sheet unmount-while-open case, nested sheets, the full 8s from close, newest-wins, and a forced-fallback test for 11.
  - R1-5: a toast already showing when a Sheet opens still times out under it (pre-existing).
- Next action: tester verdict; R1-1 to R1-3 are cheap to fix now; log R1-4 and R1-5.

## Tester — round 1 — 2026-11-04
- Task: fix-0a-followups — verify items 11, 12, 22, 24
- Requirements: progress items 11, 12, 22, 24
- Files/components: as builder round 1
- Work completed (tester-run): typecheck, lint, tokens:check, test (63/63), build and e2e (73 passed, 2 skipped, 0 failed) all pass.
  - The 2 skips are intentional: `test.skip` for projects other than 1440 in the offline-banner-vs-Sidebar test, with a reason; the file is unchanged from main.
  - The item 12 e2e test ran in isolation 3/3.
  - Items 11, 12, 22 and 24 verified by reading; `.env.local` is ignored and untracked.
- Verdict: PASS
- Outstanding issues: Firefox not checked in a real browser; the unmount-cleanup and newest-wins paths have no tests.
- Next action: builder fixes reviewer R1-1–R1-3; log R1-4/R1-5.

## Builder — round 2 — 2026-11-04
- Task: fix-0a-followups — reviewer R1-1–R1-3; log R1-4/R1-5
- Requirements: reviewer round 1
- Files/components: top-layer.ts, Toast.tsx (comment), TextareaAutoGrow.tsx, Field.tsx, progress.md items 25/26
- Work completed (builder-reported):
  - R1-1: `:modal` in try/catch with a `dialog[open]` fallback.
  - R1-2: comment rewritten.
  - R1-3: re-fit on a controlled value change and on a width change (`ResizeObserver`).
  - Items 25 and 26 logged.
  - Checks: typecheck, lint, tokens, test (63/63), build and e2e (73 passed, 2 skipped) all pass.
- Outstanding issues: Firefox and old Safari not run for real.
- Next action: tester narrow retest.

## Tester — round 2 — 2026-11-04
- Task: fix-0a-followups — retest R1-1–R1-3
- Requirements: reviewer round 1
- Files/components: top-layer, Toast, TextareaAutoGrow, textarea-fit, Field, progress.md
- Work completed (tester-run): typecheck, lint, tokens, test (63/63), build and e2e (73 passed, 2 skipped as before) pass. R1-1/R1-3 correct by reading (no resize loop; inert where supported; Field still a Server Component). Items 25/26 present. `.env.local` untracked.
- Verdict: PASS. The reviewer had already APPROVED round 1; round 2 only applied its Low suggestions.
- Outstanding issues: items 25, 26 (Low).
- Next action: owner approves commit + PR.
