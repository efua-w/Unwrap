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
