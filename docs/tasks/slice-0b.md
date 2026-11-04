# slice-0b — Database and test harness

## Brief — main session — 2026-11-04
- Task: slice-0b — local Supabase, `private` schema, default `EXECUTE` revoked, migration conventions, pgTAP, seeded users per role, CI security tests
- Requirements: implementation-plan.md slice 0b row, §5–§8; CLAUDE.md "Database changes", "Database rules", "Core security rule", "Set up early" 1–3
- Files/components: none yet. Branch `slice-0b-database`, cut from `slice-0a-foundation` (0a committed as 9e7b459, not merged).
- Work completed:
  - Slice 0a committed with known risks: e2e flaky (T7-1), round 8 unverified, CI never run (progress.md item 16).
  - Playwright + axe at 3 widths already exist from slice 0a. Slice 0b extends them with seeded users rather than re-adding them.
- Outstanding issues:
  - An untracked `supabase/migrations/` folder (16 files, 10–27 Oct) appeared in the working tree on 2026-11-03 and was gone again on 2026-11-04. It was not created by this workflow and is not in any commit. Don't assume any existing schema.
  - The Supabase MCP connector is now available. Per CLAUDE.md, local development comes first; no remote project is to be touched without owner approval.
- Next action: planner produces the slice 0b plan.

## Planner — round 1 — 2026-11-04
- Task: slice-0b — Database and test harness
- Requirements: plan §5–§10 (0b row); CLAUDE.md database and security sections
- Files/components (planned):
  - `supabase/config.toml`, `supabase/migrations/<ts>_harden_defaults.sql`, `supabase/tests/security/{000_helpers,010_rls_every_table,020_private_no_access,030_function_allowlist,040_definer_search_path}`
  - `supabase/seed.sql`, `lib/supabase/database.types.ts`, `.env.example`
  - `package.json` db scripts, `ci.yml` security job, `.gitignore`, `.gitattributes` (`*.sql eol=lf`), CLAUDE.md commands
- Work completed:
  - Plan drafted (12 steps, AC-1–AC-17). Each catalogue test carries a rolled-back self-check fixture, so no test passes just because there's nothing to check.
  - Hardening migration: `private` schema, revoke `EXECUTE`/default privileges, including Supabase's schema-scoped default ACLs.
- Status: NEEDS CLARIFICATION
- Outstanding issues:
  - Q1 (blocking): source conflict.
    - progress.md has a 2026-11-03 decision (attributed to the owner, written outside this session, and swept into commit 9e7b459 unnoticed): adopt the remote project `esdfsgyxyhqfajwezgzv` and its 16 migrations as the 0b baseline. Open items 16 (first) and 17–19 describe that schema.
    - The plan says 0b creates no product tables, and the slice-0b brief says to assume no schema.
  - Q2: Docker Desktop + Supabase CLI (npm dev dependency recommended).
  - Q3: seeded users = local auth personas + SQL act-as helper; the Playwright signed-in fixture moves to slice 1.
  - Q4: fix T7-1 first as its own commit?
  - Q5: hosted project involvement (recommended none).
  - Q6: CI security job on `ubuntu-latest` via the first PR.
  - Q7: add a `search_path=''` definer test.
  - Duplicate open item 16 in progress.md.
  - R8: the 0b branch includes unmerged 0a.
- Next action: owner answers Q1–Q7.

## Owner answers — main session — 2026-11-04
- Task: slice-0b — resolution of planner Q1–Q7
- Requirements: planner round 1
- Files/components: progress.md decisions and open items
- Work completed (owner, Tobechukwu Olih):
  - Q1: clean start (a). The 2026-11-03 remote-baseline decision is struck through as superseded; open items 16 (first) superseded, 17–19 deferred; the duplicate item 16 renumbered to 20.
  - Q2: Docker ready; Supabase CLI as a pinned npm dev dependency (approved). Main-session check: the Docker CLI is present but the daemon was not running at 2026-11-04 (owner to start Docker Desktop).
  - Q3: as proposed (main session took the recommendation): local auth personas in `seed.sql` plus a SQL act-as helper; the Playwright signed-in fixture moves to slice 1.
  - Q4: fix T7-1 first, as its own commit, with two clean full e2e runs.
  - Q5: local only; no hosted project touched.
  - Q6: CI security job; first run on the PR (owner to approve the push).
  - Q7: add the definer `search_path` test (recommendation taken).
  - R8: the PR base is decided at PR time.
- Outstanding issues: Docker daemon not running.
- Next action: builder — step 2 (T7-1, own commit), then steps 4–12.

## Owner answers (round 2) — main session — 2026-11-04
- Task: slice-0b — no local Docker; use a hosted Supabase project
- Requirements: supersedes owner answer Q5 ("local only") and the Docker-based local stack in the planner's steps 3–4
- Files/components: none yet
- Work completed:
  - Owner (Tobechukwu Olih): work with the Supabase dashboard instead of Docker. Slice 0b uses the hosted project `ulziqspdjtjszvdcwdek` ("Unwrap").
  - Main-session check (read-only): the Supabase connector in this session points at the old project `esdfsgyxyhqfajwezgzv` (16 old migrations; data in 13 tables including `public.assignments`). Nothing was written to it.
  - Inspecting the connector config was refused by the permission classifier (the file may hold credentials). The owner must re-point the connector.
- Outstanding issues:
  - Connector must point at `ulziqspdjtjszvdcwdek`; confirm the project is empty before any migration.
  - Every migration applied to the hosted project needs owner approval (CLAUDE.md global rules).
  - Security tests run on the hosted project inside rolled-back transactions. CI can still run a throwaway local stack on GitHub's runners, which have Docker.
  - Builder part A (T7-1) is unfinished: `tests/e2e/shell.spec.ts` is modified and unverified.
- Next action: owner re-points the connector; main session confirms the project is empty; then builder.

## Owner answers (round 3) — main session — 2026-11-04
- Task: slice-0b — proceed
- Requirements: owner answers rounds 1–2
- Files/components: tests/e2e/shell.spec.ts (stashed)
- Work completed:
  - Owner: skip the T7-1 flaky-test fix for now. The builder's partial, unverified change to `tests/e2e/shell.spec.ts` is kept in git stash "T7-1 partial", not committed. T7-1 stays open (progress.md item 20).
  - Owner says the connector is now on `ulziqspdjtjszvdcwdek`. Main-session check (verified): this session's connector still returns `esdfsgyxyhqfajwezgzv` (old migrations and data). The connection reloads only when the session restarts. No writes were made.
- Outstanding issues: no database writes or test runs until the connector returns `ulziqspdjtjszvdcwdek` and it's confirmed empty.
- Next action: builder writes the slice 0b repo files (no database access); the main session applies and tests via the connector with owner approval after a restart.

## Builder — round 1 — 2026-11-04
- Task: slice-0b part B — harness repo files (no database access)
- Requirements: plan §5–§10; owner answers rounds 1–3
- Files/components:
  - Supabase: `supabase/config.toml` (no `private` in the API schemas), `supabase/migrations/20261104080111_harden_defaults (renamed from 20261104074520 to match the hosted version).sql`, `supabase/seed.sql` (5 personas `a0000000-0000-4000-8000-00000000000{1..5}`), `supabase/tests/security/{010,020,030,040,050}_*.sql`, `supabase/.gitignore`
  - Config: package.json (`supabase` 3.0.0 pinned; `db:migration:new`, `db:types`, `db:test`), lockfile, .gitignore, .gitattributes, `.env.example`, ci.yml (`security` job)
  - Docs: CLAUDE.md (Stack and commands), progress.md
- Work completed (builder-reported): typecheck, lint, tokens:check, test (60) and build pass. The SQL has not been run. Tests use `pg_temp` helpers and act-as via `SET LOCAL ROLE` + jwt claims, with self-check fixtures in every file.
- Outstanding issues:
  - Nothing verified against a database.
  - Test 020 item 6 may fail if hosted global default ACLs grant table privileges (needs a follow-up migration, not a weakened test).
  - Test 050 needs `seed.sql`: either persist it in the dev project (owner approval) or paste it into the test transaction.
  - CI types drift may differ in format from connector output.
- Run order: (0) optional pre-migration run: 030 tests 2–3 should fail; (1) migration; (2) 010; (3) 020; (4) 030; (5) 040; (6) 050; (7) generate types via the connector.
- Next action: session restart; main session confirms `ulziqspdjtjszvdcwdek` is empty; owner approves the apply.

## Main session — apply and security tests — 2026-11-04
- Task: slice-0b — apply the migration and run the security tests on the hosted dev project (owner approved)
- Requirements: AC-1–AC-12; CLAUDE.md "Database changes", "Who runs what"
- Files/components: `supabase/migrations/20261104080111_harden_defaults.sql`, `supabase/tests/security/*`, `lib/supabase/database.types.ts`
- Work completed (verified, run by the main session through the Supabase connector):
  - Connector confirmed on `ulziqspdjtjszvdcwdek`. Before applying: no tables, no migrations. pgtap available but not installed.
  - How the tests were run:
    - The SQL tool returns only one result, so each test file was run verbatim except that (a) each top-level `select` was prefixed `insert into tap_out(line)` to capture the TAP lines, and (b) the final `finish(); rollback;` was replaced by `finish()` captured, then a `raise exception` carrying the TAP output. The exception aborts the transaction, so everything rolls back.
    - No assertion, fixture or setup was changed. The runner copies are in the session scratchpad and are not committed.
  - Pre-migration 030: `1..6`, ok 1, **not ok 2, not ok 3** (new public functions executable by anon/authenticated), ok 4–6, "# Looks like you failed 2 tests of 6". This proves the test catches open defaults.
  - Migration applied through `apply_migration` as `harden_defaults`. The hosted history records version `20261104080111`, so the repo file was renamed to match. Only header comments were omitted in the applied text; the statements are identical.
  - After the migration:
    - 010: 4/4 ok
    - 020: 7/7 ok, including default privileges, the builder's flagged risk
    - 030: 6/6 ok
    - 040: 5/5 ok
    - 050: 6/6 ok. Per the owner, the `seed.sql` body was pasted inside the test transaction, so the personas existed only during the test.
  - Leftover check after all runs:
    - 0 `@example.test` users
    - pgtap not installed
    - 0 `zz_selfcheck` tables or functions
    - `private` schema exists
    - anon and authenticated have no USAGE on `private`
  - Types: `lib/supabase/database.types.ts` generated through the connector (empty public schema), not hand-edited.
  - typecheck, lint and tokens:check pass.
- Outstanding issues:
  - The CI `security` job (local stack on the GitHub runner) has never run.
  - CI types drift: the connector output may differ in format from `supabase gen types --local`.
  - The applied migration text omits the file's comments.
- Next action: tester and reviewer.

## Tester — round 1 — 2026-11-04
- Task: slice-0b — verify the harness
- Requirements: plan slice 0b; AC-1–AC-17 (judged by theme)
- Files/components: config.toml, the migration, seed.sql, tests 010–050, ci.yml, package.json, .env.example, database.types.ts, CLAUDE.md
- Work completed (tester-run): typecheck, lint, tokens:check, test (60) and build pass; ci.yml parses (js-yaml), no secrets, 20-minute timeout, `check` job unchanged. All tests read and judged non-vacuous (self-checks, 42501 refusal, effective privileges). No secrets tracked. Types match the empty schema. DB results rest on the main session's recorded run.
- Verdict: PASS
- Outstanding issues:
  - T1-1 (Low): CI types drift may fail on format differences (connector vs CLI output).
  - T1-2 (Low): 010 and 040 don't emit a `diag` listing excluded extension objects, as 030 does.
  - T1-3 (Low): the applied migration omits comments (recorded).
  - CI never run; e2e deferred.
- Next action: reviewer verdict.

## Reviewer — round 1 — 2026-11-04
- Task: slice-0b — review the harness
- Requirements: plan §5–§8; CLAUDE.md security and database rules
- Files/components: migration, tests 010–050, seed, config, package.json, ci.yml, .env.example, types, CLAUDE.md, progress.md
- Work completed: read everything. The migration is correct and adds no weakness. The tap_out/raise capture doesn't change what the tests prove. The pre-run of 030 shows the tests ran as `postgres`. Renaming the file before commit is acceptable.
- Verdict: CHANGES REQUIRED
- Findings:
  - R1-1 High — 020 proves invariant 1 only on a fixture. Add: real-schema assertions (no USAGE on `private` for anon/authenticated) and a catalogue detector of any anon/authenticated privilege on relations (r,p,v,m,S,f) or functions in `private`, with a self-check.
  - R1-2 High — 010 ignores views and matviews. A `public` view without `security_invoker` over `private` would leak to visitors. Add a detector (views without `security_invoker=true` that anon/authenticated can SELECT; any matview/foreign table they can SELECT), with self-checks.
  - R1-3 Med — CI types drift will likely fail on the first run (connector vs CLI output). Log it; take the CI output as canonical.
  - R1-4 Low — migration header comment says "without FOR ROLE" but the code uses `for role postgres`. Leave the applied file; note it.
  - R1-5 Low — the allowlist is name-only (tighten to signatures in slices 3/5); tests are scoped to public/private (widen if API schemas change).
  - R1-6 Low — progress.md: annotate the superseded 0b decisions, record the T7-1 skip and apply decisions, log the 0b open items.
  - R1-7 Low — the `.env.example` key name (publishable keys) is decided in slice 1.
- Next action: builder fixes R1-1, R1-2 and the R1-5 comment; main session fixes R1-6 and logs R1-3/R1-4/R1-7; re-run 010/015/020 on the dev project; tester + reviewer round 2.

## Builder — round 2 — 2026-11-04
- Task: slice-0b — reviewer round 1 test fixes
- Requirements: R1-1, R1-2, T1-2, R1-5
- Files/components: `supabase/tests/security/{010,015(new),020,030,040}`
- Work completed (builder-reported):
  - 020: plan 7→11. Added no USAGE ×2, a real-schema catalogue detector (r,p,v,m,S,f + functions), and a detector self-check; existing assertions unchanged.
  - New 015: definer-style views and readable matviews/foreign tables, with 4 self-checks.
  - 010/040: `diag` of excluded extension objects. Scope/allowlist comments added.
  - Static checks pass.
- Outstanding issues: none.
- Next action: main session re-runs on the dev project.

## Main session — re-run security tests — 2026-11-04
- Task: slice-0b — re-run the changed tests on `ulziqspdjtjszvdcwdek` (rolled back, same capture method)
- Requirements: R1-1, R1-2
- Files/components: tests 010, 015, 020, 040
- Work completed (verified):
  - 020 first run: setup error `42725 operator is not unique: text || "char"` in the new detector's label. Fix: `c.relkind::text` in `020_private_no_access.sql` line 27 (a label expression only; no assertion changed).
  - Results:
    - 010: 4/4
    - 015: 6/6
    - 020: 11/11
    - 040: 5/5
    - 030 (comments only) and 050 (unchanged): last runs 6/6 and 6/6
  - Total 38/38.
  - Leftover check: 0 personas, pgtap not installed, 0 fixture relations or functions.
- Outstanding issues: CI security job never run (progress item 21).
- Next action: tester + reviewer round 2 (narrow).

## Reviewer — round 2 — 2026-11-04
- Task: slice-0b — narrow re-review of the round 1 fixes
- Requirements: R1-1–R1-7, T1-2
- Files/components: tests 010, 015, 020, 030, 040; progress.md
- Work completed: R1-1 resolved (real-schema USAGE checks plus an effective-privilege catalogue detector; `relkind::text` is label-only). R1-2 resolved (015 detectors with sound positive, negative and discriminating self-checks). T1-2 and R1-5 done; R1-3/4/6/7 logged (items 21–24). No regressions.
- Verdict: APPROVED
- Outstanding issues:
  - R2-1 Low: 020 doesn't check CREATE on `private` (covered by the migration's `revoke all`; optional later).
  - R2-2 Low: 015 accepts only `security_invoker=true|on`; it fails safe otherwise.
  - CI never run (item 21); e2e deferred (item 20).
- Next action: owner approves the commit; open the PR for the first CI run.

## Tester — round 2 — 2026-11-04
- Task: slice-0b — narrow retest of R1-1/R1-2
- Requirements: R1-1, R1-2
- Files/components: tests 015, 020; ci.yml; .env.example
- Work completed (tester-run): typecheck, lint, tokens:check, test (60/60) and build pass. 015 and 020 are self-contained, `plan` counts match, self-checks are real, and `relkind::text` is label-only. Nothing staged; no secrets tracked. 015 sits flat beside the other tests for `supabase test db`.
- Verdict: PASS
- Outstanding issues: whether `supabase test db` finds `supabase/tests/security/*.sql` is unverified until the first CI run; R2-1, R2-2, item 21.
- Next action: owner approves the commit; PR.

## Main session — first CI run — 2026-11-04
- Task: slice-0b — first CI run on PR #2
- Requirements: AC-12, AC-13; progress item 21
- Files/components: `lib/supabase/database.types.ts`
- Work completed (verified with `gh`):
  - PR #2 (`slice-0b-database` → `main`), run 41798164837:
    - `check` passed.
    - `security`: `supabase db start/reset` applied `20261104080111_harden_defaults.sql` and the seed; `supabase test db` gave Files=6, Tests=38, "All tests successful", Result: PASS.
    - The job failed only at the types drift step (formatting differences between connector and CLI output, as predicted in item 21).
  - The CI-generated file was reconstructed by applying the job's `diff -u` output to the committed file, and is now canonical. typecheck, lint and tokens:check pass.
  - PR #1 (`slice-0a-foundation` → `main`) is CLOSED, not merged; its `check` passed. PR #2 targets `main`, so it contains slice 0a as well.
- Outstanding issues: CI re-run needed to confirm green; the owner decides how 0a lands.
- Next action: push and re-check CI.
