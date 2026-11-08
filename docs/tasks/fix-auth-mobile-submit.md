# fix-auth-mobile-submit — Sign up / Log in on a phone clears the email instead of sending a code

## Report and diagnosis — main session — 2026-11-08
- Task: fix-auth-mobile-submit — owner report: on mobile, submitting Sign up or Log in clears the email field and sends no code
- Requirements: GC-003, GC-004; CLAUDE.md "While coding" 6 (machine-specific values in local env files); copy and privacy rules (no email in URLs or logs)
- Files/components: `components/auth/AuthFrame.tsx`, `next.config.ts`, `.env.example`, `.env.local` (local only, not committed)
- Work completed (verified from the dev server log):
  - The phone opened the dev server by its LAN address (192.168.0.101). `next dev` logged "Blocked cross-origin request to Next.js dev resource /_next/hmr from 192.168.0.101", so the page's JavaScript never ran.
  - With no JavaScript, the form did a native GET submit: the log shows `GET /login?email=…` and `GET /signup?firstName=…&email=…`. The page reloaded with empty fields, and the email and first name went into the URL and server log.
  - Fixes:
    - (1) `AuthFrame` form now has `method="post"`, so a submit before hydration can never put personal data in the URL. It is the shared auth form, so the fix covers Sign up, Log in and Verify.
    - (2) `next.config.ts` reads `allowedDevOrigins` from `ALLOWED_DEV_ORIGINS` (comma list); the name is added to `.env.example`, and `ALLOWED_DEV_ORIGINS=192.168.0.101` is in the owner's gitignored `.env.local`.
  - typecheck, lint and tokens:check pass.
- Outstanding issues:
  - The dev server must restart to pick up the config; deferred until tester round 2 of slice 2 finishes, because it is reusing that server.
  - Slice 2's sheet forms (`WishlistSheet`, `ItemSheet`) need the same `method="post"`, in slice 2.
  - Owner to re-test on the phone after the restart.
  - This change gets its own commit and PR (CLAUDE.md "While coding" 2), separate from slice 2.
- Next action: restart the dev server after the tester; owner phone check; then commit on a fix branch.

## Owner check — main session — 2026-11-08
- Task: fix-auth-mobile-submit — verify on a phone
- Requirements: GC-003, GC-004
- Files/components: as above
- Work completed: fresh dev server started with `ALLOWED_DEV_ORIGINS`; the owner tested Sign up and Log in on a phone at http://192.168.0.101:3000 and reports it works (2026-11-08).
- Next action: commit, PR, CI.
