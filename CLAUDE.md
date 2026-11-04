# Unwrap

Unwrap is a mobile-first web app for running gift exchanges (draw names, share wishlists, reveal who you're buying for) for Nigeria and West Africa.

Read this file before writing code. Read the relevant story and board (a UI screen design on the design canvases) before implementing anything.


## Stack and commands

- Next.js 16 + App Router + TypeScript
- Supabase: Postgres, Auth (email code only), Storage, `pg_cron`, Edge Functions
- Tailwind CSS v4
- Phosphor icons + Bona Nova (headings) and Plus Jakarta Sans (body)
- Resend
- Vercel
- Playwright (end-to-end), Vitest (unit), pgTAP (database security tests)

Commands (npm, Node 26.13.0 (`.nvmrc`)).

- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck` (tsc), `npm run lint` (eslint), `npm test` (Vitest)
- `npm run tokens:build` regenerates `styles/tokens.css` from `design/variables_tokens.json`; never edit that file by hand
- `npm run tokens:check` fails on hex, `px`, arbitrary values and off-scale utilities in source, and when `styles/tokens.css` is stale
- `npm run e2e` runs the Playwright browser tests (Chromium at 390, 768 and 1440) against `next dev`; first run `npx playwright install chromium`. Port from `E2E_PORT` (default 3100). Full-page screenshots of the galleries go to `test-results/screenshots` (gitignored)
- Dev-only galleries at `/dev/components` and `/dev/shell` (not in production builds)
- `npm run db:migration:new -- <name>` creates a timestamped file in `supabase/migrations` (same as `npx supabase migration new <name>`)
- `npm run db:test` runs the pgTAP security tests in `supabase/tests/security` (`supabase test db`; needs a local database, so CI runs it). Each file is also plain SQL inside `begin; … rollback;`, so it can be run through any SQL tool
- `npm run db:types` generates `lib/supabase/database.types.ts` from a local database (CI). Without Docker, the main session generates it from the hosted dev project through the Supabase connector. Never hand-edit the file
- Migration convention: one file per change; **never edit a migration after it has been applied** (write a new one). The main session applies migrations to the hosted dev project (`ulziqspdjtjszvdcwdek`) only with the owner's approval, then regenerates the types. `supabase/seed.sql` holds fake local/dev personas and never runs on production

## Source of truth

- [docs/user-stories.md](docs/user-stories.md) — User Stories v1.1. Participant stories are `GC-001`–`GC-030`, organiser stories `GCO-001`–`GCO-015`.
- Each story has: Context, In scope (dev tasks), Edge cases, RAIDS, Content. Content lines are exact UI copy. Anything marked "Not in v1" is out of scope.
- The "Decisions since v1.1" and "What changed in v1.1" tables at the top override older wording in individual stories; "Decisions since v1.1" wins if they differ. The approved original is [docs/user-stories.baseline.md](docs/user-stories.baseline.md).
- Plan, routes, data model and slices: [docs/implementation-plan.md](docs/implementation-plan.md). Copy awaiting approval: [docs/copy-pending.md](docs/copy-pending.md).
- Design: claude.ai Design canvas "Unwrap" (https://claude.ai/artifact/VAgJERFNKxRU1Y96njz8Ue?sk=q9YxuXG0vOuZ-ZKOm9Jrgw#page-329696f28c93) and "Unwrap • Part 2" (https://claude.ai/artifact/9pHtZC2Z3ctDbsbghVkCKG?sk=XnHdLWjcPikcBJsn3cJMkA)
- Build log, decisions and open items: [docs/progress.md](docs/progress.md).
- If code conflicts with a source document, follow the document.
- If two source documents conflict, stop and ask. Do not guess.
- Keep one living copy of the user stories, rewritten in place whenever a decision changes a story, and keep the approved original as a baseline.


## Core Rules

- Build mobile-first.
- Reuse existing components.
- Do not introduce dependencies without first checking whether an existing dependency can solve the problem.
- Follow the existing project architecture.
- Do not modify unrelated files.
- Do not rewrite working code unnecessarily.

## Core security rule

**Asymmetric visibility.** A person who owns a thing must not see what other people do with it.

- A wish list owner MUST NOT read reservations on their own list.
- An exchange host MUST NOT read assignment rows, including when the host is also a participant. Every participant, the host included, may read only the single assignment where they are the giver, through a narrow database function.
- A receiver MUST NOT read the identity of the giver.
- Enforce these rules in the database with Row Level Security (RLS). The UI is not access control.
- If a requested change weakens these rules, stop and ask. Do not work around them.


## How to work

### Before coding a slice

1. Read the story, the designs and the existing code. Name the designs you are building from.
2. List the reusable components, the database objects involved and the minimum files to change.
3. Plan, and explain the approach before implementing anything non-trivial.
4. Ask before adding a dependency, table, column, route or third-party service, or altering approved schema.
5. If a screen or state has no design, say so and ask. Copy written without a design goes into one list for the owner to approve, not scattered through the code.

### While coding

1. One vertical slice at a time. Do not start the next slice until the current one is reviewed.
2. Requests that arrive mid-slice are logged as their own change (own note, own commit). Do not fold them silently into the open slice.
3. Reuse existing components, patterns and utilities. Keep changes in scope; do not refactor unrelated code.
4. **Fix root causes in the shared place.** When a bug comes from a shared component or pattern, fix the component and every caller in one change. Do not patch it screen by screen.
5. Remove code that a change makes unreachable in the same slice, or log it as an open item with the reason.
6. Machine-specific values (local IP addresses, ports, URLs) go in local environment files, never in committed config.

### Database changes

1. **Write the security test first.** Write the failing test, then the migration and policy, then make it pass. Table, policy and test land together.
2. Migrations are files in the repo, applied in order. The file on disk is the only version; never edit a migration after it has been applied — write a new one.
3. Before a test is handed over, check that it can actually pass. Known Postgres traps:
   - A table with no grant for a role refuses the read (`insufficient_privilege`). It does not return zero rows. Test for the refusal.
   - STABLE functions used in RLS policies can't see rows written earlier in the same statement. Create a parent and its child in separate statements, as the app does.
4. After a migration is applied, regenerate the database types from the schema. Do not hand-edit them.
5. Never let the app query a column before the migration that adds it is applied. If the database is behind the code, say so before testing.
6. Sensitive read paths expose only the minimum. Prefer a view or function that already excludes hidden or deleted rows over relying on every query to remember a filter.

### Who runs what

If the agent cannot run migrations and security tests itself (no local database), the owner runs them.

- A slice whose security tests have not run is **"Built — waiting on security tests"**, never "done".
- Hand over: the exact files to run, in order, and what a pass looks like.
- If a run fails, fix the code or the test setup. The assertions stay as written. Report the failure and the fix in the build log.

### Git

1. One branch per slice from the main branch: `slice-<n>-<topic>`. One PR per slice.
2. Ask to commit as soon as the slice's checks pass. Do not stack a new slice on uncommitted work.
3. Commit messages include the story IDs. Never commit secrets, keys, `.env` files or local tool config that points at real services.

### After every slice

1. Run the checks in "Definition of done".
2. Update the build log: slice status, a short note of what was built, and new or closed open items.
3. Rewrite the affected user stories in the same change, dated, with who decided.
4. Report: what was built, what was checked and how, what was **not** done, what still needs a signed-in check, and the next steps.

## Code rules

- TypeScript strict. No `any`.
- Server-rendered by default. Use client components only when state, effects, browser APIs, or event handlers require it.
- Comment the reason, not the action. Use `// WHY:` and include the relevant requirement ID beside important rules/invariants.
- Encode security/data invariants in types and interfaces (e.g. an owner's view type has no field for data the owner may not see). Do not pass data a component is not allowed to receive.
- Money is stored as an integer in kobo. Default currency is NGN. Never use floating point for money.
- Use design tokens for colour, spacing, radius, and typography. Do not introduce arbitrary values; add an automated check that fails on them.
- Responsive visibility on components that set their own `display` (Tailwind): use `max-md:hidden`, not `hidden md:inline-flex`, which loses to the component's own class.
- A button can't contain a button. A row with its own action is two sibling targets.

## Copy rules

- Follow the project's style guide for punctuation, quotes and tone.
- Never guess pronouns. Use the person's name or "they".
- Never promise something that isn't built (reminders, saving offline).
- Notifications, activity feeds, emails and errors never reveal data the reader is not allowed to see.

## Database rules

- Row Level Security (or equivalent) is enabled for every table. No exceptions.
- Use a non-superuser application role.
- Sensitive read paths must expose only the minimum information required; use secure server-side functions where appropriate.
- Write the table, policy, and policy test together when changing database access.
- Never expose reservation or assignment data through props, API responses, errors, logs, or client state when the user is not authorized to see it.

## Testing & definition of done

Before declaring a slice complete:

1. Relevant security tests have **run and passed**. Any security-test failure blocks completion. Tests written but not run do not count.
2. Typecheck, lint, design-token check, unit tests and build pass.
3. Relevant integration/E2E tests pass.
4. UI is checked against the named designs at mobile, tablet and desktop widths (there are no tablet frames: judge 768 against the mobile design), including open sheets and dialogs and the loading, empty, error and success states.
5. The real flow is clicked through signed in, as each role it touches (including signed-out visitors and outsiders). If that can't be done, say so plainly; the slice stays open until it is.
6. No new hardcoded design-token values were introduced.
7. Requirement/story ID is present where required and in the commit message.
8. No secrets, API keys, or `.env` files are committed.
9. Clearly state what was not implemented and any unresolved risks.

## Never do

1. Never use the UI as an access-control mechanism; enforce authorization in the database/server.
2. Never expose reservation or assignment data to unauthorized users, even indirectly.
3. Never require an account, email, or password from an exchange participant unless the approved requirements explicitly say so.
4. Never build authentication by hand; use the platform's auth service.
5. Never assume USD or display `$` when the product uses NGN.
6. Never add tables or alter approved schema without approval.
7. Never write a retry loop for the exchange draw; validate feasibility first, then create a valid matching.
8. Never delete a wish list with a destructive cascade unless explicitly approved; preserve the intended attachment/removal behavior.
9. Never make link import the primary path for adding an item when manual entry is the approved primary path.
10. Never weaken or modify a failing security test to make it pass. That includes running it with extra filters or edited setup that changes what it proves.
11. Never mark work complete with failing, skipped or un-run required tests.
12. Never invent requirements when the relevant story/spec is missing; stop and ask.
13. Never commit secrets, keys, or `.env` files.
14. Never run destructive migrations against a database containing data without explicit approval.
15. Never read secret values (secret stores, API keys). Ask the owner to set or check them.

## Set up early (ask before starting each)

1. A local database stack so security tests run before handover.
2. CI on every PR: typecheck, lint, design tokens, unit tests, security tests, E2E, build.
3. E2E tests with seeded users per role at mobile, tablet and desktop widths, plus accessibility checks and screenshot comparison against the designs.
4. Preview deploys per PR (with a branch database) for review and phone testing over HTTPS.
5. Error monitoring with no personal data in logs.


## UI Rules

- Use accessible semantic HTML.
- Support keyboard navigation.
- Buttons should never be overlapped by the keyboard on mobile. Instead, move buttons up so they stay visible
- Include loading, empty, error and success states.
- Never use placeholder UI when a real asset exists.
- Do not invent brand colors, typography or spacing.
- `text/pending`, `text/placeholder`, `text/brand` on `surface/brand-subtle`, `border/pending` and `border/success` fail contrast on their own. Always pair them with an icon or a text label that carries the meaning.

## Backend Rules

- Validate user input.
- Enforce authorization server-side.
- Never expose secrets to the client.
- Follow Supabase Row Level Security policies.
- Do not trust client-supplied user IDs for authorization.

## Workflow

For significant features:
1. Inspect relevant files.
2. Create an implementation plan.
3. Wait for approval.
4. Implement the smallest complete slice.
5. Run tests/type checks.
6. Fix failures.
7. Verify the UI visually.
8. Summarize changes.

## Testing

After meaningful changes run:
- typecheck
- lint
- relevant unit tests
- relevant end-to-end tests

Do not claim something works without verification.


## Product rules that apply everywhere

These come from the user stories and are easy to break by accident:

- **Pair secrecy.** No one learns who gives to whom except a giver seeing their own person. The organiser never sees pairs, including when fixing pairs or re-drawing. Activity events and emails never name a giver/recipient pair.
- The organiser never sees participants' email addresses.
- Every date and time shows in the viewer's own time zone.
- Mobile-first; desktop uses a left sidebar for the four sections.
- Auth is passwordless (6-digit email code); no social sign-in, no phone or SMS login in v1.

## Multi-agent workflow

Four sub-agents live in [.claude/agents/](.claude/agents/): `planner`, `builder`, `tester`, `reviewer`.

Sequence: **planner → builder → tester → reviewer**. The main session coordinates; sub-agents cannot call each other and do not see each other's conversations.

Loops:
- Planner finds missing/ambiguous requirements → stop and ask the user.
- Builder finds a problem with the plan → stop and report before deviating significantly.
- Tester verdict FAIL → findings go to builder → tester retests affected areas.
- Reviewer verdict CHANGES REQUIRED → findings go to builder → tester → reviewer again.
- Done only when the latest test verdict is PASS **and** the latest review verdict is APPROVED.
- Re-run the planner only if requirements or the plan itself must change.

### Models

Each agent picks its own model in the `model:` line of its frontmatter. Agents don't need to share a model, and the main session can call all of them whatever model it runs on itself.

| Agent | `model:` |
|---|---|
| planner | `opus` |
| builder | `sonnet` |
| tester | `sonnet` |
| reviewer | `opus` |

To change one, edit only that line in `.claude/agents/<agent>.md`, then restart the session or open `/agents`. Accepted values:
- an alias (`opus`, `sonnet`, `haiku`, `fable`): the newest model in that family that your installed Claude Code supports
- a full model ID (e.g. `claude-opus-5-5`): pinned to that exact model
- `inherit`: uses the main session's model

If a model isn't supported, that agent fails with an API error. Nothing switches to another model automatically. Upgrade Claude Code or change the line yourself.

### Handoff log

Every task has one log file: `docs/tasks/<TASK-ID>.md` (story ID such as `GC-003`, or a short kebab-case slug for non-story work). Sub-agents other than the builder are read-only, so **the main session appends each agent's handoff to the log** and passes the log path to the next agent. Agents read the log instead of re-exploring what is already documented.

Every handoff starts with this block:

```
## <Agent> — round <n> — <date>
- Task: <TASK-ID> — <one-line objective>
- Requirements: <story IDs / sections; acceptance criteria refs>
- Files/components: <paths>
- Work completed: <facts only>
- Outstanding issues: <or "None">
- Next action: <who does what next>
```

### Global rules for all agents

- Treat this file and `docs/` as authoritative. Do not invent requirements, business logic or architecture.
- Respect existing conventions; prefer the simplest maintainable solution; make no unrelated changes.
- Never print, commit or copy secrets, API keys, credentials or `.env` values.
- Never run destructive database operations, migrations against shared/remote databases, or deployments without explicit user approval.
- Label every claim as verified (you ran/read it) or assumed. Never report a test as passing unless it was executed in this task.
- Report blockers plainly instead of presenting partial work as complete.
