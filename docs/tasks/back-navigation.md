# back-navigation — owner's back-navigation redesign (own commit, separate from slice 3)

## Builder — round 1 — 2026-11-09 (split note for staging)
- Task: back-navigation — the owner's Back control and page-top redesign, committed on its own (reviewer R1-2; owner: "it is the owner's change; ship it as its own commit")
- Requirements: none from a story. Owner decision 2026-11-03 (in-app Back goes to the parent page) and owner design change 2026-11-09 (content starts 80 from the Sidebar; labelled Back; heading row with avatar). Code unchanged by this note.
- Files/components, wholly this commit (`git add` whole file):
  - `components/ui/Button.tsx` (`back` variant, shared `PILL` shape)
  - `components/layout/Header.tsx` (`BackButton`, `ProfileLink`, `BackLink`, new Header props)
  - `components/layout/AppShell.tsx` (`back` and `top` props replace `header`; new main padding)
  - `components/layout/PageHeading.tsx` (new)
  - `components/auth/AuthFrame.tsx` (BackButton/Header; main's `method="post"` is kept, it is already in HEAD after the merge)
  - `app/dev/shell/page.dev.tsx`
- Files shared with slice 3 (stage by hunk, `git add -p`):
  - `app/(app)/profile/page.tsx`: BACK-NAV: remove `Header` import; `header={...}` becomes `back={{ label: "Go back", href: "/home" }}` and its WHY comment. SLICE 3: `ListRow` import, the "Privacy link row from slice 3" comment edit, the `<ul>` with `<ListRow href="/profile/privacy" ...>`.
  - `app/(app)/wishlists/[id]/page.tsx`: BACK-NAV: remove `Header` import; `AppShell ... back={{ label: "Back to Wishlists", ... }}`. SLICE 3: `buildShareUrl` import, `let shareUrl`, the `buildShareUrl` call, `shareUrl` prop on `WishlistDetail`.
  - `app/(app)/wishlists/page.tsx`: BACK-NAV: `PageHeading` import, `top="heading"`, `<PageHeading>` replacing the `<h1>`. SLICE 3: `getDefaultVisibilityOrPrivate` import and call, `defaultVisibility` prop on the three `NewWishlistButton`s.
- Everything else in the working tree is slice 3 (including `components/ui/ListRow.tsx`, `next.config.ts` `headers()`, `.env.example` is already main's plus slice 3's `SITE_URL`).
- Work completed: split identified by diff reading (verified). No code was changed for the split.
- Outstanding issues: this commit has not been checked on its own. It needs a visual and e2e check at 390, 768 and 1440 on: the app shell pages (Home, Wishlists, wishlist detail, Profile), `/dev/shell` (with `?back=1`), and the auth screens that use `AuthFrame` with `backHref` (sign in code step, sign up, and the others), including the mobile Back bar (below 768) and the in-page Back button (768 and up), and form submit still posting. Tester has so far only run the slice 3 specs against the combined tree.
- Next action: main session stages this commit first (whole files plus the three hunk sets), runs checks and the 390/768/1440 pass including auth screens, then commits slice 3 separately.
