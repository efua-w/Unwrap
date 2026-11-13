# dates-layout-12h-time

Change raised mid-slice 4 (own note, own commit). Branch: `slice-4-exchanges`. Requested by the owner 2026-11-11 with a screenshot of S27 Budget and dates (desktop).

## Owner request — 2026-11-11 (Tobechukwu Olih)
1. Join by and Gift day sit side by side on desktop (two equal columns, same row).
2. Draw time is a 12-hour input with an AM/PM switch.

## Design evidence (owner screenshot)
- Row 1: "Join by" and "Gift day" date fields, equal width, side by side, placeholder "Choose a date" with a calendar icon.
- "When are names drawn?" segmented choice (unchanged).
- "Draw time": a field showing "6:00" with a clock icon at the right, and beside it on the same row a two-option segmented switch "AM" / "PM" (PM selected), same height as the field. The helper "Joining closes at this time on the join-by day." sits below the row.

## Builder — round 1 — 2026-11-11
- Task: dates-layout-12h-time — Join by / Gift day side by side from 768; Draw time as 12-hour input with AM/PM switch
- Requirements: owner request 2026-11-11 (S27 Budget and dates screenshot); GCO-002
- Files/components: components/ui/TimeField12.tsx (new), lib/dates/time12.ts (new), features/exchanges/components/StartExchangeFlow.tsx, app/dev/components/Interactive.tsx (TimeField12Demo), app/dev/components/page.dev.tsx, tests/unit/time12.test.ts (new), tests/e2e/exchanges-signed-in.spec.ts
- Work completed: date fields in `grid items-start gap-20 md:grid-cols-2`. TimeField12: text input (h:mm, numeric, autocomplete off) + decorative Clock icon + AM/PM radiogroup (h-48) on one row; value/onChange stay 24-hour "HH:MM"; invalid text emits "" (existing "Choose a time." error); blur normalises to h:mm; AM/PM change keeps hour and minutes. Form state, validation, action, formatHm unchanged. Checks: typecheck, lint, tokens:check pass; npm test 202/202 pass; build passes. E2E not run (owner's server on :3000), so the e2e edits are unverified.
- Outstanding issues: Round 1 later revised to the board specs: grid `md:gap-16 md:items-start`; Draw time row items-center gap-8; AM/PM reuses SegmentedTabs kind="choice" with a new `compact` option (sr-only legend "AM or PM", inline, option min-w-64); group name is "AM or PM" so e2e uses getByLabel("Draw time", { exact: true }) is no longer strictly needed but harmless. Date fields: no trailing calendar icon added (Field has no trailing-icon support that keeps the native picker). Not visually checked at 390/768/1440; e2e not run.
- Next action: tester runs e2e and checks S27 at 390/768/1440 (alignment with an error on one date only, focus ring on the AM/PM pills, axe).

## Owner decision — 2026-11-11 (Tobechukwu Olih)
- The Draw time field opens a 12-hour time picker (a native time input cannot be forced to 12-hour; it follows the device).
- No board shows a picker. Owner chose: a list of times every 30 minutes, anchored under the field from 768, and a bottom sheet (existing sheet component) below 768. The AM/PM switch stays beside the field.

## Builder — round 2 — 2026-11-11
- Task: dates-layout-12h-time — Draw time opens a 12-hour picker instead of typing
- Requirements: owner decision 2026-11-11; GCO-002
- Files/components: components/ui/TimeField12.tsx (rewritten), lib/dates/time12.ts, tests/unit/time12.test.ts, tests/e2e/exchanges-signed-in.spec.ts (dev gallery demo unchanged: same props)
- Work completed: the field is a button role="combobox" (aria-haspopup listbox, aria-expanded, aria-controls, aria-activedescendant, labelled by "Draw time"), same box and clock icon, AM/PM switch and helper/error wiring. The list is 24 options (12:00, 12:30, 1:00 ... 11:30) for the chosen meridiem, with a Check on the selected one, selected option scrolled into view. From 768 (checked with matchMedia on open) it is an anchored dropdown (`max-h-toast-max`, token surfaces, shadow-overlay, same width as the field); below 768 it is the existing Sheet (variant form, title "Draw time", footer empty). Keys: Enter/Space/ArrowDown/ArrowUp open; Arrow Up/Down, Home, End, Enter/Space select, Esc closes, Tab closes, click outside closes. Choosing closes and returns focus to the field. Switching AM/PM keeps hour and minutes; an empty value stays empty and shows "Choose a time." through the existing error. Removed parseTime12Text and textToHm (unused); kept conversions and added TIME_OPTIONS with unit tests. E2E now opens the picker, asserts a sheet at 390, none at 768+, 24 options, and picks 6:00 (PM). Checks: typecheck, lint, tokens:check pass; npm test 201/201; build passes. E2E not run.
- Outstanding issues: Not exercised in a browser, so unverified: sheet keyboard use (the Sheet focuses its heading; Tab reaches the list, then arrows work), focus return from the sheet, scrollIntoView inside the sheet. `max-h-toast-max` (400px) is the closest token for the dropdown height, and its name is not about dropdowns. In the sheet the options are not keyboard-reachable before Tab. A closed dropdown with the field blurred by a mouse click on the AM/PM switch closes via the outside-click listener. Existing e2e `getByLabel("Draw time")` at the "When I choose" step still counts 0 because the whole field unmounts.
- Next action: tester runs e2e and checks the picker at 390/768/1440 (dropdown scroll, Esc/Tab/outside click, sheet, axe, focus return).

## Main session — checks — 2026-11-11
- Gallery check (Playwright on the dev server): from 1440 the picker drops down under the field (24 options, 6:00 ticked and scrolled into view); at 390 it opens the "Draw time" sheet; Esc closes and returns focus to the field. Row: field and AM/PM switch 8px apart, switch 52px next to the 48px field, centred.
- e2e `exchanges-signed-in.spec.ts` + `gallery.spec.ts`: 69 passed, 3 failed — the spec looked for role `radiogroup`, but SegmentedTabs renders a fieldset (role `group`) of radios. Fixed the locator; the failing test now passes at 390, 768, 1440 (3/3).
- Not done: owner look in the real flow; calendar icon on the date fields (Field cannot show it without hiding the native picker); dropdown max height reuses `max-h-toast-max` (owner to say if a dedicated token is wanted).

## Reviewer — round 1 — 2026-11-11
- Task: dates-layout-12h-time
- Requirements: owner request and picker decision 2026-11-11; GCO-002
- Files/components: TimeField12, time12, SegmentedTabs (compact), StartExchangeFlow, dev gallery, unit + e2e
- Work completed: APPROVED. Medium R1-1 Tab closed the modal sheet; R1-2 sheet focuses its heading, not the list. Low R1-3 trigger aria in sheet mode, R1-4 no type-ahead, R1-5 period can drift if value changes while mounted, R1-6 toast token reused for dropdown height.
- Outstanding issues: R1-2, R1-6, calendar icon
- Next action: main session fixes R1-1, logs the rest

## Main session — review fixes — 2026-11-11
- R1-1 fixed: Tab now only closes the dropdown (handled on the trigger); in the sheet, Tab is left to the Sheet's focus trap. typecheck, lint, tokens:check, unit 201/201 pass.
- Logged as open items in docs/progress.md: 67 (R1-2, shared Sheet initial focus), 68 (R1-6 token), 69 (calendar icon). R1-3/R1-4/R1-5 accepted as is.
