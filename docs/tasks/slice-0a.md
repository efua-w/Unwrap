# slice-0a — App foundation

Handoff log for slice 0a. The main session appends each agent's handoff here (see CLAUDE.md "Handoff log").

## Brief — main session — 2026-11-03
- Task: slice-0a — App foundation (no product feature)
- Requirements: docs/implementation-plan.md §4 (components), §8 (architecture: tokens, colour use, icons, mobile layout, offline, tests), §9 (folder structure), §10 row 0a
- Files/components: none exist yet; repo holds only docs, `design/variables_tokens.json`, `.claude/agents/`, `CLAUDE.md`
- Work completed: plan approved and revised after architecture review; all open questions closed (docs/progress.md)
- Outstanding issues: `main` has no commits yet, so the slice branch `slice-0a-foundation` can only be created after a first commit, which needs the owner's go-ahead
- Next action: planner produces the slice 0a plan for owner approval

Scope from the plan: Next.js 16 scaffold, strict TS, lint, token build + check scripts, fonts (Bona Nova, Plus Jakarta Sans), Phosphor (server-safe import), `components/ui` primitives (Button, Field, Sheet, Toast, Alert, Skeleton, Avatar, Chip, Header), AppShell (BottomTabs < 768px, Sidebar ≥ 768px), offline Alert, viewport meta and `tz` cookie script, CI (typecheck, lint, tokens, Vitest, build).

Out of scope for 0a: Supabase, database, auth, Playwright/axe (slice 0b), any product screen.

## Planner — round 1 — 2026-11-03
- Task: slice-0a — App foundation (scaffold, strict TS, lint, token build and check, fonts, Phosphor, `components/ui` primitives, AppShell, offline Alert, viewport and `tz` cookie, CI)
- Requirements: implementation-plan.md §4, §8, §9, §10 row 0a; CLAUDE.md; progress.md decisions and open item 2; GC-029 (offline copy); GC-006 C (navigation); GC-020 (slow-loading copy); Spec boards 01, 02, 05, 07–12, 14 and board 19 (DS audit)
- Files/components: none exist yet; all paths below are new
- Work completed: read all sources; found that the token export lacks tokens the spec boards rely on (Q1–Q4)
- Outstanding issues: Q1–Q9 below
- Next action: owner answers Q1–Q9; planner re-runs only if answers change the approach

**Main session check (verified 2026-11-03):** `design/variables_tokens.json` on disk now has 167 variables. The copy read earlier this session had 187, including `sizing/1:5`, `border-width/1-5`, `icon-size/sm|md|lg` (16/20/24), `focus/ring-width` and `focus/ring-offset` (2/2), `colour/red/600` (#8f2222), `colour/red/700` (#6b1a1a), `colour/neutral/900-40` (#191a1c66), the surface hover/pressed tokens, `surface/overlay`, `surface/error-hover|pressed`, `border/focus`, `border/placeholder`, and effect style `elevation/overlay` (drop shadow 0 0 32, #191a1c29). The file was replaced after that read; `design/` was never committed, so there is no copy in git.

### Status
NEEDS CLARIFICATION.

### Scope
- In: Next 16 scaffold, strict TS, ESLint, Vitest; `scripts/build-tokens.ts` (closes open item 2), `scripts/check-tokens.ts`, generated `styles/tokens.css`; fonts; Phosphor via `/dist/ssr`; `components/ui`: Button, Field (text, textarea), Sheet, Toast, Alert (offline, section error, privacy), Skeleton, Spinner, Avatar, AvatarStack (initials only), Chip, Icon; `components/layout`: Header, AppShell (BottomTabs < 768, Sidebar ≥ 768), OfflineBanner, TimeZoneCookie; viewport meta; server `tz` reader with validation; CI; dev-only gallery if Q6 approved.
- Proposed deferrals (Q8): OtpInput → slice 1; money Field and `lib/money` → slice 2; date/time Fields, `lib/dates` formatting, `<LocalDateTime>`, `<Naira>`, urgent-date logic → slice 4; Avatar photo → slice 17; ExchangeTag, EmptyState, ListRow, Card, ActionCard, SegmentedTabs, RadioGroup, Checkbox, Timeline, ShareActions, InviteContextBanner → first-use slice.
- Out: Supabase, database, auth, `proxy.ts`, Playwright/axe (0b), product screens, sheet swipe.

### Token pipeline (`scripts/build-tokens.ts` → `styles/tokens.css`)
Input only `design/variables_tokens.json` (read-only), plus a supplement if Q1(b)/Q4(b). Deterministic, committed output with a GENERATED header.

| Source | Output | Utilities |
|---|---|---|
| `Primitives.colors` | `:root` vars (`--colour-neutral-900`) | none (primitives unusable directly) |
| `Tokens.colors` (aliases) | `@theme inline { --color-text-default: var(--colour-neutral-900) }`; missing alias target fails the build | `text-text-default`, `bg-surface-default`, `border-border-default`, … |
| `Primitives.numbers` `sizing/*` | `:root { --sizing-<n>: <rem> }`; rename `^(\d*):(\d+)$` → `${a\|\|0}-${b}` using `name`, never the colliding `token`; duplicate output fails | none |
| `Tokens.numbers` `spacing/<px>` | `--spacing-<px>: var(--sizing-…)`; key is the px value (`p-16` = 16px) — not Tailwind's default scale, document it | p/m/gap/w/h/size/inset keys 0,1,2,4,6,8,12,16,20,24,32,40,48,64,80,120,180 |
| `border-width/*` | `:root` vars; integer `border-N` from Tailwind v4; fractions via `@utility border-0-5` etc. | `border-1`, `border-2`, `border-0-5`, … |
| `border-radius/rounded-*` | `--radius-sm…5xl/none/full` (prefix stripped); bare `rounded` → Tailwind default radius var (verify name) | `rounded-lg` (8), `rounded-xl` (12), `rounded-2xl` (16), `rounded-3xl` (24), `rounded-full` |
| `Typography.strings` | `--font-body: var(--font-plus-jakarta-sans), system-ui, sans-serif`; `--font-heading: var(--font-bona-nova), serif` | `font-body`, `font-heading` |
| `Typography.numbers` | `:root` vars only | none (text styles are the approved combinations) |
| `styles.textStyles` body | `@utility text-body-base-semibold { … }`, line heights rounded to 2 decimals | 28 body utilities |
| heading mobile + desktop | one responsive `@utility text-heading-N` with a `width >= 48rem` media query (Q5) | `text-heading-1…5` |
| Icon sizes (BLOCKED Q1) | `--spacing-icon-sm|md|lg` (16/20/24) | `size-icon-md` via `Icon` |
| Focus (BLOCKED Q1/Q3) | `--focus-ring-width`, `--focus-ring-offset`, `@utility focus-ring` (`:focus-visible` outline) | `focus-ring` |
| Overlay/elevation (BLOCKED Q2) | `--color-surface-overlay`, `--shadow-overlay` | `backdrop:bg-surface-overlay`, `shadow-overlay` |

Resets in `@theme`: `--color-*`, `--spacing-*` and bare `--spacing`, `--radius-*`, `--text-*`, `--font-*`, `--font-weight-*`, `--leading-*`, `--tracking-*`, `--shadow-*` set to `initial`. Breakpoints, `--animate-*`, `--ease-*` keep defaults (`md` = 48rem). Font sizes and spacing in rem; borders in px. Builder verifies against installed Tailwind v4 docs: reset syntax, that `p-5` emits nothing, `@theme inline`, `@utility` with nested `@media`, `backdrop:` variant, default radius var name.

### `scripts/check-tokens.ts`
Scans `app/`, `components/`, `features/`, `lib/`, `styles/` (`*.ts, *.tsx, *.css`); skips `styles/tokens.css`, `node_modules`, `.next`, `scripts/`, `tests/`, `design/`, `docs/`. Prints `file:line:col rule`, exits non-zero. Rules: (1) hex colours (not `href="#main"`); (2) `rgb(`/`rgba(`/`hsl(`/`oklch(`/`color-mix(`; (3) `px`; (4) arbitrary values `x-[…]`, arbitrary properties `[prop:…]`, `-(--var)`; (5) `style={` in TSX; (6) off-scale spacing keys, `border-N` outside {0,1,2,4,8,12,16}, breakpoint prefixes other than `md:`/`max-md:`; (7) numeric Phosphor `size=`; (8) freshness: rebuild in memory and diff `styles/tokens.css`. Escape hatch: same-line `// tokens-allow: <reason>`, counted and reviewed. ESLint `no-restricted-imports` forces `@phosphor-icons/react/dist/ssr`.

### Files (all new)
`package.json`, lockfile, `.nvmrc`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`; `scripts/build-tokens.ts`, `scripts/check-tokens.ts`, `styles/tokens.css`; `app/layout.tsx`, `app/globals.css`, `app/fonts.ts`, placeholder `app/page.tsx` (wordmark only, not the Landing screen); `components/ui/`: Button, Field, CharacterCount (client), Sheet (client), Toast + ToastProvider (client), Alert, Skeleton, SkeletonRegion (client), Spinner, Avatar, AvatarStack, Chip, Icon, `cx.ts`, `initials.ts`, `count-label.ts`, `pausable-timer.ts`; `components/layout/`: AppShell, BottomTabs, Sidebar, NavLinks (client), Header, BackButton (client), OfflineBanner + NetworkStatusProvider (client), TimeZoneCookie (client); `lib/dates/timezone.ts`; `tests/unit/*.test.ts`; `.github/workflows/ci.yml`; gallery `app/dev/components/page.dev.tsx`, `app/dev/shell/…` if Q6.

### Steps
0. Owner approvals Q1–Q9; first commit on `main`; branch `slice-0a-foundation`.
1. Scaffold (TS, App Router, Tailwind, ESLint, no `src/`, `@/*`); delete boilerplate; `strict` + `noUncheckedIndexedAccess`; `.nvmrc` (Node LTS) + `engines`; scripts `dev`, `build`, `start`, `typecheck`, `lint` (`eslint .`; verify `next lint` status in 16), `tokens:build`, `tokens:check`, `test`.
2. ESLint flat config: eslint-config-next (core-web-vitals + typescript), `no-explicit-any: error`, Phosphor import rule.
3. Vitest (node env, `tests/unit/**/*.test.ts`) + smoke test.
4. `build-tokens.ts`, tests first; generate `styles/tokens.css`; close open item 2. Supplement parts BLOCKED on Q1, Q2, Q4, Q5.
5. Root layout: `globals.css` (`@import "tailwindcss"` + tokens; body `font-body text-text-default bg-surface-default`); `fonts.ts` (`next/font/google` Bona Nova 400/700, Plus Jakarta Sans 400–700; check ₦ renders); `viewport` export with `interactiveWidget: 'resizes-content'`; `metadata.title` "Unwrap"; `<html lang="en">`, skip link to `#main`, providers, OfflineBanner, TimeZoneCookie.
6. `check-tokens.ts`, tests first; wire into `tokens:check`.
7. `Icon` (`size: sm|md|lg`, decorative unless `label`) and `cx` — BLOCKED Q1.
8. Button. 9. Field. 10. Alert + OfflineBanner + NetworkStatusProvider. 11. Spinner, Skeleton, SkeletonRegion. 12. Avatar, AvatarStack. 13. Chip. 14. Toast + ToastProvider. 15. Sheet (visuals BLOCKED Q2). 16. Header + BackButton. 17. AppShell, BottomTabs, Sidebar, NavLinks (BLOCKED Q5).
18. Gallery (if Q6): `pageExtensions` compiles `*.dev.tsx` only when `NODE_ENV !== 'production'`; verify absent from `next build` route list.
19. CI: `pull_request` + push to `main`, `permissions: contents: read`, setup-node from `.nvmrc`, `npm ci`, typecheck, lint, `tokens:check`, test, build; no secrets.
20. Docs: progress.md, copy-pending.md, builder handoff here.

### Primitives (from Spec boards)
- **Button** (server; boards 01, UwButton, 19): primary, brand (Draw names/Reveal only), secondary (`border-1-5` emphasis), destructive, text, destructive-text, link (dotted underline, 44 touch), icon (44 circle, label required by type). States hover/pressed, `focus-ring`, disabled, busy (spinner, `aria-busy`, `aria-disabled`, focus kept). 48 tall, `px-24`, `gap-8`, `rounded-full`, body-base-semibold. `href` renders `<Link>`.
- **Field** (board 02): visible label (body-sm-semibold), 48 tall, `px-16`, `rounded-lg`, `border-1` border/input, 16px value; helper with `n/max` counter; error line with icon replaces helper, `aria-invalid` + `aria-describedby`; focus, error, disabled states; textarea min 96 (Q4), grows (`field-sizing: content` + fallback). Validation timing belongs to forms.
- **Sheet** (client, native `<dialog>`; boards 07, 08): confirm, destructive, form; bottom sheet < 768 (top `rounded-3xl`, max 90% height, Q4), 480 dialog ≥ 768 (Q4); backdrop overlay + elevation (Q2); Esc closes all; backdrop closes confirm/form only; busy blocks closing; focus to heading on open, restored on close; scroll lock; reduced motion; form action pinned above keyboard; no swipe.
- **Toast** (client; board 09): 4s / 8s with action; one at a time; pause on hover/focus; always-mounted polite live region; inverse surface, `rounded-2xl`, action in text/brand-inverse, 44 touch; widths 358/400 (Q4); `useToast().show(...)`. Focus ring on ink: Q3.
- **Alert** (board 10, S48): offline (pending-subtle, wifi-slash icon in text/pending + text, exact GC-029 copy, `role="status"`); section error (error-subtle, warning icon, `role="alert"`); privacy (lock, text/muted, no live role); `rounded-xl`. OfflineBanner on `navigator.onLine === false` or `reportNetworkError()`, clears on `online`/`reportNetworkSuccess()`; Try again refreshes only when online; `useOnline()` hook.
- **Skeleton/SkeletonRegion/Spinner** (board 14): row (72, Q4) and block; pulse via theme animation, off under reduced motion; region `aria-busy`, nothing for 300ms, "Taking longer than usual." after 8s; Spinner CircleNotch `aria-hidden`.
- **Avatar/AvatarStack** (board 11, 19): face 36 (Q4)/40, profile 44 (Q4)/80; Unicode-safe initials; white fill, border/default `border-2` ring; `aria-hidden` beside a name, else `role="img"`; stack max 5, `-ml-6`, dashed missing circles (border/placeholder, Q1), one caller-supplied label; no email field in types.
- **Chip** (board 12): date, urgent (caller chooses until slice 4), label, meta (lock), count (brand, white ring, hidden at 0, "9+"); 29 tall (Q4), `rounded-lg`; always a `<span>`.
- **Header** (board 05, UwNav): top-level 48 tall, wordmark + profile avatar link, hidden ≥ 768 via `max-md:`; back variant: 44 icon "Back" + truncated title; ~~history back if same-origin, else parent href~~ (superseded 2026-11-03 (owner): the in-app Back always goes to the parent page; browser Back is unchanged).
- **AppShell** (board 05, UwNav, GC-006 C): Home (house), Exchanges (gift), Wishlists (list-heart), Activity (bell). BottomTabs < 768: 56 tall (Q4), fill icon + `aria-current` when active. Sidebar ≥ 768: surface/subtle, 240–280 wide (Q4), items 44 (Q4), active white pill, profile link at bottom. Activity Count chip, label "{Tab}, {n} unread". Active tab tap scrolls to top. `<nav aria-label="Main">`, `<main id="main">`, `hideTabs`, content max 1040 (Q4). Props have no email.
- Not found locally: Avatar photo visuals (deferred), Alert body text colour (text/default assumed; tester compares with S48), elevation values (Q2).
- Unsourced strings for copy-pending.md: "Back", "Main", "Profile and settings", "{Tab}, {n} unread", "9+", "Skip to content".

### Dependencies (versions: latest stable at install time)
| Package | Kind | Why | Status |
|---|---|---|---|
| next, react, react-dom | runtime | framework | approved (stack) |
| @phosphor-icons/react | runtime | icons | approved (stack) |
| typescript, @types/node, @types/react, @types/react-dom | dev | strict TS | approved |
| tailwindcss, @tailwindcss/postcss | dev | Tailwind v4 | approved |
| vitest | dev | unit tests | approved |
| eslint, eslint-config-next | dev | lint (CLAUDE.md requires lint, names no linter) | NEEDS APPROVAL (Q7) |

Not adding: tsx (Node native type stripping instead), clsx/tailwind-merge (local `cx`), Testing Library/jsdom, prettier, zod, date or dialog libraries. Version-sensitive for the builder: Next 16 `next lint`, Turbopack, Node minimum, `Viewport.interactiveWidget`, `pageExtensions`, `next/font/google` names; Tailwind v4 items above; eslint-config-next flat export; Node type stripping without a flag. No `proxy.ts` in 0a.

Risks: `tz` cookie is untrusted (validate via `Intl`, fall back to `Africa/Lagos`, refresh at most once per session, don't read `cookies()` in the root layout); no email fields in shell/avatar types; contrast rule applied (offline banner, inactive tabs, placeholders); focus on ink (Q3); gallery leaking to production (Q6); check-tokens false positives (fixtures + allow comment).

### Acceptance criteria
- AC-1 typecheck, lint, `tokens:check`, test, build pass locally and in CI.
- AC-2 `strict: true`; lint fails on `any` and on root Phosphor imports.
- AC-3 `styles/tokens.css` only from `tokens:build`, reproducible; `tokens:check` fails if edited or stale.
- AC-4 Sizing rename (`:25`→`0-25`, `:5`→`0-5`, `1:5`→`1-5` when present); collisions fail; design export unchanged.
- AC-5 Every Tokens colour is a `--color-*` theme var aliasing its primitive; primitives produce no utilities.
- AC-6 Off-scale utilities emit nothing (`p-5`, `rounded-[3px]`, `text-sm`).
- AC-7 `text-heading-1..5` switch mobile → desktop at the Q5 breakpoint; 28 `text-body-*` utilities match the export.
- AC-8 `check-tokens` fails with file:line on each rule fixture; passes on `href="#main"`, `href="#add"`, `tokens-allow` lines.
- AC-9 Fonts self-hosted via `next/font`; ₦ renders in Plus Jakarta Sans.
- AC-10 Viewport meta includes `interactive-widget=resizes-content`.
- AC-11 `tz` cookie set on first visit with one refresh; none when it matches; invalid values fall back to `Africa/Lagos`.
- AC-12 Button: 8 variants, all states; busy semantics; icon button needs a label (type error).
- AC-13 Field: linked visible label; error semantics, value kept; textarea counter and growth; 16px value.
- AC-14 Sheet: `<dialog>` `showModal`; sheet/dialog switch at 768; Esc; backdrop rules; busy; focus return; reduced motion; no swipe.
- AC-15 Toast: 4s/8s; pause/resume keeps remaining time; replaces previous; polite announcement.
- AC-16 Offline Alert within 1s of going offline or `reportNetworkError()`; exact GC-029 copy with icon; clears online; Try again only refreshes online.
- AC-17 Section error `role="alert"`; privacy Alert lock + muted, no live role.
- AC-18 SkeletonRegion: nothing before 300ms, `aria-busy`, slow line at 8s, no pulse under reduced motion.
- AC-19 Avatar sizes and initials; stack max 5, dashed missing, one label; no email props in Avatar/Sidebar/AppShell types.
- AC-20 Chip variants; count hidden at 0, "9+" above 9; not focusable.
- AC-21 AppShell switch at 768 (Q5); `aria-current` + fill icon; "{Tab}, {n} unread"; active tab scrolls to top; `hideTabs`; Header variants and Back behaviour.
- AC-22 Every interactive primitive shows the 2px/2px focus ring and works by keyboard alone.
- AC-23 Gallery route absent from `next build` route list (if approved).
- AC-24 No hex/px/arbitrary values outside `styles/tokens.css` except justified `tokens-allow`; no `.env` or secrets committed.
- AC-25 progress.md updated (open item 2 closed); copy-pending.md lists unsourced strings.

### Testing requirements
- Builder (Vitest, tests first): build-tokens (rename, collisions, alias resolution and failure, px→rem, line-height rounding, radius stripping, no primitive utilities, heading media query, determinism, supplement merge if Q1(b)); check-tokens (fixture per rule, negatives, allow comment, staleness); helpers (`countLabel`, `initials`, `getViewerTimeZone`, `pausable-timer` with fake timers, network-status reducer).
- Tester (gallery at 390/768/1440; Chrome plus Safari/iOS where possible): variants vs Spec boards 01, 02, 05, 07–12, 14; keyboard-only; screen reader (toast, alert roles, aria-busy, tab labels); DevTools offline; reduced motion; 200% zoom; mobile keyboard with a form sheet; `tz` override (one refresh); no console errors.
- No database work, so no security tests in 0a; no auth, so no signed-in click-through. Both stated in the build log. Axe and Playwright come in 0b.

### Assumptions
A1 npm + GitHub Actions. A2 PascalCase components, kebab-case helpers. A3 Esc closes destructive sheets too (Modal spec). A4 Sheet focus goes to its heading on open. A5 fixed 16 bottom padding (no `env()`). A6 Alert body text/default until compared with S48.

### Clarification questions
1. Missing tokens (see main session check above): re-export the JSON (recommended) or a committed `design/tokens-supplement.json`?
2. Values for surface/error-hover/pressed (red/600, red/700), surface/overlay (ink at 40%), elevation/overlay.
3. Focus ring on the ink Toast: may it use border/inverse (white)?
4. Component sizes not on the sizing scale: 44, 36, 56, 29, 14, 72, 96, 358, 400, 480, 240–280, 1040, 90%, −10. Add to the design file, a supplement with named size tokens, or other?
5. At exactly 768: Sidebar or BottomTabs? Do headings switch at the same point? (Proposal: both switch at 768; "judged against mobile designs" applies to page content.)
6. New dev-only route `/dev/components` and `/dev/shell`, excluded from production builds?
7. Approve eslint + eslint-config-next; Node native TS instead of tsx; npm.
8. Agree the deferrals above (money Field → slice 2, OtpInput → slice 1, dates → slice 4)?
9. May the builder make the first commit on `main` (docs, design, CLAUDE.md, .claude) so the slice branch can exist?

## Owner answers — main session — 2026-11-03
- Task: slice-0a — resolution of planner Q1–Q9
- Requirements: as planner round 1
- Files/components: `design/variables_tokens.json` (re-exported 11:03), docs/progress.md decisions, plan §3 and §8
- Work completed:
  - Q1/Q2 resolved by re-export (verified: 191 variables; all 20 previously missing tokens present; `elevation/overlay` = drop shadow 0 0 32 #191a1c29; `surface/overlay` = `neutral/900-40` #191a1c66; `red/600` #8f2222, `red/700` #6b1a1a). New size tokens: `size/avatar-sm` 36, `size/touch-target` 44, `size/control-lg` 56, `size/row` 72. The `sizing-5` token-name collision is still in the export; the rename stands. No supplement file needed for these.
  - Q3: focus ring on ink surfaces uses `border/inverse` (white).
  - Q5: Sidebar and desktop heading sizes from 768; below it, mobile.
  - Q6: gallery routes `/dev/components`, `/dev/shell` approved (dev builds only).
  - Q7: eslint + eslint-config-next approved; Node native TS for scripts; npm.
  - Q8: deferrals approved as proposed.
  - Q9: first commit made on `main` (95f0529); branch `slice-0a-foundation` created and checked out.
- Outstanding issues:
  - Sizes from Q4 still without tokens: chip height 29, skeleton line 14, textarea min 96, toast widths 358/400, dialog width 480, sidebar width 240–280, content max 1040, sheet max height 90%, badge offset −10. Awaiting owner decision.
  - Git has `core.autocrlf` on (commit warned LF→CRLF). Builder must add `.gitattributes` with `* text=auto eol=lf` in step 1 so the generated `styles/tokens.css` stays byte-identical and the freshness check is stable on Windows and CI.
- Next action: owner decides the remaining sizes; then builder starts.

## Owner answers (sizes) — main session — 2026-11-03
- Task: slice-0a — resolution of planner Q4 (remaining sizes)
- Requirements: as planner round 1
- Files/components: `design/variables_tokens.json` (re-exported again; 197 variables), Field, Toast, Sheet/Dialog, AppShell/Sidebar, Chip, Skeleton, BottomTabs/Sidebar badge
- Work completed (verified by reading the export):
  - New tokens: `size/textarea-min` 96, `size/toast-max` 400, `size/dialog` 480, `size/content-max` 1040, `size/sidebar-min` 240, `size/sidebar-max` 280. The sidebar flexes between min and max.
  - Owner: the other sizes need no tokens.
    - Mobile toast (358): full width inside `spacing/16` side margins, as the token description says.
    - Chip height (29): comes from the text line height plus padding tokens. No fixed height.
    - Skeleton line (14): use the line height of the text style it stands in for.
    - Sheet max height (90%): a percentage or viewport unit. The design-token check must allow `%`, `vh`/`dvh`/`svh` and `vw` units.
    - Badge offset (−10): position the badge relative to its icon using percentages or translate, matched visually to the design. Don't use a raw −10px.
  - The `sizing-5` name collision is still in the export; the rename in `scripts/build-tokens.ts` stands.
- Outstanding issues: None blocking. `.gitattributes` LF requirement (above) still applies.
- Next action: builder implements slice 0a per Planner round 1 plus both owner-answer sections.

## Builder — round 1 — 2026-11-03
- Task: slice-0a — App foundation (scaffold, tokens, primitives, AppShell, offline, tz cookie, CI)
- Requirements: Planner round 1 + both Owner answers sections; AC-1–AC-25
- Files/components:
  - Config: `.gitattributes`, `.gitignore`, `.nvmrc`, `package.json`/lock, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.github/workflows/ci.yml`
  - Tokens: `scripts/build-tokens.ts`, `scripts/check-tokens.ts`, `styles/tokens.css`
  - App: `app/` (layout, page, globals.css, fonts) and the dev gallery `app/dev/components`, `app/dev/shell` (`page.dev.tsx`)
  - Components: `components/ui/*`, `components/layout/*`
  - Lib: `lib/dates/timezone.ts`, `lib/dates/viewer-time-zone.ts`
  - Tests: `tests/unit/*` (3 files, 53 tests)
  - Docs: CLAUDE.md commands, progress.md, copy-pending.md (6 new strings)
- Work completed (builder-reported, run on Node 22.12): typecheck, lint, tokens:check, test (53) and build all pass; `/dev/*` absent from the production build; tokens.css regenerates identically; dev-server smoke returned 200 on the gallery routes.
- Decisions:
  - Scripts use `--experimental-strip-types` (Node 22.12) and `"type": "module"`; engines `>=22.13`.
  - Size and icon tokens are spacing keys; the token check allows `%`, viewport units and fractions.
  - The sidebar is `w-1/5 min-w-sidebar-min max-w-sidebar-max`.
  - Busy Button uses `aria-disabled`, not `disabled`.
  - Sheet is a native `<dialog>`; the destructive variant is an `alertdialog`.
  - `turbopack.root` is pinned in `next.config.ts`.
- Outstanding issues:
  - No browser or visual check and no comparison with the boards.
  - Interpretations for the owner to confirm: Avatar sizes (face 36/40, nav 44, profile 80), Header back variant at all widths, label/meta Chip colours, Alert body colour, toast and sheet padding.
  - No component tests: Testing Library and jsdom are not approved, so the tz cookie, Sheet, Toast, offline banner and SkeletonRegion need browser checks.
  - A busy submit Button doesn't block Enter; forms must guard pending state.
  - `npm audit` warnings were not investigated; eslint 9.39.5 is flagged "no longer supported".
  - The CI workflow has never run on GitHub.
- Next action: tester verifies AC-1–AC-25 (gallery at 390/767/768/1440, keyboard, offline, tz cookie, build checks).

## Tester — round 1 — 2026-11-03
- Task: slice-0a — verify App foundation against AC-1–AC-25
- Requirements: Planner round 1 ACs, Owner answers, CLAUDE.md DoD
- Files/components: whole slice tree. The tester changed no files; its two probes were deleted.
- Work completed (run by the tester on Node 22.12):
  - typecheck, lint, tokens:check, test (53/53) and build all pass.
  - tokens.css rebuild is byte-identical.
  - The dev routes return 200.
  - The probes proved:
    - lint rejects `any` and root Phosphor imports
    - tokens:check rejects hex, px, arbitrary values and inline style, with file:line
  - `/dev/*` is absent from the production output.
  - Verified in source:
    - the token rename, focus ring tokens and inverse ring on ink
    - 768 classes (`md:`/`max-md:`)
    - low-contrast tokens only appear with an icon or label
    - `.gitattributes` exists and there are no `.env` files
    - the viewport meta
- Verdict: PASS (conditional) — no failures, but no browser could be driven (Playwright not installed).
  - Verified: AC-1 (local), 2, 3, 4, 10, 23, 24, 25.
  - Partial: AC-5, 7, 8, 9.
  - Not verified (need a browser): AC-6, 11–22.
- Outstanding issues:
  - T1-1 (Low): `engines` `>=22.13` vs local Node 22.12 / `.nvmrc`.
  - T1-2 (Low): eslint 9.39.5 unsupported; `npm audit` not investigated.
  - T1-3 (Medium): a busy submit Button doesn't block Enter; fix in the shared Button or document it.
  - T1-4 (Medium, process): no component tests; browser checks pending.
  - CI never run on GitHub.
- Next action: reviewer round 1 (code review); in parallel, the owner decides how the browser checks get done. Slice stays open until they do.

## Reviewer — round 1 — 2026-11-03
- Task: slice-0a — code review of App foundation
- Requirements: AC-1–AC-25, Owner answers, plan §3/§4/§8, CLAUDE.md
- Files/components: whole slice tree
- Work completed: read all source/scripts/tests. Re-ran typecheck, lint, tokens:check and test (pass). Ran an in-memory probe of `scanSource` (scratchpad only).
- Verdict: CHANGES REQUIRED
- Findings:
  - R1-1 High — Button busy: a submit still fires on Enter; a busy link still navigates on keyboard. Keep `type`, `preventDefault` click when busy (Button.tsx:121-148).
  - R1-2 Med — TimeZoneCookie: `sessionStorage` throws when storage is blocked, which crashes the layout. Add try/catch, and refresh only if the cookie stuck.
  - R1-3 Med — Sheet: a second Esc / Android back bypasses busy (non-cancellable cancel), so the dialog and parent desync. Re-`showModal()` when busy/open.
  - R1-4 Med — check-tokens false negatives:
    - negative px
    - rem/em in CSS
    - `*` lines treated as comments
    - `outline-offset-3`/`underline-offset-3`/`decoration-3`/`inset-ring-3`/stroke
    - `bg-(color:--x)`
    - Add a fixture for each.
  - R1-5 Med — build-tokens: reset `--container-*`, `--blur-*`, `--text-shadow-*`, `--perspective-*` (`max-w-md` currently compiles). Add tests.
  - R1-6 Med — OfflineBanner: live region inserted with its content (not announced). Keep an always-mounted status wrapper; let Alert drop its role. "Try again" should clear a `reportNetworkError` banner.
  - R1-7 Med — SkeletonRegion: the slow-line status is inside `aria-busy`; move it to a sibling.
  - R1-8 Med — BackButton: `document.referrer` is wrong after client navigation. Track in-app navigation; `router.back()` only if the previous entry is in-app, else `router.replace(parentHref)`.
  - R1-9 Med — Toast: separate hover/focus pause reasons; move focus when a focused toast dismisses; the toast under an open Sheet is inert (top layer / popover).
  - R1-10 Med — progress.md: invalid status; open items not logged.
  - R1-11 Low — Node: `.nvmrc` `22` floats, engines `>=22.13`, local 22.12 (owner decision).
  - R1-12 Low — ESLint 9.39.5 EOL; `npm audit` not recorded (owner decision on upgrade).
  - R1-13 Low — CI actions v4 on the Node 20 runtime; add a concurrency group.
  - R1-14 Low — Tailwind scans tests into the production CSS; add `@source not` for tests/docs/scripts.
  - R1-15 Low — `AGENTS.md` (generated by `next dev`) untracked: commit or gitignore (owner decision).
  - R1-16 Low — textarea `field-sizing` has no Firefox fallback; CharacterCount goes stale on reset.
  - R1-17 Low — Sidebar `<aside>` → `<div>`/`<header>`; OfflineBanner outside landmarks.
  - R1-18 Low — desktop offline banner vs sticky `h-dvh` Sidebar overlap (browser check).
  - R1-19 Low — test uses `URL.pathname`; use `fileURLToPath`.
- Interpretations for the owner: Avatar sizes; Back header at all widths; Chip colours (~4.95:1); disabled secondary uses `border-surface-disabled` (no `border/disabled` token).
- Outstanding issues: browser checks AC-6, AC-11–22 still open; iOS keyboard vs the pinned Sheet footer needs a device check.
- Next action: builder round 2 fixes R1-1–R1-10, R1-13, R1-14, R1-16, R1-17, R1-19. R1-11, R1-12 and R1-15 await the owner. Then tester round 2, then reviewer round 2.

## Builder — round 2 — 2026-11-03
- Task: slice-0a — fix R1-1–R1-10, R1-13, R1-14, R1-16, R1-17, R1-19
- Requirements: Reviewer round 1, Tester round 1
- Files/components:
  - New: `components/ui/ButtonControl.tsx` (client busy guard), `components/ui/top-layer.ts`, `components/layout/in-app-navigation.tsx`
  - Modified:
    - components: Button, Sheet, Toast, CharacterCount, Alert, SkeletonRegion, TimeZoneCookie, OfflineBanner, BackButton, Sidebar
    - app: `app/layout.tsx`, `app/globals.css`
    - tokens: `scripts/check-tokens.ts`, `scripts/build-tokens.ts`, `styles/tokens.css` (regenerated)
    - CI and tests: `ci.yml`, both unit test files
    - docs: `docs/progress.md`
- Work completed (builder-reported, Node 22.12):
  - typecheck, lint, tokens:check, test (59/59) and build all pass.
  - Fixes:
    - R1-1: busy keeps `type` and calls `preventDefault` on click/link.
    - R1-2: try/catch, and refresh only if the cookie stuck.
    - R1-3: re-`showModal()` when busy.
    - R1-4: 5 new rules with tests.
    - R1-5: resets with a test; no `max-w-md` in the built CSS.
    - R1-6: always-mounted status wrapper; "Try again" reports success.
    - R1-7: status region is a sibling.
    - R1-8: in-app navigation counter; `back()` vs `replace(parent)`.
    - R1-9: separate pause refs; focus restore; toast region is `popover="manual"`, re-shown when a Sheet opens.
    - R1-10: progress.md status In progress; open items 4–12.
    - R1-13: checkout/setup-node v5 (versions from memory, unverified); concurrency group.
    - R1-14: `@source not`.
    - R1-16: CharacterCount reset fixed; Firefox auto-grow logged (item 11).
    - R1-17: `<div>`.
    - R1-19: `fileURLToPath`.
- Outstanding issues:
  - No browser check. R1-1, 3, 6, 7, 8 and 9 are verified only by typecheck and lint.
  - A toast under an open Sheet is visible but its action is inert (item 12).
  - R1-11, R1-12 and R1-15 await the owner.
- Next action: tester round 2 retests the affected areas.

## Tester — round 2 — 2026-11-03
- Task: slice-0a — retest round-2 fixes; full suite
- Requirements: Reviewer round 1, Builder round 2
- Files/components: check-tokens, build-tokens, Button/ButtonControl, Sheet, Toast, SkeletonRegion, TimeZoneCookie, OfflineBanner, BackButton, ci.yml, progress.md. No project files changed; probes deleted; tokens.css restored.
- Work completed (tester-run, Node 22.12):
  - typecheck, lint, tokens:check, test (59/59) and build pass; tokens.css is byte-identical on rebuild.
  - Probes: 8 of the 9 required cases are flagged; legitimate cases pass.
  - Built CSS has no `max-w-md`, `--container-md` or test fixtures.
  - Code review confirms R1-1, 2, 3, 5, 6, 7, 8, 9, 10, 14 and 19 as intended. Button is still server-renderable; no nested buttons; focus ring kept.
  - Runtime behaviour is browser-only.
- Verdict: FAIL
- Outstanding issues:
  - T2-1 (Medium, R1-4): `isCommentLine` skips a CSS line beginning `* {`, so `* { color: #f00 }` is not flagged. Track `/* … */` block state instead, and add a fixture.
  - CI action versions (v5) are unverified (no `gh`, no network); YAML not machine-validated.
  - R1-16 CharacterCount reset and R1-17 not exercised.
  - Browser-only items still open.
- Next action: builder fixes T2-1; tester retests check-tokens; then reviewer round 2.

## Builder — round 3 — 2026-11-03
- Task: slice-0a — fix T2-1 (`* {` CSS lines skipped as comments)
- Requirements: Tester round 2 T2-1
- Files/components: `scripts/check-tokens.ts`, `tests/unit/check-tokens.test.ts`
- Work completed (builder-reported, Node 22.12):
  - `isCommentLine` replaced by `classifyLine` with `inBlock` state across lines. `*` lines outside a block are scanned as code.
  - 4 must-flag fixtures and 2 must-pass fixtures added; the old bare ` * 44px` fixture moved inside a block.
  - typecheck, lint, tokens:check, test (60/60) and build all pass.
- Outstanding issues: code after `*/` on the same line is not scanned (known limitation). Browser checks still open.
- Next action: tester retests check-tokens; then reviewer round 2.

## Tester — round 3 — 2026-11-03
- Task: slice-0a — narrow retest of T2-1
- Requirements: Tester round 2 T2-1, Builder round 3
- Files/components: `scripts/check-tokens.ts`, its tests (read only). Probes deleted; tokens.css restored; git status clean of probes.
- Work completed (tester-run, Node 22.12):
  - typecheck, lint, tokens:check, test (60/60) and build all pass.
  - Every must-flag probe was flagged (all `*` selector variants, post-comment hex, negative px, rem/em, off-scale offsets, typed arbitrary variable). No must-not-flag probe was flagged.
  - Whole tree passes; tokens.css rebuild is byte-identical.
- Verdict: PASS
- Outstanding issues:
  - Low: code after `*/` on the same line is not scanned (missed-violation direction; rare with the repo's formatting). Optional hardening later.
  - Carried over: CI v5 versions unverified; R1-16/R1-17 not exercised; browser checks open.
- Next action: reviewer round 2.

## Reviewer — round 2 — 2026-11-03
- Task: slice-0a — re-review after Builder rounds 2–3
- Requirements: R1-1–R1-19, T2-1, AC-1–AC-25
- Files/components: all changed components, scripts, ci.yml, progress.md
- Work completed: read all changed files; re-ran typecheck, tokens:check and test (60/60). Compiled CSS confirms the toast popover overrides.
  - Resolved: R1-1, 2, 3, 4/T2-1, 5, 6, 7, 9, 10, 13 (v5 valid as far as known), 14, 16, 17, 19.
  - No dead code.
- Verdict: CHANGES REQUIRED
- Findings:
  - R2-1 Med — in-app-navigation counter never decreases on popstate. External entry → `/b` → back → in-app Back calls `router.back()` and leaves the app (R1-8 not resolved). Track depth per history entry via a `history.state` marker.
  - R2-2 Low — Sheet busy re-open doesn't refocus the heading (may land on a destructive button) and replays the entrance animation.
  - R2-3 Low — Sidebar profile link `aria-label` replaces the visible name (WCAG 2.5.3).
  - R2-4 Low — `show()` replacing a toast that holds focus drops focus to `<body>`.
  - R2-5 Low — progress.md note stale; check-tokens same-line-after-`*/` gap not logged.
  - Suspicion: toast popover hide/show may re-announce — add to the item-4 screen-reader pass.
- Outstanding issues: not Done until open items 4–5 (browser, iOS) run; CI never run (item 6).
- Next action: builder round 4 fixes R2-1–R2-5; tester retests; reviewer round 3 scoped to those files.

## Builder — round 4 — 2026-11-03
- Task: slice-0a — fix R2-1–R2-5
- Requirements: Reviewer round 2
- Files/components:
  - New: `components/layout/history-depth.ts`, `tests/unit/history-depth.test.ts`
  - Rewritten: `components/layout/in-app-navigation.tsx`
  - Modified: `app/layout.tsx` (Suspense around the tracker), `app/globals.css`, Sheet, Toast, Sidebar, progress.md
- Work completed (builder-reported, Node 22.12):
  - typecheck, lint, tokens:check, test (67/67, 4 files) and build all pass.
  - R2-1:
    - Each entry is stamped with `unwrapDepth` via `replaceState`, spreading the existing state. Depth is resolved by the pure `resolveDepth`; keyed on pathname + search.
    - Next 16 `app-router.js` read: custom keys are kept and traversal doesn't rewrite them.
  - R2-2: the busy re-open refocuses the heading; `data-reopened` skips the animation.
  - R2-3: Sidebar `aria-label` removed. "Profile and settings" is still used by the Header avatar link, so copy-pending is unchanged.
  - R2-4: shared `restoreFocus` in `show()` and `dismiss()`.
  - R2-5: note updated; open item 13 (check-tokens same-line gap).
- Outstanding issues:
  - A same-entry Next state rewrite (refresh with `preserveCustomHistoryState: false`) might wipe the stamp. A later return could then overstate depth, and `router.back()` could leave the app. Unverified.
  - Browser checks still open.
- Next action: tester round 4; then reviewer round 3 scoped to these files.

## Tester — round 4 — 2026-11-03
- Task: slice-0a — retest R2-1–R2-5
- Requirements: Reviewer round 2
- Files/components: history-depth, in-app-navigation, its tests, Sheet, Toast, Sidebar, layout, globals.css, progress.md (read-only)
- Work completed (tester-run, Node 22.12):
  - typecheck, lint, tokens:check, test (67/67) and build pass; routes still static; tokens.css byte-identical.
  - R2-2, R2-3, R2-4 and R2-5 are correct in code.
- Verdict: FAIL
- Outstanding issues:
  - T4-1 (Med): Next 16.4.4 `router.refresh()` rewrites `history.state` without custom keys (`preserveCustomHistoryState: false` → `HistoryUpdater` `replaceState`), so `unwrapDepth` is wiped. The tracker only re-stamps on a pathname/search change.
    - `TimeZoneCookie` refreshes on first visit, so: entry wiped → push → back resolves depth 2 → in-app Back leaves the app.
    - Fix: re-attach the marker after any state rewrite; add a test that wipes a stamp.
  - Test gaps G1–G5:
    - G1: no stamp-wipe case
    - G2: same-URL/hash entries not re-stamped
    - G3: reload of a depth-0/unstamped entry
    - G4: cross-origin hop
    - G5: tracker/`hasInAppHistory` untested
  - Browser checks open.
- Next action: builder fixes T4-1 (+G1, G3); tester retests; reviewer round 3.

## Builder — round 5 — 2026-11-03
- Task: slice-0a — fix T4-1 (refresh wipes the `unwrapDepth` stamp)
- Requirements: Tester round 4 T4-1; R1-8
- Files/components: `components/layout/history-depth.ts`, `components/layout/in-app-navigation.tsx`, `tests/unit/history-depth.test.ts`
- Work completed (builder-reported, Node 22.12):
  - typecheck, lint, tokens:check, test (74/74) and build all pass.
  - Pure `mergeDepth(state, url, currentHref, stamped)` re-attaches the marker on a same-entry `replaceState` that lacks it.
  - `history.replaceState` is wrapped once at module load (flag on a `Symbol.for` holder on `window`, so it survives HMR and StrictMode). Next's patch captures the wrapper as its original. `pushState` is not wrapped.
  - Tests added: `mergeDepth` cases, G1 (refresh wipe → push → back → 0) and G3 (reload cases).
- Outstanding issues:
  - Not exercised against a real browser or real Next.
  - The wrap relies on Next capturing `replaceState` after the module loads.
  - Unstamped entries still count as new (they can overstate depth).
  - Fallback is the owner's decision if the browser check fails.
- Next action: tester round 5; then reviewer round 3.

## Tester — round 5 — 2026-11-03
- Task: slice-0a — retest T4-1 (`replaceState` wrap)
- Requirements: T4-1, G1, G3; R1-8
- Files/components: in-app-navigation, history-depth, its tests, BackButton, layout, Next `app-router.js` (read-only)
- Work completed (tester-run, Node 22.12):
  - typecheck, lint, tokens:check, test (74/74) and build pass; routes static; tokens.css byte-identical.
  - Dev `GET /` returns 200 with no log errors. Edge headless gave no DOM output, so there is no browser evidence.
  - By reading Next 16.4.4: Next patches `replaceState` in an AppRouter `useEffect`, and its refresh calls `window.history.replaceState` at call time. So the wrap is hit whichever installs first. Cleanup could drop the wrap only on an AppRouter unmount (HMR); low risk.
  - `mergeDepth` handles T4-1, G1 and G3; no stale merge after a push; Next keys preserved; SSR-safe.
- Verdict: PASS
- Outstanding issues:
  - T5-1 (Low): the tracker doesn't re-run on hash-only/same-href traversal, so a stale depth is possible via hash links.
  - The module-load comment overstates the ordering.
  - Test gaps G2, G4 and G5 remain.
  - Real-browser Back check open.
- Next action: reviewer round 3 (scoped to Builder rounds 4–5 files).

## Reviewer — round 3 — 2026-11-03
- Task: slice-0a — re-review of Builder rounds 4–5
- Requirements: R2-1–R2-5, T4-1, T5-1
- Files/components: history-depth, in-app-navigation, BackButton, history-depth tests, layout, globals.css, Sheet, Toast, Sidebar, progress.md; Next `app-router.js`, `app-router-state.js` (read)
- Work completed: vitest 74/74 and tsc clean (reviewer-run). R2-2, R2-3, R2-4, R2-5 and T4-1 resolved in code.
- Verdict: CHANGES REQUIRED
- Findings:
  - R3-1 Med — `router.replace` (including BackButton's own fallback) is counted as a new entry. So: deep link → Back (replace to parent, stamped depth 1) → Back → `router.back()` leaves the app.
  - R3-2 Low — the Skip link `#main` creates hash entries that the tracker never re-resolves (T5-1 reachable). Suspected Next null-state popstate issue → add to the browser pass.
  - R3-3 Low — the module-load comment overstates ordering; the wrap is lost on an AppRouter remount.
  - R3-4 Low — progress.md stale; add an open item for the Back decision.
  - R3-5 Low — tests lack replace, hash and wrap-integration cases.
- Recommendation to the owner: replace the history-depth approach with the fallback (in-app Back always goes to `parentHref`).
  - The history rule comes from the planner spec (line 85), not a user story.
  - Each round has found a new hole, and it depends on Next internals.
  - If adopted: remove history-depth.ts, its tests, the tracker, `hasInAppHistory` and the Suspense wrapper, and update the spec line.
  - Variants: `push` or `replace`.
- Outstanding issues: owner decision on Back; R1-11/12/15; open items 4–6.
- Next action: owner decides the Back approach; builder implements; tester; reviewer round 4.

## Owner answers (round 3) — main session — 2026-11-03
- Task: slice-0a — owner decisions after Reviewer round 3
- Requirements: R3-1–R3-5, R1-11, R1-12, R1-15, open item 4
- Files/components: BackButton, history-depth, in-app-navigation, layout, package.json, .nvmrc, eslint, .gitignore/AGENTS.md
- Work completed (owner decisions, Tobechukwu Olih):
  - Back: the in-app Back always does `router.push(parentHref)`. The history-depth approach is dropped. This supersedes the planner spec line "history back if same-origin, else parent href". R3-1, R3-2, R3-3 and R3-5 become moot once the code is removed.
  - Browser checks: add Playwright + `@axe-core/playwright` now (already approved for 0b), so the tester can run the gallery checks.
  - Node: the owner upgrades local Node to the current 22 LTS (≥22.13). Pin that exact version in `.nvmrc` and match `engines`.
  - ESLint: try ESLint 10 if `eslint-config-next` supports it; run `npm audit` and record the results.
  - AGENTS.md: commit it (not gitignored).
- Outstanding issues: owner interpretations (open item 10) still open.
- Next action: builder round 6.

## Builder — round 6 — 2026-11-03
- Task: slice-0a — implement owner round-3 decisions
- Requirements: Owner answers (round 3); AC-11, 12, 14, 15, 16, 18, 21, 22
- Files/components:
  - Deleted: BackButton, history-depth (+ tests), in-app-navigation
  - Changed:
    - components: Header (Back is a `Button` link), Toast, NavLinks
    - app: layout; dev gallery fixtures (FormBusyDemo, busy link)
    - e2e: `playwright.config.ts`, `tests/e2e/{gallery,shell,visual}.spec.ts`
    - config: package.json/lock, .gitignore, ci.yml, .nvmrc (22.23.4)
    - docs: CLAUDE.md (e2e command), progress.md, planner Back line marked superseded
- Work completed (builder-reported, Node 22.12):
  - typecheck, lint, tokens:check, test (60/60), build (static) and e2e (69/69 = 23 × 390/768/1440) all pass.
  - Bugs found by e2e and fixed:
    - Toast Undo dismissed its own follow-up toast.
    - NavLinks had an axe label-content-name mismatch.
    - Header profile link failed 2.5.3 (now sr-only text).
  - Screenshots saved to `test-results/screenshots/`.
  - ESLint stays on 9: plugins only support ^9, and ESLint 10 needs Node ≥22.13.
  - `npm audit`: 16 moderate, dev-only (minimatch via the eslint chain); no `--force`. Recorded in open item 8.
  - AGENTS.md doesn't conflict with CLAUDE.md.
- Outstanding issues:
  - The Sheet double-Esc re-show path isn't exercised: headless Chromium never closed the dialog.
  - `aria-current` not in e2e (unit-tested).
  - CI e2e never run.
  - Human checks still needed: board comparison, screen reader, iOS keyboard, desktop offline banner vs Sidebar.
  - The owner must install Node 22.23.4.
- Next action: tester round 6.

## Tester — round 6 — 2026-11-03
- Task: slice-0a — retest Builder round 6 (first browser run)
- Requirements: Owner answers (round 3); AC-1–AC-25
- Files/components: e2e specs, playwright config, ci.yml, layout and ui components. Probes deleted; tokens.css restored.
- Work completed (tester-run, Node 22.12):
  - typecheck, lint, tokens:check, test (60/60), build (static, no `/dev`) and e2e (69/69) all pass; tokens.css byte-identical.
  - Back code fully removed.
  - No `.only`/`skip`/`fixme`; axe uses the WCAG 2.1 A/AA tags with no rules disabled.
  - Probes verified:
    - AC-6: off-scale utilities emit nothing.
    - AC-9: ₦ renders in Plus Jakarta Sans (CDP).
    - AC-13: Field states.
    - AC-17: Alert roles.
    - AC-19: Avatar 36/44/80.
    - AC-20: Chips.
    - 767/768 switch: headings 30→48.
    - No horizontal scroll at 390; Back is a 44×44 link.
  - Sheet: Esc while busy is held in Chromium, even with user activation between presses.
  - Screenshots regenerated in `test-results/screenshots/`.
- Verdict: PASS
- Outstanding issues:
  - T6-1 (Med, AC-16/R1-18): at 1440 the sticky offline banner overlays the top of the Sidebar (Home item). Needs a design decision against board S48.
  - T6-2 (Low): some e2e assertions are weaker than the AC wording (1s bound, 2px ring/offset, Button variants, 4s/8s).
  - T6-3 (Low): axe only covers default states.
  - Other gaps: `aria-current` and scroll-to-top not browser-verified; dev-server "stream errored" log noise; the e2e suite runs on `next dev`.
  - Needs a human: board comparison, Safari/iOS keyboard, screen reader, CI run.
- Next action: reviewer round 4; owner decides T6-1.

## Reviewer — round 4 — 2026-11-03
- Task: slice-0a — re-review of Builder round 6
- Requirements: Owner answers (round 3); R3-1–R3-5; T6-1–T6-3
- Files/components: Header, NavLinks, Toast, layout, gallery fixtures, playwright config, e2e specs, ci.yml, .nvmrc, package.json, CLAUDE.md, progress.md, copy-pending.md
- Work completed:
  - Reviewer-run: typecheck, lint, tokens:check and vitest 60/60.
  - No leftover Back code; R3-1/2/3/5 moot.
  - Approved as sound:
    - the Toast Undo order
    - Header Back as a link
    - Header sr-only name
    - NavLinks `flex-col-reverse` (WCAG 1.3.2/2.4.3 OK)
    - e2e honesty
    - `E2E_PORT`
    - the ESLint 9 decision
    - the Node pin, which doesn't break 22.12
- Verdict: CHANGES REQUIRED (code alone would be approved)
- Findings:
  - R4-1 High — progress.md: open-item text had overwritten slice rows 4, 7, 8 and 9. FIXED by the main session: rows restored; items 4 and 7–9 updated; items 14 (T6-1) and 15 (T6-2/T6-3) added.
  - R4-2 Low — CLAUDE.md Commands: Node line and e2e line inconsistent.
  - R4-3 Low — CI: no `timeout-minutes`, no trace, no failure artifact upload.
  - R4-4 Low — the AC-22 test overclaims (12 Tab stops; width > 0 instead of 2px).
  - R4-5 Low — copy-pending "Profile and settings" should list only Header.
  - R4-6 Low — `toast.action!` non-null assertion.
- Recommendation for T6-1: from 768 up, render the banner sticky inside the content column (right of the Sidebar). Confirm against board S48.
- Next action: builder round 7 (R4-2–R4-6); tester re-runs e2e (config changed); short reviewer round 5.

## Builder — round 7 — 2026-11-03
- Task: slice-0a — fix R4-2–R4-6
- Requirements: Reviewer round 4
- Files/components: CLAUDE.md (Commands line), ci.yml, playwright.config.ts, tests/e2e/gallery.spec.ts, copy-pending.md, Toast.tsx, progress.md (0a note)
- Work completed (builder-reported, Node 22.12):
  - typecheck, lint, tokens:check, test (60/60), build (static) and e2e (69/69) all pass.
  - R4-2: Commands line fixed.
  - R4-3: `timeout-minutes: 20`; `upload-artifact@v7` on failure (v7.0.2 verified via the GitHub API); trace retain-on-failure; fonts comment.
  - R4-4: AC-22 now tabs until wrap (bound 120, >20 controls) and asserts a 2px solid outline with 2px offset; all pass. The Next dev overlay counts as end of page.
  - R4-5: Header only.
  - R4-6: non-null assertion removed.
- Outstanding issues: checkout/setup-node at v5 while v7 exists (unchanged, as instructed); CI never run.
- Next action: tester round 7 (e2e + CI file); reviewer round 5.

## Tester — round 7 — 2026-11-03
- Task: slice-0a — narrow retest of Builder round 7
- Requirements: R4-1–R4-6
- Files/components: gallery.spec.ts, ci.yml, playwright.config.ts, CLAUDE.md, progress.md, copy-pending.md, Toast.tsx
- Work completed (tester-run, Node 22.12):
  - typecheck, lint, tokens:check, test (60/60) and build pass; tokens.css byte-identical.
  - AC-22 test sound (the dev-overlay stop is justified).
  - ci.yml parses (js-yaml): timeout and failure artifact present; trace retain-on-failure set.
  - R4-1, R4-2, R4-5 and R4-6 confirmed.
- Verdict: FAIL
- Outstanding issues:
  - T7-1 (Med): full `npm run e2e` is flaky — run 1: 63/69, run 2: 67/69, with different tests each time (AC-12, 14, 15, 16). The targeted subset passes (36/36).
    - AC-16 strict-mode violation: two "Try again" buttons inside `role=status`.
    - 5s timeouts under `next dev` with 3 parallel projects.
- Next action: builder fixes T7-1; tester runs the full e2e twice in a row; reviewer round 5.

## Owner answers (round 4) — main session — 2026-11-04
- Task: slice-0a — owner approvals
- Requirements: open items 1, 10, 14
- Files/components: docs/copy-pending.md, OfflineBanner/AppShell, progress.md
- Work completed (owner decisions, Tobechukwu Olih):
  - All copy-pending labels approved.
  - Builder interpretations approved as built.
  - T6-1: from 768 up, the offline banner sits sticky inside the content column (right of the Sidebar).
  - The owner installed Node. Verified locally as v26.13.0, not the pinned 22.23.4; pin to be settled.
- Outstanding issues: Node pin vs local 26.13.0; T6-1 implementation; human checks (iOS keyboard, screen reader, first CI run).
- Next action: after builder round 8, the builder implements T6-1 (and the Node pin once decided).
- Node decision (owner, 2026-11-04): pin Node 26.13.0 (current LTS, matches the local machine). Supersedes the 22.23.4 pin. Builder updates `.nvmrc`/`engines`/CLAUDE.md, checks `--experimental-strip-types` on 26, and re-runs all checks on 26.
- Human checks (owner, 2026-11-04): iOS keyboard, screen reader (including offline) and board comparison done and passed. Remaining human item: first CI run on GitHub (needs a push/PR). Owner asked to round up the slice.

## Stopped by owner — main session — 2026-11-04
- Task: slice-0a — owner ended testing and review to move forward
- Requirements: CLAUDE.md "Definition of done"
- Files/components: whole slice tree (uncommitted)
- Work completed:
  - The owner instructed all slice-0a tests and reviews to stop. Builder round 8 was stopped mid-verification and its leftover dev server (port 3100) shut down.
  - Round 8 code changes were on disk (e2e warm-up/global setup and config, the T6-1 banner in the content column with a new e2e assertion, the Node 26.13.0 pin) but were never reported, tested or reviewed.
  - The builder's last note: "Run 1 failed once" — the full e2e suite was still not reliably green.
- Outstanding issues (carried into the slice as known risks):
  - Round 8 changes unverified by tester/reviewer.
  - e2e flakiness (T7-1) unresolved.
  - CI never run.
  - Latest test verdict: FAIL (Tester round 7). Latest review: CHANGES REQUIRED (Reviewer round 4; docs/config only, code approved).
- Status: slice 0a is NOT "Done" under CLAUDE.md; recorded as "In review — stopped by owner, unverified".
- Next action: owner decides on commit; slice 0b.
