# Unwrap — Build log

Slice status, what was built, and open items. Update after every slice (see CLAUDE.md "After every slice"). Plan: [implementation-plan.md](implementation-plan.md).

Statuses: Not started · In progress · Built — waiting on security tests · In review · Done.

## Slices

| # | Slice | Status | Branch | Notes |
|---|---|---|---|---|
| 0a | App foundation | Merged with known risks | slice-0a-foundation | PR #1 merged 2026-11-04 (CI `check` green). Testing and review were stopped by the owner; see open items 16 and 20 |
| 0b | Database and test harness | Done | slice-0b-database | PR #2 merged 2026-11-04. Hardening migration on dev project `ulziqspdjtjszvdcwdek`; security tests 38/38 on the dev project and in CI; tester PASS, reviewer APPROVED. No UI, so no signed-in click-through applies |
| 1 | Sign up, log in, profile setup | Not started | | |
| 2 | Wishlists core | Not started | | |
| 3 | Share and public view | Not started | | |
| 4 | Start an exchange | Not started | | |
| 5 | Invite and join | Not started | | |
| 6 | Approval, participants, Activity v1 | Not started | | |
| 7 | Email outbox and notification preferences | Not started | | |
| 8 | Readiness and nudges | Not started | | |
| 9 | Exclusions and draw engine | Not started | | |
| 10 | Draw, names drawn, reveal | Not started | | |
| 11 | Recipient wishlist and got-it marks | Not started | | |
| 12 | Scheduled jobs | Not started | | |
| 13 | Edit exchange | Not started | | |
| 14 | Leaving and blind repairs | Not started | | |
| 15 | Cancel, hand over, complete | Not started | | |
| 16 | Account | Not started | | |
| 17 | Link import and photos | Not started | | |
| 18 | Hardening | Not started | | |

## Decisions

| Date | Decision | Decided by | Where recorded |
|---|---|---|---|
| 2026-11-03 | Scheduled jobs and emails: Supabase `pg_cron` + `email_outbox` + Edge Function worker → Resend | Tobechukwu Olih | plan §8 |
| 2026-11-03 | No phone numbers or SMS login in v1; no Twilio | Tobechukwu Olih | stories GC-003, 004, 024, 025 |
| 2026-11-03 | Unit tests with Vitest; security tests with pgTAP | Tobechukwu Olih | CLAUDE.md stack |
| 2026-11-03 | Invite QR code dropped from v1 | Tobechukwu Olih | story GCO-005 |
| 2026-11-03 | Draw engine and repairs run in Postgres | Tobechukwu Olih | plan §7, §8 |
| 2026-11-03 | Budget presets ₦5,000–₦10,000; ₦10,000–₦20,000; ₦20,000–₦50,000; Above ₦50,000, overriding the designs | Tobechukwu Olih | story GCO-002 |
| 2026-11-03 | Tablet width (768) is judged against the mobile designs | Tobechukwu Olih | CLAUDE.md definition of done |
| 2026-11-03 | "Board" in CLAUDE.md means a UI screen design on the canvases | Tobechukwu Olih | CLAUDE.md |
| 2026-11-03 | No E10 or E11 email designs, intentionally; the canvases are up to date | Tobechukwu Olih | — |
| 2026-11-03 | Open design questions: build what the designs show | Tobechukwu Olih | stories decisions table |
| 2026-11-03 | Exchanges are told apart by colour tint | Tobechukwu Olih | stories decisions table |
| 2026-11-03 | Copy without a story source goes in copy-pending.md for approval | Tobechukwu Olih | [copy-pending.md](copy-pending.md) |
| 2026-11-03 | Token `sizing/:5` emitted as `sizing-0-5` (also `:25` → `sizing-0-25`) to fix a name collision with `sizing/5` | Tobechukwu Olih | plan §8 |

| 2026-11-03 | Architecture review applied to the plan (see plan "Revision log"), including `@axe-core/playwright` as an approved dev dependency | Tobechukwu Olih | plan |
| 2026-11-03 | People who left an exchange can rejoin under the normal join rules | Tobechukwu Olih | stories GC-009, GC-017 |
| 2026-11-03 | People the organiser removed can rejoin, but only through a join request the organiser approves, even when approval is off | Tobechukwu Olih | stories GC-009, GCO-007 |
| 2026-11-03 | At most 100 people per exchange (the invite limit and "full") | Tobechukwu Olih | stories GC-009, GCO-005 |
| 2026-11-03 | Low-contrast tokens (`text/pending`, `text/placeholder`, `text/brand` on `brand-subtle`, `border/pending`, `border/success`) only ever appear with an icon or label | Tobechukwu Olih | plan §8, CLAUDE.md UI rules |

| 2026-11-03 | Token export re-exported with the missing tokens (icon sizes, focus, hover/pressed colours, overlay, elevation, `red/600–700`, `sizing/1:5`) and four size tokens (`size/avatar-sm` 36, `size/touch-target` 44, `size/control-lg` 56, `size/row` 72) | Tobechukwu Olih | `design/variables_tokens.json` |
| 2026-11-03 | Focus ring on dark (ink) surfaces uses `border/inverse` (white) | Tobechukwu Olih | slice-0a log |
| 2026-11-03 | At 768 and wider: Sidebar replaces BottomTabs and headings switch to desktop sizes; "judge 768 against mobile designs" applies to page content | Tobechukwu Olih | plan §8 |
| 2026-11-03 | Dev-only component gallery routes `/dev/components` and `/dev/shell`, excluded from production builds | Tobechukwu Olih | plan §3 |
| 2026-11-03 | Dev dependencies `eslint` and `eslint-config-next` approved; scripts use Node's built-in TypeScript support (no `tsx`); npm is the package manager | Tobechukwu Olih | slice-0a log |
| 2026-11-03 | Deferrals: OtpInput → slice 1; money Field and `lib/money` → slice 2; date/time Fields, `lib/dates` formatting, `<LocalDateTime>`, `<Naira>` → slice 4; other components → first-use slice | Tobechukwu Olih | slice-0a log |
| 2026-11-03 | Size tokens added to the export: `size/textarea-min` 96, `size/toast-max` 400, `size/dialog` 480, `size/content-max` 1040, `size/sidebar-min` 240, `size/sidebar-max` 280. Chip height, skeleton line, mobile toast width, sheet max height (90%) and badge offset need no token (derived from other tokens or relative units) | Tobechukwu Olih | slice-0a log |
| 2026-11-03 | In-app Back always goes to the page's parent (`router.push(parentHref)`); no browser-history logic. Browser Back is unchanged | Tobechukwu Olih | slice-0a log |
| 2026-11-03 | Playwright and `@axe-core/playwright` brought forward from slice 0b to slice 0a for browser checks | Tobechukwu Olih | slice-0a log |
| 2026-11-03 | Node pinned to the current 22 LTS (exact version in `.nvmrc`); ESLint 10 if supported; `npm audit` recorded; `AGENTS.md` committed | Tobechukwu Olih | slice-0a log |
| 2026-11-04 | Approved: copy-pending labels; builder interpretations (Avatar 36/40, 44, 80; Back header at all widths; label/meta Chip colours; Alert body colour; toast/sheet padding; disabled secondary border); desktop offline banner inside the content column from 768 | Tobechukwu Olih | slice-0a log |
| 2026-11-04 | Node pinned to 26.13.0 (current LTS), replacing 22.23.4 | Tobechukwu Olih | slice-0a log |
| 2026-11-04 | Owner completed the human checks: iOS keyboard against the Sheet footer, screen reader pass (including offline), board comparison of the gallery screenshots | Tobechukwu Olih | slice-0a log |
| 2026-11-04 | Slice 0b: clean start (partly superseded later on 2026-11-04: "local only" replaced by the hosted dev project; "fix T7-1 first" replaced by "skip T7-1 for now") from an empty local database (remote project `esdfsgyxyhqfajwezgzv` and its 16 migrations set aside); Supabase CLI as a pinned npm dev dependency; no hosted project touched in 0b; fix the flaky e2e (T7-1) first as its own commit; seeded users are local auth personas with a SQL act-as helper (signed-in Playwright fixture moves to slice 1); add a definer `search_path` test | Tobechukwu Olih | slice-0b log |
| 2026-11-04 | No local Docker: slice 0b develops against the hosted Supabase project `ulziqspdjtjszvdcwdek` ("Unwrap"), replacing the local-only decision; each migration applied there needs owner approval; the old project `esdfsgyxyhqfajwezgzv` stays untouched | Tobechukwu Olih | slice-0b log |
| 2026-11-04 | Skip the T7-1 flaky e2e fix for now; partial change kept in git stash "T7-1 partial" | Tobechukwu Olih | slice-0b log |
| 2026-11-04 | Apply `harden_defaults` to the dev project `ulziqspdjtjszvdcwdek` and run the security tests there (rolled back); the five test personas exist only inside the test transaction, not persisted | Tobechukwu Olih | slice-0b log |
| 2026-11-04 | Supabase key env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key); the comment-only fix to the applied `harden_defaults` migration is allowed as an exception to "never edit an applied migration" because no statement changes | Tobechukwu Olih | fix-0a-followups log |
| 2026-11-03 | ~~Superseded 2026-11-04 (owner): slice 0b is a clean start, local only~~ The remote Supabase project (`esdfsgyxyhqfajwezgzv`) is the right project for this build. Its 16 existing migrations are pulled down as files to become the slice 0b baseline rather than rewriting the schema from scratch | Tobechukwu Olih | this log, item 16 |

## Open items

| # | Item | Raised | Owner | Status |
|---|---|---|---|---|
| 1 | Approve the button labels in copy-pending.md before the slices that use them | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-04: all labels in copy-pending.md approved by owner |
| 2 | Implement the token rename in `scripts/build-tokens.ts` (slice 0a); the design export itself is unchanged | 2026-11-03 | builder | Closed 2026-11-03: `sizing-0-25`, `sizing-0-5`, `sizing-1-5` emitted; test covers the collision |
| 3 | Can a person the organiser removed rejoin through the invite link? The rejoin decision covers people who left; needed by slice 6 | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-03: yes, by organiser-approved request only |
| 4 | Browser checks for slice 0a. Playwright e2e now covers (69 tests across 390, 768, 1440): AC-11 (tz cookie, single refresh, invalid value replaced), AC-12 (busy Enter, busy link), AC-14 (Sheet Esc, backdrop, double Esc while busy, focus), AC-15 (Toast replace, hover and focus holds, focus restore), AC-16 (offline banner, Try again), AC-18 (SkeletonRegion timing), AC-21 (shell at 390/768/1440, unread name), AC-22 (focus ring), and an axe scan of both galleries. Still needs a human: comparison of the saved screenshots (`test-results/screenshots`) with the boards, a real screen reader with the network offline, the desktop offline banner against the sticky Sidebar, and `aria-current` on a real section page | 2026-11-03 | Tobechukwu Olih (board comparison, screen reader); tester (e2e re-run) | Open |
| 5 | iOS keyboard against the pinned Sheet footer needs a real-device check | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-04: checked on a real iPhone by the owner |
| 6 | CI workflow (`.github/workflows/ci.yml`) has never run on GitHub | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-04: CI ran on PRs #1 and #2; `check` and `security` green |
| 7 | R1-11: Node pinned to 26.13.0 in `.nvmrc`, `engines` `>=26.13.0` (was 22.23.4). The `--experimental-strip-types` flag is gone from the npm scripts, since Node 26 strips types by default | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-04 (updated to 26.13.0) |
| 8 | R1-12: ESLint stays on 9.39.5. `eslint-config-next` 16.4.4 allows ESLint >=9, but its plugins (`eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`) only declare support up to ESLint 9, and ESLint 10 still cannot be used until they do (re-checked 2026-11-04: `eslint-plugin-react` 7.37.5, `eslint-plugin-import` 2.32.0 and `eslint-plugin-jsx-a11y` 6.10.2 are the latest and still cap at ESLint 9; the Node 22.13 requirement is now met on Node 26). `npm audit`: 16 moderate, 0 high or critical, all dev-only and all from an old `minimatch` (denial of service via glob amplification) pulled in by eslint, eslint-config-next, typescript-eslint and the react, import and jsx-a11y plugins. npm offers no usable fix (`--force` would downgrade eslint). Revisit when those plugins support ESLint 10 | 2026-11-03 | Tobechukwu Olih (revisit) | Closed 2026-11-03: stay on 9, audit recorded |
| 9 | R1-15: `AGENTS.md` (generated by `next dev`) is kept and not gitignored; commit it with the slice | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-03 |
| 10 | Owner interpretations to confirm against the boards: Avatar sizes (face 36/40, nav 44, profile 80), Back header at all widths, label/meta Chip colours (about 4.95:1), Alert body colour, toast and sheet padding, disabled secondary using `border-surface-disabled` (no `border/disabled` token) | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-04: owner approved the builder interpretations as built |
| 11 | Textarea `field-sizing-content` has no Firefox fallback, so a Field textarea does not auto-grow there; it scrolls instead. Add a small growth fallback, or accept | 2026-11-03 | Tobechukwu Olih (decides); builder | Closed 2026-11-04: `TextareaAutoGrow` fallback in Field when `field-sizing` is unsupported (unit-tested; not checked in a real Firefox) |
| 12 | A toast that is open under a modal Sheet stays visible above it, but its action (Undo) is inert, because a modal makes everything outside it inert. Show toasts after the Sheet closes | 2026-11-03 | builder (slice that first uses both) | Closed 2026-11-04: Toast holds a new toast while a modal is open and shows it when the last one closes |
| 13 | check-tokens gaps: code on the same line after a closing `*/` is not scanned, and a block comment opened mid-line is not tracked. Low; later hardening | 2026-11-03 | builder | Open |
| 14 | T6-1: on desktop (1440) the sticky offline banner overlays the top of the Sidebar (Home item). Decide placement against board S48; reviewer recommends the banner inside the content column from 768 | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-04: the banner now renders inside the content column (AppShell), right of the Sidebar from 768; e2e at 1440 checks no overlap and a clickable Home link |
| 15 | T6-2/T6-3: e2e assertions weaker than AC wording (offline banner within 1s, Button variants and states, toast 4s/8s exact timing) and axe only on default gallery states (not with Sheet, toast or offline banner shown). Low; strengthen in slice 0b | 2026-11-03 | builder | Open |
| 16 | Migration baseline recovered: the 16 migrations that built the remote schema existed only in the database, with no `.sql` files in the repo. All 16 were read back from `supabase_migrations.schema_migrations` and written to `supabase/migrations/`, each verified byte-identical by md5 against the server. The database was not modified (reads only). Still to do in slice 0b: install the Supabase CLI and confirm `supabase db diff` reports no drift | 2026-11-03 | builder | Superseded 2026-11-04: owner chose a clean start for slice 0b; remote project set aside |
| 17 | Legacy product name in shipped email copy: `private.email_drawn` (migration `20261027062331`) says "Open GiftCircle to see who you're buying for"; `public.request_data_copy` and `private.drain_email_outbox` (migration `20261020121449`) use "Your GiftCircle data", "added to GiftCircle", the attachment name `giftcircle-data.json` and a "GiftCircle" email signature. The product is Unwrap. Needs a copy decision, then a new migration — migrations already applied are never edited | 2026-11-03 | Tobechukwu Olih (copy); builder | Deferred 2026-11-04: applies to the set-aside remote schema; revisit in the slice that builds the affected object |
| 18 | Database prerequisites found by the advisors: `pgtap` is available but **not installed**, so no security test can run until it is enabled; `pg_net` is installed in the `public` schema and should be moved. Both need a migration in slice 0b | 2026-11-03 | builder | Deferred 2026-11-04: applies to the set-aside remote schema; revisit in the slice that builds the affected object |
| 19 | Two `SECURITY DEFINER` functions are callable by `anon`: `public.get_invite_preview(text)` and `public.get_shared_wishlist(text)`. Both are token-gated by design and are the app's whole public attack surface. Confirm their exposed fields are the minimum, and cover them with pgTAP tests in slice 0b | 2026-11-03 | builder | Deferred 2026-11-04: applies to the set-aside remote schema; revisit in the slice that builds the affected object |
| 20 | Slice 0a closed without a final passing test and review (owner decision 2026-11-04): verify builder round 8 changes and fix e2e flakiness (T7-1) before relying on the e2e suite; confirm on first CI run | 2026-11-04 | builder | Open |
| 21 | Slice 0b CI `security` job has never run; first run on the PR. The types drift step will likely fail once because `lib/supabase/database.types.ts` came from the connector, not the CLI: take the CI-generated file as canonical and commit it (reviewer R1-3) | 2026-11-04 | Tobechukwu Olih | Closed 2026-11-04: first CI run (PR #2) passed the security tests 38/38; types drift failed on formatting only, so the CI-generated file was committed as canonical |
| 22 | `harden_defaults` was applied to the dev project without its comments (statements identical), and its header says "without FOR ROLE" although the code uses `for role postgres`. The file is applied, so it is left as is (reviewer R1-4) | 2026-11-04 | builder | Closed 2026-11-04: header comment corrected (comment-only edit to the applied migration, owner decision; no statement changed) |
| 23 | Security tests: tighten the anon allowlist in 030 to full function signatures when slices 3 and 5 add `get_shared_wishlist` and `get_invite_preview`; widen the schema scope of 010/015/020/040 if `config.toml` API schemas change (reviewer R1-5) | 2026-11-04 | builder | Open |
| 24 | `.env.example` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`; newer projects issue publishable keys (`sb_publishable_…`). Decide the variable name in slice 1 (reviewer R1-7) | 2026-11-04 | builder | Closed 2026-11-04: variable is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (owner); value in `.env.local` only |
| 25 | R1-4: e2e gaps for fix-0a-followups: Sheet unmounted while open, nested sheets, the full 8s starting from close, newest-wins for a held toast, and a forced-fallback test for the Firefox textarea growth (item 11). Low | 2026-11-04 | builder | Open |
| 26 | R1-5: a toast already showing when a Sheet opens is covered by it but still times out underneath. Low | 2026-11-04 | builder | Open |
