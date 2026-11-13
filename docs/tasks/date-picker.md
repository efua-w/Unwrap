# date-picker

Own change after slice 4 (branch `slice-4-date-picker`). Closes open item 69 when done.

## Owner decision — 2026-11-12 (Tobechukwu Olih)
- The Join by and Gift day fields get a custom date picker with the calendar icon shown on the boards (the native date input cannot show the icon without hiding its own picker).
- Open item 68: no dedicated token for the dropdown height; keep the existing one.
- Slice 4 signed-in click-through passed.

## Design evidence
- Boards Org-Budget-default / -filled / -error (UwInput kind "date"): box min-h 48, padding 0 16, radius 8, 1px border/input, error border; placeholder "Choose a date"; Phosphor Calendar 20 at the right in text/secondary; filled value "Fri 4 Dec 2026".
- No board shows the calendar itself. Main session spec (follows the approved Draw time picker): a month grid, as a dropdown under the field from 768 and the existing Sheet below 768, titled with the field label.
- Assumptions to confirm with the owner: weeks start on Monday; past days are not disabled (the existing validation errors still apply).

## Builder — round 1 — 2026-11-11
- Task: date-picker — custom DateField for Join by and Gift day (replaces native type="date")
- Requirements: GCO-002, GCO-004 (Join by, Gift day); boards Org-Budget-default/-filled/-error; open item 69; WAI-ARIA date picker dialog pattern
- Files/components: components/ui/DateField.tsx (new), lib/dates/calendar.ts (new), lib/dates/format.ts (formatYmdDayYear), features/exchanges/components/StartExchangeFlow.tsx, app/dev/components/Interactive.tsx + page.dev.tsx (DateField demo), tests/unit/calendar.test.ts (new), tests/e2e/exchanges-signed-in.spec.ts, docs/copy-pending.md
- Work completed: DateField built to the spec (trigger styled as the field, "Fri 4 Dec 2026" / "Choose a date", dropdown from 768 via matchMedia, Sheet below, roving-tabindex grid with Mon-first weeks, arrows/PageUp/PageDown/Home/End, Esc and outside click close, focus returns to the trigger, Tab out of the dropdown closes it, Tab in the sheet does not). Month state is derived from the focused day; Previous/Next month keep focus on the arrow button. Form state stays "YYYY-MM-DD". Field.tsx date support kept (gallery Field demo still uses type="date"/"time"). Checks: typecheck, lint (0 warnings), tokens:check, npm test (211 pass, incl. new calendar tests), npm run build all pass. Playwright NOT run (see below).
- Outstanding issues: e2e not run. A `next dev` server (PID 27588, started 11:50, before this task) holds port 3000 and the .next dev lock, and returns 500 ("formatYmdDayYear is not a function", stale after my build). Playwright cannot start its own server (Next allows one dev server per directory). I did not kill a process I did not start.
- Next action: main session stops PID 27588 (or tells me to), then run `npx playwright test tests/e2e/exchanges-signed-in.spec.ts tests/e2e/gallery.spec.ts`; tester verifies at 390/768/1440, signed in.

## Builder — round 2 — 2026-11-11
- Task: date-picker — fix axe failures and reviewer round 1
- Requirements: GCO-002, GCO-004
- Files/components: components/ui/usePicker.ts (new), DateField.tsx, TimeField12.tsx, tests/e2e/exchanges-signed-in.spec.ts
- Work completed: R1-1 name is now "<label> <value or Choose a date>" (aria-labelledby label + trigger); placeholder colour text-text-muted (axe contrast). R1-2 usePicker hook (mode, matchMedia, outside click, open/close/dismiss with focus return) used by both fields, behaviour unchanged. R1-3 aria-invalid is rejected by lint rule jsx-a11y/role-supports-aria-props on a button, so it is NOT on DateField (error still reaches the trigger via aria-describedby and the role=alert line). R1-5 comment corrected (native modal dialog). R1-6 month lookup over 12 names in the e2e helper. E2E lookups use /^label/ and assert the full accessible name; getByLabel("Join by") boundingBox lookups switched to role button since the Sheet dialog also matches that label.
- Outstanding issues: None. Checks: typecheck, lint (0 warnings), tokens:check, npm test 211 pass, build pass, playwright exchanges-signed-in + gallery 72 passed. Not visually compared to boards; no manual signed-in click-through.
- Next action: tester, then reviewer

## Reviewer — round 2 — 2026-11-12
- APPROVED. R1-1, R1-2, R1-5, R1-6 and contrast fixed; R1-3 accepted (describedby + role="alert"; aria-invalid not allowed on a button by lint). Stale TimeField12 comment fixed by the main session.
- Open: owner to confirm Monday-first weeks and selectable past days; "Previous month"/"Next month" in copy-pending; open item 67 (Sheet focus).

## Owner decision — 2026-11-12 (Tobechukwu Olih)
- Weeks start on Sunday.
- Past days cannot be picked.

## Builder — round 3 — 2026-11-12
- Task: date-picker — Sunday-first weeks and no past days (owner decision 2026-11-12)
- Requirements: GCO-002, GCO-004
- Files/components: lib/dates/calendar.ts, components/ui/DateField.tsx, features/exchanges/components/StartExchangeFlow.tsx, tests/unit/calendar.test.ts, tests/e2e/exchanges-signed-in.spec.ts
- Work completed: weekdayIndex, monthGrid, weekday headers and week start/end are Sunday-first. DateField has an optional `min` ("YYYY-MM-DD"); days before it are aria-disabled, text-text-disabled, no hover, ignore click/Enter/Space, but stay keyboard-focusable. Open focus goes to min when the value is empty or before it. Previous month is disabled when the whole previous month is before min. StartExchangeFlow passes localTodayYmd() for both fields (today stays pickable); validation unchanged. New helpers isBeforeMin / isMonthBeforeMin. Unit tests: Sunday-start month (Nov 2026), Saturday-start month (Aug 2026), week start/end, min helpers. E2E: Previous month disabled in the current month, a past day is aria-disabled and a click leaves the dialog open and the value empty (skipped on the 1st, when no past day shows); the two "past day" picker steps were removed (the server and unit tests still cover those errors).
- Outstanding issues: None. Checks: typecheck, lint (0 warnings), tokens:check, npm test 212 pass, build no errors, playwright exchanges-signed-in + gallery 72 passed. Not visually compared to boards.
- Next action: tester, then reviewer

## Reviewer — round 3 — 2026-11-12
- APPROVED. Sunday-first and `min` correct; no hydration mismatch (min only reaches the calendar, which mounts on open). R3-1 (Low): Previous month dropped focus when it disabled itself — fixed by the main session (focus moves to the grid day).
