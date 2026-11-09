# slice-3 — Share and public view, default visibility

## Brief — main session — 2026-11-08
- Task: slice-3 — the Share sheet, the public shared-wishlist page and the default visibility setting
- Requirements: GC-022, GC-023, GC-027 (default visibility); implementation-plan.md §10 row 3; designs S23 (Share sheet), S25 (shared wishlist), S45 (settings: default visibility); database function `get_shared_wishlist` (one of the two anon-allowlisted functions, test 030; progress item 23: tighten the allowlist to the full signature here)
- Files/components: none yet. Branch `slice-3-share` from `main` (3db3a17 + 16866e4; slices 1 and 2 merged).
- Work completed:
  - `wishlists.share_token` (trigger-filled, 32 hex) and `visibility (private|link)` already exist from slice 2.
  - Open items closed by this slice: 30 (`user_settings` default wishlist visibility, deferred from slice 1) and 41 ("Anyone with the link" promised sharing before it existed).
  - The fix-auth-mobile-submit change is in its own PR #6, separate from this slice.
  - Design boards: S23 `Wishlist-Detail-share*` and S21 `Wishlist-Detail-bday` are downloaded; S25 `Wishlist-Shared-*` is being downloaded; S45 is not on the "Unwrap" canvas and may be on "Unwrap • Part 2" (to check).
- Outstanding issues: the S45 board location.
- Next action: download the boards; then the planner.

## Designs downloaded — main session — 2026-11-08
- Task: slice-3 — board sources and copy (read-only helper)
- Requirements: S23, S25, S45
- Files/components:
  - `scratchpad/design/project/`: `Wishlist-Shared-*` (S25), `Wishlist-Detail-share*` (S23), `UwSheet`/`UwModal`
  - `scratchpad/design2/project/`: `Acc-Privacy-*` (S45; "Unwrap • Part 2" canvas, page "account")
- Work completed (strings exact, from the helper's report):
  - **S23 Share sheet:**
    - title `Share “{list}”`
    - Private: body "It's private, so there's no link yet. Getting one lets anyone with the link see it. Your givers keep seeing it either way."; group "Who can see it" (same two options and hints as S20); main "Get a shareable link"; close "Done"
    - Switching: hint "Saving…", button busy
    - Public: "Your link" field with the URL; main "Share to WhatsApp"; secondary "Copy link"; close "Done"
    - Copied toast: "Link copied. Paste it anywhere to share."
    - Not designed: switching back to Private from the sheet; a failed save or copy.
  - **S25 shared wishlist:** default / empty / loading / unavailable ("This wishlist isn't available" / "Its owner may have made it private. Ask them to send you the link again." / "Make a wishlist of your own"; header "What is Unwrap?").
  - **S45 Privacy:**
    - title "Privacy"; "Changes save as you make them."
    - group "Default for new wishlists": "Private" ("Only you, until you share it.") / "Anyone with the link" ("People you send the link to can see it.")
    - toast "Saved. New wishlists start as Anyone with the link."
    - error "We couldn't save your default, so it's still Private. Try again."
    - offline: alert + disabled
    - also "Your data" (export, GC-028-ish, likely slice 16) and "Who sees what" sections
- Outstanding issues: S45 lives under Profile → Privacy, and the Profile page is minimal (slice 16); which S45 sections ship in slice 3 is for the planner and owner.
- Next action: planner.

## Planner — round 1 — 2026-11-08 (summary; full plan in the main session's builder brief)
- Task: slice-3 — Share sheet, public `/w/[shareToken]`, default visibility
- Requirements: GC-022, GC-023, GC-027 (default only); plan §3/§5/§6; items 23, 30, 41; AC-1–AC-20
- Files/components (planned):
  - migration `share_and_default_visibility` (`user_settings.default_wishlist_visibility` default private + update grant; definer `get_shared_wishlist(text) returns jsonb|null`, exact payload keys, granted to anon/authenticated)
  - tests 030 (exact signatures, plan 7), 110, 120
  - features: ShareSheet, `setWishlistVisibility`; `features/shared-wishlist/*`; `app/(public)/w/[shareToken]` (+ loading/not-found)
  - privacy: `/profile/privacy` + DefaultVisibilityForm + action; `lib/site-url.ts` (`SITE_URL`)
  - headers: noindex / no-referrer for `/w/*`
  - tests: e2e and unit
- Status: NEEDS CLARIFICATION (Q1–Q12)

## Owner answers — main session — 2026-11-08
- Task: slice-3 — Q1–Q12
- Requirements: planner round 1
- Files/components: none
- Work completed (owner, Tobechukwu Olih):
  - All recommendations accepted:
    - **Share sheet:**
      - links from a server-only `SITE_URL` per environment (dev falls back to the request host); never hard-code a domain
      - both the radio and "Get a shareable link" make the list shareable, and choosing Private in the sheet turns sharing off
      - a failed save shows "Couldn't save your change." + Retry; a failed copy selects the link; WhatsApp via `wa.me`
    - **Public page:**
      - intro uses number words 2–10, digits above, and "One thing {first name} would love. Tap it to see where to get it." for one item
      - rows without a link are not tappable
      - the first word of `display_name` in the intro/empty state; the full name by the avatar
      - generic title/OG ("A wishlist on Unwrap"), no list contents
      - 404 for every unavailable case
      - no extra rate limit in v1
    - **Privacy:**
      - S45 ships only "Default for new wishlists" (data export and "Who sees what" go to slice 16)
      - a "Privacy" link row on the minimal Profile
      - S45 Private outcomes: "Saved. New wishlists start as Private." / "We couldn't save your default, so it's still Anyone with the link. Try again."
    - **Copy:**
      - new strings go to copy-pending as approved
      - ship the S23 body as written
  - Production domain: **not decided**. Use `SITE_URL`; decide before launch (open item).
- Next action: builder.

## Main session — apply and security tests — 2026-11-09
- Task: slice-3 — apply the migration and run the security tests (owner approved)
- Requirements: AC-1, AC-2, AC-5, AC-6, AC-20
- Files/components: `supabase/migrations/20261108235144_share_and_default_visibility.sql` (renamed from 20261108130047 to match the hosted version), tests 010–120
- Work completed (verified):
  - Before applying: `get_shared_wishlist(text)` and the `default_wishlist_visibility` column did not exist (030/110/120 would fail).
  - Migration applied as `share_and_default_visibility` (version 20261108235144).
  - Security tests (rolled back): 010 4/4, 015 6/6, 020 11/11, 030 7/7, 040 5/5, 050 6/6, 060 22/22, 070 20/20, 080 17/17, 090 48/48, 100 56/56, 110 10/10, 120 19/19. **Total 231/231.**
    - 120 first failed to parse because of a bug in the main session's TAP-capture runner (it prefixed the SELECT of two multi-line INSERT…SELECT statements). The runner was fixed; the test file itself is unchanged.
  - Leftover check: 0 fixture users, pgtap not installed; 1 real wishlist (owner's) untouched.
  - PR #6 (fix-auth-mobile-submit) merged on owner approval. The owner chose to keep the AppShell padding change.
  - Types: the builder's hand-edited `database.types.ts` will be replaced with CI's generated file after the first PR run (as before); not hand-edited further.
- Next action: tester + reviewer.

## Reviewer — round 1 — 2026-11-09
- Task: slice-3 — review
- Requirements: GC-022, GC-023, GC-027
- Files/components: migration, tests 030/110/120, public route, ShareSheet, privacy, site-url, ListRow, docs
- Work completed: security design sound (minimal definer payload, identical null, format check, grants; tests lock the payload shape; app passes the token to the owner only; actions validate input).
- Verdict: CHANGES REQUIRED
- Findings:
  - R1-1 High: the branch is behind main (PR #6). Merge origin/main, keeping both `allowedDevOrigins` and the new `headers()`; re-run checks on the merged tree.
  - R1-2 Med: the back-navigation redesign (Button back variant, Header, AppShell, AuthFrame, PageHeading, dev shell) is outside slice 3. **Owner: it is the owner's change; ship it as its own commit**, checked on the auth screens too.
  - R1-3 Med: `cls` stray file.
  - R1-4 Med: progress.md slice 3 row and items 23/30/52 stale.
  - R1-5 Low: a missing `SITE_URL` makes the whole detail page show the load error.
  - R1-6 Low: the share URL is passed for Private lists too (owner only; acceptable).
  - R1-7 Low: replace the hand-edited types with the CI file.

## Tester — round 1 — 2026-11-09
- Task: slice-3 — share sheet, public /w/[shareToken], default visibility
- Requirements: GC-022, GC-023, GC-027; S23, S25, S45
- Work completed: typecheck, lint, tokens, unit (158), secrets pass. E2E 18 passed, 3 failed (same test x3 viewports, twice). No security or product defect found.
- Outstanding issues: T1-1 (Med, blocks PASS): shared-wishlist.spec.ts ~line 79 asserts page.content() lacks the token, but Next's RSC route payload carries the URL segment (the visitor already has it in the address bar). Not a leak. Assertions after that line (no owner controls, /signup and / links, rel on external links, axe, shared-default screenshots) did not run. Not tested: build/production HTML, default shared list visual at 390/1440.
- Next action: builder round 2 (T1-1 + reviewer R1-1, R1-2, R1-4, R1-6).

## Builder — round 2 — 2026-11-09
- Task: slice-3 — fix T1-1 and reviewer R1-1, R1-2, R1-4, R1-6
- Requirements: GC-022, GC-023, GC-027
- Files/components: `tests/e2e/shared-wishlist.spec.ts`, `next.config.ts`, `docs/progress.md`, `docs/tasks/back-navigation.md` (new), merge of origin/main (202fe26)
- Work completed (verified unless marked):
  - T1-1: the `page.content()` check is replaced by three checks on the rendered page: no `a[href]` contains the token, `body.innerText` does not, no `data-*` attribute value does. No other assertion changed. Not re-run in a browser (no dev server on 3000).
  - R1-1: `git fetch`, stash, `git merge origin/main` was a fast-forward (no merge commit), then stash pop. One conflict, `next.config.ts`, resolved to keep both `allowedDevOrigins` and the `headers()` block. `.env.example` has `ALLOWED_DEV_ORIGINS` and `SITE_URL`; `AuthFrame.tsx` has `method="post"` and the back-navigation changes. Stash was dropped; the index was reset so nothing is staged. HEAD is now 202fe26.
  - R1-2: code untouched; `docs/tasks/back-navigation.md` lists whole files and the hunks to stage separately in `profile/page.tsx`, `wishlists/[id]/page.tsx`, `wishlists/page.tsx`, and the 390/768/1440 plus auth-screen checks it needs.
  - R1-4: progress.md slice 3 row now reflects the applied migration and 231/231 pgTAP; items 23 and 30 closed on the passed tests (030, 110); item 52 reworded (hand-edited for typecheck, CI file replaces it after the first PR run, not edited further).
  - R1-6: recorded as a dated decision row in progress.md (share URL built for Private lists too; owner-only, own token under RLS; public view still returns nothing for Private).
  - R1-3: `cls` left untouched for the owner.
- Checks: `npm run typecheck` pass; `npm run lint` pass; `npm run tokens:check` pass; `npm test` 158/158; `npm run secrets:check` pass (59 files). E2E not run: nothing answered on localhost:3000. Build not run.
- Outstanding issues: R1-5 (missing `SITE_URL` shows the load error) and R1-7 (CI types file) not part of this round; R1-7 depends on the first PR run. E2E for the three specs must be re-run by the tester with a dev server on 3000. `ALLOWED_DEV_ORIGINS`/`headers()` merged config unverified at runtime.
- Next action: tester re-runs `E2E_PORT=3000 npx playwright test tests/e2e/shared-wishlist.spec.ts tests/e2e/share-signed-in.spec.ts tests/e2e/wishlists-signed-in.spec.ts`; main session stages back-navigation as its own commit first.

## Tester — round 2 — 2026-11-09
- Task: slice-3 retest (T1-1, merged tree)
- Verdict: PASS. typecheck, lint, tokens, unit 158/158, secrets pass; e2e 21/21 at 390/768/1440 (shared-wishlist 12, share-signed-in 3, wishlists-signed-in 6). Previously unrun assertions (no owner controls, /signup and / links, rel, axe, shared-default screenshots) pass. /w/* headers present on 200 and 404, absent on /login. Auth screens: Go back link, method=post, layout OK at 390/1440.
- Not tested: real auth submit, production build/HTML, 768 screenshots viewed, deep back-nav.
- Outstanding: R1-5, R1-7, R1-3 (cls), back-nav split not yet staged.
- Next action: reviewer round 2.

## Reviewer — round 2 — 2026-11-09
- Verdict: APPROVED. R1-1, T1-1, R1-4, R1-6 verified. Back-nav split correct and complete (watch: profile/page.tsx first hunk needs a split so the ListRow import stays with slice 3).
- R2-1 Low: item 47 reworded (missing SITE_URL breaks the whole detail page in production and previews) — done by main session. R2-2 Low: cls must not be committed.
- R1-5 accepted as open item 47. R1-7 at PR time.
- Next action: owner approves commits; main session stages back-nav, runs typecheck/lint on it alone, commits, then slice 3; PR; take CI types.
