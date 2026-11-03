# Unwrap — Build log

Slice status, what was built, and open items. Update after every slice (see CLAUDE.md "After every slice"). Plan: [implementation-plan.md](implementation-plan.md).

Statuses: Not started · In progress · Built — waiting on security tests · In review · Done.

## Slices

| # | Slice | Status | Branch | Notes |
|---|---|---|---|---|
| 0a | App foundation | Not started | | |
| 0b | Database and test harness | Not started | | |
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

## Open items

| # | Item | Raised | Owner | Status |
|---|---|---|---|---|
| 1 | Approve the button labels in copy-pending.md before the slices that use them | 2026-11-03 | Tobechukwu Olih | Open |
| 2 | Implement the token rename in `scripts/build-tokens.ts` (slice 0a); the design export itself is unchanged | 2026-11-03 | builder | Open |
| 3 | Can a person the organiser removed rejoin through the invite link? The rejoin decision covers people who left; needed by slice 6 | 2026-11-03 | Tobechukwu Olih | Closed 2026-11-03: yes, by organiser-approved request only |
