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
- **Header** (board 05, UwNav): top-level 48 tall, wordmark + profile avatar link, hidden ≥ 768 via `max-md:`; back variant: 44 icon "Back" + truncated title; history back if same-origin, else parent href.
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
