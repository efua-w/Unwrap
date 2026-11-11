# gift-day-date-only

Change raised mid-slice 4 (own note, own commit). Branch: `slice-4-exchanges`.

## Owner decisions — 2026-11-09 (Tobechukwu Olih)

1. Gift time is removed from the exchange creation flow and everywhere else. The gift day is a date only. Approved: change the approved schema (`exchanges.event_at` timestamp → a date), with a new migration (the `exchanges` migration is already applied to dev and must not be edited) and updated security, unit and e2e tests.
2. The gift day is set in the organiser's time zone. It counts as passed at the **end** of that day in the organiser's time zone. Dates and times are displayed in each viewer's own time zone.
3. The organiser's own list for an exchange (S49, boards Org-List-*, Exchange-Detail-oattached / -oideas) is its own route.
4. Docs (user stories, implementation plan, copy-pending) are rewritten to match.

## Design evidence (canvases read 2026-11-09)

- Org-Budget-default / -filled / -error, Org-Edit-default / -afterdraw: one "Gift day" date field ("Sat 12 Dec 2026"); no gift time. "Draw time" (6:00 pm, helper "Joining closes at this time on the join-by day.") stays.
- Org-Review: "Gifts exchanged Sat 12 Dec". Org-Budget-filled summary: "…We draw names that evening at 6:00 pm. Gifts are exchanged on Sat 12 Dec. Times are in your time zone (WAT)."
- Every Dates block: "Gifts exchanged {Thu 24 Dec}", no time. Email-Inventory: "The gift day is a date only, with no time." E24 sends "9:00 am the day before the gift day, in each person's time zone."
- Leftover on the canvas: board "Inventory: Exchange, reveal and gifting" still reads "Gifts are exchanged on {date} at {time}." Treated as stale; screen boards win.

## Known code touch points (from the canvas/docs audit)

`features/exchanges/copy.ts:31`, migration `supabase/migrations/20261109104934_exchanges.sql:257-261`, security test `supabase/tests/security/130_exchanges.sql` (233-238, 385, 397), `tests/unit/exchanges.test.ts:172,181`, `tests/e2e/exchanges-signed-in.spec.ts:62,154,176,186,239`, `app/dev/components/page.dev.tsx:91`.

## Planner — round 1 — 2026-11-09
- Task: gift-day-date-only — gift day becomes a date only across slice 4
- Requirements: owner decisions 1–4 above; GCO-002, GCO-003, GCO-004, GC-008, GC-013; AC-1…AC-16
- Files/components: new migration `<ts>_gift_day_date_only.sql`; `supabase/tests/security/130_exchanges.sql`; `lib/validation/exchange.ts`; `features/exchanges/{copy,summary,timeline,types,queries,actions}.ts`; `StartExchangeFlow.tsx`, `ExchangeJustStarted.tsx`; `app/dev/components/page.dev.tsx`; unit + e2e exchanges tests; regenerated `database.types.ts`
- Work completed: plan written (column `gift_date date`, 10-arg `create_exchange(p_gift_date…)`, `exchange_state` passes at `(gift_date + 1) at time zone organiser_tz`, CHECK `join_by_at <= gift_date start in organiser_tz`, backfill from organiser-local day, re-grant column to authenticated only; pgTAP edited first, access assertions unchanged, new UTC+14 end-of-day tests)
- Outstanding issues: Q1 (join-by day strictly before gift day in both modes?) and Q2 (date shown as stored to every viewer?) to owner
- Next action: owner answers Q1/Q2 → main session runs read-only pre-flight on dev → builder steps 1–2 → owner-approved apply → builder steps 5–11 → tester

## Owner answers — 2026-11-09 (Tobechukwu Olih)
- Q1: (a) the join-by **day** must be strictly before the gift day, in both draw modes.
- Q2: everyone sees the stored date as set (no conversion); only the end-of-day cutoff uses `organiser_tz`.
- Naming (main session): column **`gift_day`** (matches docs/implementation-plan.md §5), RPC argument `p_gift_day`, TypeScript `giftDay`. Use these instead of the planner's `gift_date` / `p_gift_date` / `giftDate`.

## Builder — round 1 — 2026-11-10
- Task: gift-day-date-only — gift day becomes a date only across slice 4 (code and tests; migration NOT applied)
- Requirements: owner decisions 1–4 and answers Q1 (a) / Q2; GCO-002, GCO-003, GCO-004, GC-008, GC-013
- Files/components: new `supabase/migrations/20261109152915_gift_day_date_only.sql`; `supabase/tests/security/130_exchanges.sql`; `lib/validation/exchange.ts`; `features/exchanges/{actions,queries,types,copy,summary,timeline}.ts`; `features/exchanges/components/{StartExchangeFlow,ExchangeJustStarted}.tsx`; `app/dev/components/page.dev.tsx`; `tests/unit/exchanges.test.ts`; `tests/e2e/exchanges-signed-in.spec.ts`; `lib/supabase/database.types.ts` (hand edit); `docs/copy-pending.md`, `docs/progress.md` (item 65)
- Work completed: pgTAP 130 extended first (plan 80 -> 97); migration adds gift_day (backfilled from organiser-local day), CHECK join_by_at <= gift_day start in organiser_tz, drops/recreates 10-arg create_exchange (revoke/grant), exchange_state passes at (gift_day+1) in organiser_tz, drops event_at, grants select(gift_day) to authenticated only. App: validation, action (p_gift_day), queries (giftDay), form without Gift time, review row, summaries with exact board strings, timeline "Sat 12 Dec.", zone line from joinByAt, gallery, unit and e2e specs updated. Checks: typecheck, lint, tokens:check pass; npm test 195/195; build pass. pgTAP and e2e NOT run (migration not applied; dev server port in use). Leftover-name grep clean outside the old migration, docs/, the new migration (backfill/drop of event_at) and the pgTAP hasnt_column assertion.
- Outstanding issues: apply migration then run 130 (and the rest of db:test) on dev; replace hand-edited database.types.ts with generated (progress item 65); run e2e; assumption unverified: CHECK using `timestamp at time zone <column>` is accepted by Postgres (STABLE, not immutable) — if apply errors, report, do not switch to a trigger silently; manual-draw summary sentence added to copy-pending as derived copy.
- Next action: owner approves apply -> main session applies, regenerates types, runs pgTAP -> tester (incl. e2e) -> reviewer

## Main session — apply and security tests — 2026-11-10
- Task: gift-day-date-only — migration applied to dev and security tests run
- Requirements: owner decisions 1–2, Q1/Q2 answers; AC-3…AC-9
- Files/components: `supabase/migrations/20261109152915_gift_day_date_only.sql`; `lib/supabase/database.types.ts`
- Work completed: before apply, dev had no `gift_day` and no 10-arg `create_exchange` (verified, so 130 was red). Owner applied the migration to `ulziqspdjtjszvdcwdek` themselves. Verified after: `gift_day` date NOT NULL, no null rows, `event_at` gone, one `create_exchange` (10-arg), `exchanges_join_before_gift_day` present. pgTAP on dev: 130 97/97, 010 4/4, 030 7/7, 040 5/5 (finish() returned no failures; no errors). Types regenerated from dev and written unchanged; typecheck and lint pass. Open item 65 closed.
- Outstanding issues: e2e not yet run (owner's `next dev` on :3000 blocks Playwright's server); signed-in click-through not done
- Next action: tester verifies AC-1…AC-16

## Tester — round 1 — 2026-11-10
- Task: gift-day-date-only — verify AC-1…AC-16
- Requirements: owner decisions 1–4, Q1(a)/Q2; GCO-002/003/004, GC-008, GC-013
- Files/components: builder-handoff file list
- Work completed: typecheck, lint, tokens:check, unit 195/195, build all pass; leftover-name grep clean (only the expected `hasnt_column('event_at')` in pgTAP 130). Copy, validation, migration, grants and timeline verified by code and unit tests. No defects found.
- Outstanding issues: verdict FAIL only because `npm run e2e` could not run (owner's `next dev` on :3000 blocks Playwright's server); browser checks at 390/768/1440 and signed-in click-through not done; manual-draw summary copy awaits owner approval
- Next action: owner stops `next dev`, main session runs e2e → tester round 2 if anything fails; reviewer in parallel

## Reviewer — round 1 — 2026-11-10
- Task: gift-day-date-only
- Requirements: owner decisions 1–4, Q1(a)/Q2
- Files/components: migration, pgTAP 130, validation, exchanges feature files, docs
- Work completed: APPROVED (conditional on e2e). No Critical/High. Medium R1-1 (docs did not record Q2: same date for every viewer), R1-2 (docs did not say "both draw modes"). Low R1-3 timeline comment placement, R1-4 indent in StartExchangeFlow, R1-5 WHY for zone at join-by, R1-6 CHECK depends on tzdata/organiser_tz (future zone edits must re-check).
- Outstanding issues: e2e and signed-in click-through
- Next action: main session fixes R1-1…R1-5; e2e once the owner's dev server is stopped

## Main session — review fixes — 2026-11-10
- R1-1/R1-2: `docs/implementation-plan.md` §5 gift-day bullet and the user-stories "Gift day (2026-11-09)" decision row and GCO-002 note now say the same date shows to every viewer and the join-by day is before the gift day in both draw modes.
- R1-3: timeline WHY comment moved above the step (kept the `?? ""` fallback: `formatYmdDay` returns `string | null`). R1-4: indent fixed. R1-5: WHY added in `ExchangeJustStarted.tsx`. R1-6: noted as residual risk for slice 13 (editing).
- typecheck, lint, unit 195/195 pass.

## Tester — round 2 — 2026-11-11
- Task: gift-day-date-only — e2e run and failure diagnosis
- Requirements: owner decisions; Q1/Q2
- Files/components: tests/e2e/exchanges-signed-in.spec.ts, tests/e2e/auth-entry.spec.ts
- Work completed: full `npm run e2e`: 300 passed, 9 failed, 9 skipped. (A) exchanges spec x3 widths: stale assertion `Choose a time.` at line 147 (the gift time no longer exists). (B) auth-entry x6: flaky (passed on re-run; failures move between widths; dev-server compile/hydration timing), unrelated to this change.
- Outstanding issues: auth-entry flake (open item)
- Next action: main session fixes (A)

## Main session — e2e fix — 2026-11-11
- Replaced the stale `Choose a time.` assertion with `Choose a date.` count 2 (Join by and Gift day empty; Draw time has a default). `npx playwright test tests/e2e/exchanges-signed-in.spec.ts`: 18/18 pass at 390, 768, 1440 (axe included).
- Manual-draw summary line approved by the owner 2026-11-11 (copy-pending.md).
- Remaining: owner signed-in click-through (one exchange per draw mode); commit.
