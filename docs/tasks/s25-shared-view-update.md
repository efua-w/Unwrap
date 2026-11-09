## Builder — round 1 — 2026-11-09
- Task: s25-shared-view-update — build the updated S25 boards (Wishlist-Shared-default-m/-d), approved 2026-11-09 (Tobechukwu Olih)
- Requirements: GC-023 (Content, In scope); boards Wishlist-Shared-default/-empty/-unavailable
- Files/components: components/ui/ListRow.tsx; features/shared-wishlist/{copy.ts,components/SharedFrame.tsx,components/SharedWishlistView.tsx}; tests/unit/shared-wishlist.test.ts; tests/e2e/shared-wishlist.spec.ts; docs/user-stories.md; docs/copy-pending.md; docs/progress.md (item 54)
- Work completed: intro is one sentence ("Four things Amaka would love." / "One thing Amaka would love."); "Recently changed first" removed from the public view and SHARED_COPY.order deleted (the owner detail view has its own copy, untouched); ListRow gained optional `note` (third line) and `trailingLabel` (plain text at the end) and the public rows use them with price as `sub`; frame column centred on desktop for all states (default, empty, unavailable); CTA stays full width on mobile, normal width on desktop.
- Outstanding issues: the boards cap the column at 640px; no token matches (max-w-dialog is 480, content-max is 1040), so it stays 480 and is centred. Needs a size token (progress item 54, related 43). Row height is natural (about the board's 96px with three lines), no height token added. Not compared pixel-by-pixel with the boards.
- Next action: tester; then owner to decide the 640 token.

## Main session — 2026-11-09
- Owner: priority is a badge, not plain text; "Most wanted" uses surface/brand-subtle (new Chip `wash` variant), "Nice to have" the grey `date` chip. ListRow `trailingLabel` removed (no callers). Owner added size/reading-max (640px); SharedFrame uses it.
- Checks: typecheck, lint, tokens, unit 158/158, shared-wishlist e2e 12/12.
