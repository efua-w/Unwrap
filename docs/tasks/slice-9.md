# Slice 9 — Exclusions and draw engine

Task ID: slice-9
Stories: GCO-009
Designs: Org-Excl-empty, Org-Excl-default, Org-Excl-pairfirst, Org-Excl-pairsecond, Org-Excl-impossible, Org-Excl-saved, Org-Excl-two, Org-Excl-locked (Part 2 canvas)
Plan ref: implementation-plan.md slice 9

---

## Planner — round 1 — 2026-11-22
- Task: slice-9 — Exclusions and draw engine (GCO-009)
- Requirements: GCO-009; GCO-006 (Organiser tools row with pair count); GCO-011 (engine rules); plan §5, §6 inv 2/10/11, §7
- Files/components: see plan §5
- Work completed: read stories, plan, migrations, security tests, exchange/participants code, shared UI
- Outstanding issues: 9 owner questions (§1)
- Next action: main session puts Q1–Q9 to the owner; steps 1–9 (database, engine, tests) can start once Q1b (schema) is answered

### Status: NEEDS CLARIFICATION

### Questions for the owner

**Q1 (a) Email addresses in the pickers — source-document conflict.**
The decisions row (2026-11-16) says the organiser sees addresses "on Participants only". But the Org-Excl-pairfirst and -pairsecond boards list name + email, and progress item 97 says "Exclusions pickers list emails". Should the pickers show addresses?

**Q1 (b) Schema approval.** `public.exclusions` table (exchange_id, first_member_id, second_member_id, created_at), unique on the normalised pair. RLS enabled, no policies — access only through definer functions. Plus `private.compute_matching`, `private.matching_feasible`, `private.draw_people`, `private.exclusion_pairs`; public RPCs `get_exclusions`, `check_exclusions`, `save_exclusions`.

**Q2 Pair follows the membership or the person?** With member ids (plan says "unordered member pair"), a pair disappears when either person leaves and doesn't come back on rejoin. Recommendation: member ids.

**Q3 "Draw impossible" alert gaps.**
(a) Several pairs may each fix the draw. Which does the alert name? Recommendation: the most recently added.
(b) Sometimes no single pair fixes it. Proposed copy: "With these pairs, names can't be drawn fairly. Remove a few pairs, or invite more people. You can still save, and the draw checks again later." — no "Remove that pair" button.

**Q4 "Names need at least 3 people to draw."** Show this whenever fewer than 3 people are taking part. It replaces the feasibility line and impossible alert, and Save still works.

**Q5 Locked states.**
(a) Build the Org-Excl-locked view now, shown when state is `drawn`. Goes live in slice 10.
(b) For `event_passed` and `complete`, show S47 "not available" and hide the Exclusions row in Organiser tools.

**Q6 Organiser tools entry.** Show the section while the exchange is open or joining has closed (not just while open). Exclusions row: "Exclusions" / "{n} pairs" or "1 pair", no subtitle when 0.

**Q7 Picker edge cases.** A person already paired with everyone: leave them out of step 1. Fewer than 2 pairable people: "Add a pair" disabled.

**Q8 Leaving with unsaved pairs.** No discard prompt (build what the designs show). Back throws the draft away.

**Q9 Copy with no board** (to go in copy-pending.md):
- Organiser tools subtitle: "{n} pairs" / "1 pair"
- Bin accessible name: "Remove {A} and {B}"
- Save failed line, check failed (no line), stale list, load error
- Offline: controls disabled, no extra copy
- The Q3(b) line

### Owner answers — 2026-11-22

- **Q1a**: Yes, show emails in the exclusions pickers. Update the decisions row to include "and the Exclusions pickers".
- **Q1b**: Schema approved.
- **Q2**: Member ids (pairs vanish on leave). Accepted.
- **Q3a**: Name the most recently added pair. Accepted.
- **Q3b**: "Remove a few pairs…" copy when no single pair fixes it. Accepted.
- **Q4**: "Names need at least 3 people to draw." replaces feasibility line when < 3. Accepted.
- **Q5a**: Build locked view now (shown when drawn). Accepted.
- **Q5b**: event_passed/complete → S47 not available, hide Exclusions row. Accepted.
- **Q6**: Show Organiser tools while open or joining closed. Accepted.
- **Q7**: Leave fully-paired people out of step 1; disable "Add a pair" when < 2 pairable. Accepted.
- **Q8**: No discard prompt. Accepted.
- **Q9**: Copy approved (see copy-pending.md).

### Approach summary

- **Table**: `public.exclusions` with RLS, no policies, no grants — access only through definer functions (invariant 11)
- **Engine**: `private.compute_matching(people[], forbidden_first[], forbidden_second[], seed)` — randomised greedy + iterative Kuhn augmenting paths. Returns full matching or zero rows. Pure, reads no tables
- **Feasibility**: same engine with a fixed seed
- **Public RPCs**: `get_exclusions`, `check_exclusions` (returns count + feasible + relax pair), `save_exclusions` (diff-save with exchange lock)
- **App**: `/exchanges/[id]/exclusions` — server page reads guard + people + pairs + initial check; client view holds draft, calls check after each change
- **Tests**: pgTAP 280 (security), 290 (engine property), Vitest (draft helpers), Playwright (flow + boards)

### Acceptance criteria
AC-1 through AC-25 (see planner output for full list). Key ones:
- AC-1: 42501 on table access; AC-2: organiser-only reads; AC-4: bidirectional; AC-6: locked after draw; AC-7: infeasible save allowed; AC-10: full matching or zero rows; AC-11: oracle agreement for n≤6; AC-12: edge coverage; AC-13: relax pair

---

## Builder — round 1 — 2026-11-22
- Task: slice-9 — Exclusions migration, engine and security tests (GCO-009)
- Requirements: GCO-009; plan §5, §6 inv 2/10/11
- Files/components: supabase/migrations/20261122110555_exclusions.sql, supabase/tests/security/280_exclusions.sql, supabase/tests/security/290_compute_matching.sql
- Work completed: migration written (table + 8 functions), two pgTAP test files (33 + 17 assertions)
- Outstanding issues: None for database layer
- Next action: main session applies migration, runs tests, then calls builder back for app code (step 7+)

### Status: DATABASE DONE — WAITING FOR APP CODE

---

## Main session — migration applied — 2026-11-22
- Migration applied to dev project `ulziqspdjtjszvdcwdek` via `apply_migration`, version `20261122110555`
- Local file renamed to `20261122110555_exclusions.sql`
- Drift check passed: 21 files, 21 recorded
- Security tests run on dev:
  - **280_exclusions.sql**: 33/33 assertions passed (access control, diff-save, state refusals, pair vanish, no assignment/reservation references)
  - **290_compute_matching.sql**: 17/17 assertions passed (oracle agreement n≤6, valid matchings 7–100, even/odd paths, Hall violation, determinism, variety, bad input, no-retry rule)
- Database types regenerated from dev schema
- Typecheck passes clean
- Next action: call builder for app code (step 7 onward: queries, actions, types, copy, draft helpers, page, components, unit tests, e2e tests)
