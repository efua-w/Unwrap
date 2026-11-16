# detail-header — exchange title beside the avatar on desktop

## Owner request — 2026-11-16 (Tobechukwu Olih)

On the exchange detail page, desktop only, for both the organiser and the participant view: put the exchange title to the right of the exchange avatar, on the same row. The two subtext lines (for example "Names are drawn on Fri 27 Nov." and "Organised by … · Everyone spends …") stay below, starting under the avatar (left edge of the header, not indented under the title). Mobile is unchanged.

Logged as its own change (not folded into the open `organiser-emails` work). Own branch and commit.

## Main session — round 1 — 2026-11-16
- Task: detail-header — desktop header row on the exchange detail page
- Requirements: owner request above; boards Exchange-Detail-*-d (Part 1 and Part 2). Stories touched: GC-013, GCO-004 (detail page header). No copy change.
- Files/components: `features/exchanges/components/ExchangeJustStarted.tsx`, `features/exchanges/components/ExchangeMemberView.tsx`
- Work completed: boards refreshed and diffed (below); desktop/mobile header read from the boards; tokens matched; header components and callers found.
- Outstanding issues: see "Open points".
- Next action: owner approves the spec; builder makes the change; tester checks 390 / 768 / 1440.

### Board refresh (verified, 2026-11-16)

Previous copies saved to `scratchpad/old-boards-4`. Both canvases re-saved in full (`project/*`).

- New boards: none. Removed boards: none.
- Part 2 (9pHtZC2Z3ctDbsbghVkCKG), 75 changed, all desktop (`-d`), and all the same edit (avatar + h1 moved into one row):
  - Exchange-Detail-*-d: before, nolist, oattached, obefore, oclosed, ocomplete, odrawn, ofew, ofewoffline, ofewready, ofewreq, ofewsoon, oideas, ojust, orepair, ostarted, started (17)
  - Org-* boards that render the detail page behind a sheet/modal: Org-Cancel (8), Org-Complete (5), Org-Draw (8), Org-Drawn-justexchange, Org-Hand (9), Org-Invite (12), Org-Nudge (5), Org-Reopen-block / -done, Org-Repair (9)
- Part 1 (VAgJERFNKxRU1Y96njz8Ue), 18 changed:
  - Exchange-Detail-*-d: before, changed, complete, copied, drawn, hidden, nolist, obefore, ocomplete, odrawn, ofailed, offline, ojust, orepair, passed, revealed, started (17), same header edit
  - Exchange-Detail-before-m: markup only (`&#39;` written as `'`); nothing visible changed
- Exchange-Detail-loading-d and -error-d did not change (no header in them).

## Spec

### Desktop (from every changed Exchange-Detail-*-d board)

Board markup:

```
<header flex-col gap 12px>
  <div flex row, gap 12px, align-items center>
    UwAvatar kind=exchange 48x48
    <h1 Bona Nova 400, 36px, line-height 1.3>
  </div>
  <div flex-col gap 4px>
    <p 16px / 1.5, #191a1c>   e.g. "Names are drawn on Fri 27 Nov."
    <p 14px / 1.5, #6b6b6e>   e.g. "Organised by … · Everyone spends …"
  </div>
</header>
```

| Property | Board value | Token / class already in code |
|---|---|---|
| Avatar | 48 × 48, rounded | `ExchangeTag size="header"` (`size-48 rounded-lg`) |
| Avatar to title gap | 12px | `gap-12` (`--spacing-12` = `--sizing-6` = 0.75rem) |
| Vertical alignment | `align-items: center` (title centred on the avatar) | `items-center` |
| Title | Bona Nova 400, 36px, line-height 1.3 | `text-heading-2` (2.25rem / 1.3 at `>= 48rem`) |
| Row to subtext gap | 12px (header gap) | `gap-12` on `<header>` |
| Between the two subtext lines | 4px | `gap-4` (`--spacing-4` = `--sizing-3` = 0.25rem) |
| Subtext line 1 | 16px / 1.5, regular, #191a1c | `text-body-base-regular text-text-default` |
| Subtext line 2 | 14px / 1.5, regular, #6b6b6e | `text-body-sm-regular text-text-muted` |
| Subtext left edge | under the avatar (header's left edge) | the subtext block is a sibling of the row, not inside it |

### Mobile (unchanged)

The mobile boards did not change. Avatar on its own line, then one column (gap 4px) with h1 + both subtext lines; header gap 12px. That is what the code renders today.

### Breakpoint

The app shell switches to the desktop sidebar at `md` (48rem), and `text-heading-2` switches to 36px at the same point. Use `md:` for the row. 768 is judged against the mobile design (CLAUDE.md), so see open point 1.

### Proposed markup (both components, same change)

Keep a single `<h1>` at both widths (no duplicate heading, no hidden copy). Starting shape:

```tsx
<header className="flex flex-col items-start gap-12">
  <div className="flex min-w-0 flex-col items-start gap-12 md:flex-row md:items-center">
    <ExchangeTag ... size="header" />
    <h1 className="min-w-0 break-words text-heading-2">{exchange.name}</h1>
  </div>
  <div className="flex min-w-0 flex-col gap-4">
    <p className="text-body-base-regular text-text-default">…</p>
    <p className="text-body-sm-regular text-text-muted">…</p>
  </div>
</header>
```

Mobile spacing check for that shape: avatar to title would become 12px (row gap) and title to line 1 would become 12px, where the mobile board has 12px and 4px. To keep mobile exact, use `gap-4` between the title and subtext on mobile only, for example: header `flex flex-col gap-4 md:gap-12`, row `flex flex-col items-start gap-12 md:flex-row md:items-center` (mobile: avatar, 12, title, 4, subtext = board). The builder confirms both widths in the browser.

- Long names: the title wraps beside the avatar (`min-w-0 break-words`); the avatar stays 48 and does not shrink (`ExchangeTag` is fixed size; add `shrink-0` if it squeezes).
- No new tokens, no arbitrary values, no copy, no data change. Pair secrecy and visibility are unaffected (presentation only).

## Files to change

1. `features/exchanges/components/ExchangeJustStarted.tsx` — organiser view, header at lines 42–54.
2. `features/exchanges/components/ExchangeMemberView.tsx` — participant view, header at lines 31–42.

The two headers are identical copies. Either change both in the same commit, or (simpler to keep in step, per "fix in the shared place") extract a small `ExchangeDetailHeader` in `features/exchanges/components/` that both render. Builder's choice; the owner should say if a new file is unwanted.

Callers (verified by grep): both components are rendered only from `app/(app)/exchanges/[id]/page.tsx` (line 73 `ExchangeMemberView`, line 75 `ExchangeJustStarted`). No other imports.

Not touched: `ExchangeTag` (31 other usages), the page's loading skeleton (`page.tsx` lines 36–42; Exchange-Detail-loading-d did not change), `LoadError`, `NotAvailable`.

Tests: no unit test covers this layout. Add or update an e2e/screenshot check of the detail header at 1440 (row) and 390 (stacked) for both roles.

## Open points

1. Tablet (768): `md:` puts the row on at 768, where CLAUDE.md says to judge against the mobile design. Owner to confirm `md` (matches the sidebar switch) versus `lg`.
2. Existing gap, not in this change: mobile boards set the h1 to 30px, but `text-heading-2` is 24px below `md`. Logged here only; fix separately if the owner wants.

## Builder — round 1 — 2026-11-16
- Task: detail-header — exchange title beside the avatar on desktop
- Requirements: owner request above; boards Exchange-Detail-*-d. Open point 1 decided by the main session: row starts at `md` (plan §8: md is the only breakpoint, where the sidebar appears; `tokens:check` refuses `lg`). **768 therefore shows the desktop header.** Open point 2 left alone.
- Files/components: new `features/exchanges/components/ExchangeDetailHeader.tsx` (one `<h1>`, avatar + title row, subtext block outside the row); `ExchangeJustStarted.tsx` and `ExchangeMemberView.tsx` now render it (unused ExchangeTag imports removed). Mobile: header gap-4, row gap-12 (board 12/4); `md:` row, items-center, header gap-12.
- Work completed: typecheck, lint, tokens:check pass; `npm test` 16 files / 331 tests pass. No `npm run build`.
- E2E (E2E_PORT=3000, --workers=1, shared with another tester's run): two full runs of exchanges-signed-in + invite-join-signed-in gave 46 passed / 11 failed and 48 passed / 9 failed, with different failing tests each time. Errors were sign-in `waitForURL` timeouts and `ENOENT` in the shared `test-results` dir (the parallel run), none an assertion on the header. Targeted rerun (own --output dir) of "organiser just organising" and "new joiner": organiser at 390/768/1440 and participant at 390 pass; participant at 768 and 1440 failed on the Add-an-item sheet staying busy (before the page renders), same contention pattern. Not a clean green; a rerun on a quiet server is needed.
- Screenshots (test-results/screenshots): exchange-ojust-mobile-390 (avatar above title, unchanged), exchange-ojust-tablet-768 and -desktop-1440 (avatar and title on one row, centred; both subtext lines start at the avatar's left edge). Participant: exchange-member-mobile-390 only; the participant 768/1440 header uses the same component. Board comparison at 1440 was by the spec values (48 avatar, 12 gap, 36 title, 12 to subtext), not pixel-diffed.
- Outstanding issues: clean e2e rerun; participant 768/1440 screenshots; no new e2e assertion for the header added.
- Next action: tester reruns the two specs on a quiet server and checks 390/768/1440 for both roles.
