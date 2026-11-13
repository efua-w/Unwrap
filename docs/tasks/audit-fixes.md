# audit-fixes — the first seven findings of the 2026-11-13 codebase audit

Branch `fix-audit-1-7` (from `slice-4-date-picker`). Done in the main session at the owner's request ("Fix the first 7 issues"), not through planner → builder → tester → reviewer.

## Main session — round 1 — 2026-11-13
- Task: audit-fixes — fix audit findings 1 to 7, nothing else
- Requirements: GC-003, GC-004, GC-005, GC-006, GC-008, GC-013, GC-019, GC-021, GC-029, GCO-001, GCO-004. Owner answers 2026-11-13: keep the Activity tab (branded not-found until slice 6); rate limits 10 exchanges / 30 wishlists / 300 items per person per hour; drift check as a script, no token in CI.
- Files/components:
  - 1 Ledger drift: dev ledger row for `20261109152915_gift_day_date_only` recorded (the schema was already live: owner applied it by hand, see gift-day-date-only.md). `scripts/check-migrations.ts`, `npm run db:drift`, `tests/unit/check-migrations.test.ts`, CLAUDE.md migration convention.
  - 2 Exchanges counts: `features/exchanges/queries.ts` embeds each exchange's active members in the one list query instead of a separate read of every membership row (see round 2 for why not `count`).
  - 3 Profile setup routing: migration `20261113105735_onboarded_at.sql` (+ pgTAP 150); `lib/auth/session.ts` sends anyone without `onboarded_at` to /welcome; `app/(app)/welcome/page.tsx` opts out; the browser heuristic is gone from `lib/auth/verify-state.ts`, `features/auth/{actions,email-code,VerifyForm}`; unit and e2e tests updated (`createTestUser` marks confirmed users onboarded).
  - 4 Not-found and error pages: `app/not-found.tsx`, `app/(app)/error.tsx`, `components/layout/StatusPage.tsx`. Copy in docs/copy-pending.md. Closes open item 34.
  - 5 Rate limits: migration `20261113105806_rate_limits.sql` (+ pgTAP 160): `private.rate_limits`, `hit_rate_limit`, `enforce_rate_limit`, insert triggers on wishlists and items, one added line in `create_exchange`.
  - 6 Exchanges view: migration `20261113105718_exchanges_visible.sql` (+ pgTAP 140); `features/exchanges/queries.ts` reads it with `select *`.
  - 7 OTP expiry: `supabase/config.toml` `otp_expiry = 600`. Hosted value is the owner's to check (open item 71).
- Work completed:
  - Migrations applied to dev `ulziqspdjtjszvdcwdek` with `apply_migration` (recorded), files renamed to the recorded versions; `npm run db:drift -- --strict` passes (9 files, 9 recorded). Red before apply confirmed (view, column and table absent).
  - pgTAP on dev, each run rolled back: 140 9/9, 150 9/9, 160 12/12; regressions 010 4/4, 015 6/6, 020 11/11, 030 7/7, 040 5/5, 060 22/22, 100 56/56, 130 97/97. Not run on dev: 090 (name collision with leftover dev data, open item 72); 050, 070, 080, 110, 120 (untouched by these changes). CI runs all on a fresh database.
  - Types regenerated from dev through the connector (open item 74).
  - typecheck, lint, tokens:check pass; unit 211/211; `next build` and `secrets:check` pass. E2E: see round 2.
- Outstanding issues: open items 71 to 74. Nothing committed.
- Next action: owner checks the hosted OTP expiry, approves the two copy rows, and asks to commit.

## Main session — round 2 — 2026-11-13
- Task: audit-fixes — end-to-end check
- Requirements: as round 1
- Files/components: `features/exchanges/queries.ts`
- Work completed: full e2e against the running dev server (port 3000): 294 passed, 9 skipped (opt-in specs), 9 failed, all on the Exchanges list. Cause: `exchange_members(count)` makes PostgREST run count(*), which needs a table-wide grant; exchange_members has column grants only (42501, reproduced with a throwaway user). The view itself worked. Fixed by embedding `exchange_members(user_id, taking_part)` per exchange (bounded by the 100-person limit) and counting the embedded rows. Re-run of exchanges-signed-in.spec.ts: 18/18 at 390, 768 and 1440. Typecheck and lint pass.
- Outstanding issues: open items 71 to 74.
- Next action: commit to `fix-audit-1-7` (owner asked, 2026-11-13); owner checks the hosted OTP expiry and approves the two copy rows.
