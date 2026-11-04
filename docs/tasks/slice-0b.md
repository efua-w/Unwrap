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
