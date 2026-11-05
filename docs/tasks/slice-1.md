# slice-1 — Sign up, log in, profile setup

## Brief — main session — 2026-11-04
- Task: slice-1 — sign up and log in by email code, profile setup, Home first time, log out; Resend SMTP and OTP rate limits; real-WhatsApp verify test (implementation-plan.md §10 row 1)
- Requirements: GC-001, GC-003, GC-004, GC-005, GC-006 (first time), GC-024 (log out); designs S01, S03–S07; tables `profiles`, `user_settings` (including time zone)
- Files/components: none yet. Slices 0a and 0b are merged into `main` (96d3606). Branch `slice-1-auth` is to be cut from `main` once `fix-0a-followups` is merged.
- Work completed:
  - Owner decided the env var name: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (progress item 24). Values are in `.env.local` only.
  - Dev project `ulziqspdjtjszvdcwdek` (the hosted connector; no local Docker). Each migration needs owner approval before it is applied.
  - Security harness tests 010–050 exist; every new table must pass them plus its own policy tests.
  - Seed personas `a0000000-0000-4000-8000-00000000000{1..5}` (organiser, participant, giver, receiver, outsider). The signed-in Playwright fixture was deferred to this slice; the seed omits some GoTrue token columns, so verify email-code sign-in for a persona.
- Outstanding issues:
  - Resend SMTP setup on Supabase needs the owner (keys).
  - `fix-0a-followups` (progress items 11, 12, 22, 24) is in progress on its own branch.
- Next action: planner.

## Planner — round 1 — 2026-11-04
- Task: slice-1 — auth, profile setup, Home first time, log out
- Requirements: GC-001, 003, 004, 005, 006, 024; plan §3–§10; AC-1–AC-30
- Files/components (planned):
  - Setup and libraries: `@supabase/ssr` + `@supabase/supabase-js`; `proxy.ts`; `lib/supabase/{env,server,proxy,client?}`; `lib/auth/{next-path,verify-state,auth-errors,display-name}`
  - Features and UI: `features/auth`, `features/account`; `components/ui/OtpInput`
  - Routes: `(auth)/{signup,login,verify}`, `(app)/layout` (auth gate), `(app)/{welcome,home,profile?}`, Landing
  - Database: migration `profiles_user_settings` with tests 060/070/080; seed updated with `first_name` and the GoTrue token columns
  - Tests: e2e auth fixture (`generateLink` email_otp, needs the secret key in tests only)
- Work completed: plan drafted. Proposed migration:
  - `profiles` (no email column, no cascade) and `user_settings` (timezone default `Africa/Lagos`, notify toggles)
  - RLS own-row with column-level grants
  - `private.handle_new_user` definer trigger requiring `first_name`; `check_timezone` and `set_updated_at` triggers
  - Designs S01/S03–S07 not read (no tool).
- Status: NEEDS CLARIFICATION
- Outstanding issues:
  - Q1: design details.
  - Q2: auth calls from the browser (per-IP limits) vs Server Actions.
  - Q3: sign-up with an existing email → log-in flow; accept account enumeration.
  - Q4: no photo in slice 1.
  - Q5: minimal `/profile` + log out scope and destination.
  - Q6: links to unbuilt routes.
  - Q7: name max length.
  - Q8: sender, Resend quota, rate limits, resend cooldown.
  - Q9: secret key for e2e (`.env.local` + GitHub secret), persistent seed, e2e users on dev.
  - Q10: WhatsApp test method (preview deploy vs tunnel).
  - Q11: display name defaults to the sign-up first name.
  - R1 (the applied migration edited) is covered by the owner exception for item 22: comment-only, verified by tester and reviewer.
- Next action: main session reads the designs if possible; owner answers.

## Designs read — main session — 2026-11-04
- Task: slice-1 — answer planner Q1 from the canvas
- Requirements: S01, S03–S07, E01/E02
- Files/components: board sources downloaded (read-only) to the session scratchpad `.../scratchpad/design/project/*.dc.html` (Entry-Landing-*, Entry-Signup-*, Entry-Login-*, Entry-Verify-*, Entry-Profile-*, HomeState-*-first, HomeState-Mobile-signedout, Email-E01, Email-E02, Entry.dc.html). The builder reads them there; they are not committed.
- Work completed (verified by reading the boards):
  - Each screen has mobile and desktop boards for every state:
    - Sign up: default, busy, validation errors, account exists, too many codes, offline, from invite
    - Log in: default, busy, invalid, no account, offline, from invite
    - Verify: default sign-up/log-in, checking, wrong, locked, resent, offline, from invite
    - Profile setup: default, saving, name missing, offline, photo uploading/failed, from invite
  - Verify has no submit button (auto-checks). The resend cooldown shows "You can resend in 0:59" (60 s). "Change email" is a text button. Wrong code offers "Resend code"; too many tries offers "Send a new code".
  - Q3 is answered by S03 "Account exists": Email error "There's already an account with this email.", primary "Log in with this email", text "Use a different email". S04 "No account found": "We couldn't find an account with this email." with "Create an account with this email" / "Try a different email".
  - Home first time: "Welcome, Amaka.", date line, How Unwrap works (same 3 steps as Landing), "Start an exchange", "Make a wishlist", and "Got an invite? Open the link you were sent and you'll land in that exchange."
  - Profile setup shows "Add a photo" ("Optional. Your initials show until you add one.").
  - E01/E02 code emails exist (subject/body copy in the boards).
- Outstanding issues: Q2, Q4–Q11 still need the owner.
- Next action: owner answers.

## Owner answers — main session — 2026-11-04
- Task: slice-1 — resolution of planner questions
- Requirements: planner round 1 Q1–Q11
- Files/components: none
- Work completed (owner, Tobechukwu Olih):
  - Q1: answered from the canvas (section above).
  - Q3: per S03 "Account exists" and S04 "No account found" (designs).
  - Q4: no photo in slice 1. Profile setup is name-only; initials everywhere; photo in slice 17.
  - Q5: a minimal `/profile` (from S42) with the name and Log out only, no links to unbuilt pages. Logs out this device only (`scope: 'local'`) and lands on Landing `/`.
  - Q8: sender `notice@unwrap.ink`, Resend free plan (~100 emails/day, 3,000/month).
  - Q9: approved. The owner adds `SUPABASE_SECRET_KEY` to `.env.local` and as a GitHub Actions secret (agents never see it), and adds the URL and publishable key as CI variables. Seed personas persist on the dev project. e2e may create and delete throwaway users with `@resend.dev` addresses.
- Recommendations taken by the main session (the owner may override):
  - Q2: `signInWithOtp`/`verifyOtp` from the browser via the `@supabase/ssr` browser client (per-user IP for rate limits); everything else in Server Actions.
  - Q6: navigation keeps links to unbuilt routes (dev only; not deployed yet).
  - Q7: name max 50 characters.
  - Q8 limits, sized under the free plan: emails sent per hour 30; minimum interval between codes per user 60 s (the design's resend cooldown); sign-ups/sign-ins 150 per 5 min per IP; token verifications 150 per 5 min per IP.
  - Q10: the real-WhatsApp test runs on a Vercel preview later (set-up item 4); it stays an open check for slice 1.
  - Q11: yes; the display name defaults to the sign-up first name.
- Outstanding issues: owner dashboard settings (planner §7) before the real inbox check; dependencies `@supabase/ssr` and `@supabase/supabase-js` need approval.
- Next action: builder once `fix-0a-followups` is merged and `slice-1-auth` is cut from main.

## Owner setup checklist — builder — 2026-11-04
Settings that live in dashboards, not in the repo. Do them on the dev project `ulziqspdjtjszvdcwdek`, and repeat on production before launch. Nothing here prints or commits a secret. Tick each line.

**A. Resend (resend.com)**
- [ ] Add and verify the domain `unwrap.ink` (DNS: the SPF, DKIM and return-path records Resend shows). Sender address: `notice@unwrap.ink`.
- [ ] Create an API key with sending access only. Keep it for step B (the SMTP password). Free plan: about 100 emails a day, 3,000 a month.

**B. Supabase, Authentication, SMTP settings**
- [ ] Turn on custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key. Sender email `notice@unwrap.ink`, sender name `Unwrap`.

**C. Supabase, Authentication, Providers, Email**
- [ ] Email provider on, "Confirm email" on, "Allow new users to sign up" on.
- [ ] OTP length **6**. (Builder check 2026-11-04: the dev project currently sends **8**-digit codes, so every sign-in screen and every signed-in e2e spec will reject them until this is changed.)
- [ ] OTP expiry **600** seconds (10 minutes; the emails and the Verify screen say 10 minutes).
- [ ] Phone, and every social provider, off. Nothing else is needed: v1 is email code only.

**D. Supabase, Authentication, Rate limits** (some are editable only once custom SMTP is on)
- [ ] Emails sent per hour: **30**. This one is **project-wide**, not per IP: one person or script can use the whole hourly budget. Before launch add CAPTCHA and a paid Resend plan (open item R1-3).
- [ ] Minimum interval between emails to the same user: **60** seconds (this is the 0:59 resend countdown).
- [ ] Sign-ups and sign-ins: **150** per 5 minutes per IP.
- [ ] Token verifications: **150** per 5 minutes per IP.
- Why these numbers: the free Resend plan allows about 100 emails a day, so 30 an hour caps a burst without blocking normal use. The two 150-per-5-minutes limits count per IP because sign-in calls run in the browser (decision 2026-11-04); the hourly email limit does not.

**E. Supabase, Authentication, Emails, Templates.** Paste-ready HTML for both templates: [docs/email-templates.md](../email-templates.md). Code only: no link, no button, in both. Use `{{ .Token }}` for the code and `{{ .Data.first_name }}` for the name. Copy is from boards Email-E01 and Email-E02. Keep the wordmark "Unwrap" at the top, the 600-wide layout and the grey footer from the boards.
- [ ] **Confirm signup** (E01, sent to a new account). Subject: `{{ .Token }} is your Unwrap code`. Preview text: `Enter it to finish creating your account.` Body:
  - Heading: "Here's your code"
  - "Hi {{ .Data.first_name }},"
  - "Use this code to finish creating your Unwrap account."
  - the code, large: `{{ .Token }}`
  - "It works for 10 minutes. Type it on the page where you asked for it, and it checks itself once all 6 digits are in."
  - "Didn't try to sign up? You can ignore this email. Nobody can create an account with your address without this code."
  - "Thanks," / "The Unwrap team"
  - Footer: "You're getting this because someone used this address to sign up for Unwrap." / "Unwrap · Secret Santa, without the spreadsheet"
- [ ] **Magic link** (E02, sent when an existing account logs in; Supabase uses this template for sign-in codes). Subject: `{{ .Token }} is your Unwrap code` (the same on purpose, so people can search their inbox). Preview text: `Enter it to log in.` Body:
  - Heading: "Your log-in code"
  - "Hi {{ .Data.first_name }},"
  - "Here's the code to log in to Unwrap."
  - the code, large: `{{ .Token }}`
  - "It works for 10 minutes. Type it on the page where you asked for it, and it checks itself once all 6 digits are in."
  - "Didn't try to log in? You can ignore this email. Your account is safe without the code."
  - "Thanks," / "The Unwrap team"
  - Footer: "You're getting this because someone asked to log in to Unwrap with this address." / "Unwrap · Secret Santa, without the spreadsheet"
- [ ] Leave the other templates (Change email, Reset password, Invite, Reauthentication) as they are; no screen sends them in v1. Do not add a link to either template above.

**F. Keys and variables (names only; never paste a value into chat or a file in the repo)**
- [ ] Add `SUPABASE_SECRET_KEY` to `.env.local` (never `NEXT_PUBLIC_`). Since 2026-11-04 (open item 36) it is read by server code too, so the dev server, the CI build and every deployment's server environment (Vercel) need it.
- [ ] GitHub, Settings, Secrets and variables, Actions: secret `SUPABASE_SECRET_KEY`; variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without the two variables the CI `check` job fails loudly on every request; without the secret the signed-in specs skip.

**G. After the migration is applied (main session) and the settings above are done**
- [ ] Sign up with a real address you own, read the email on a phone, type the code, and confirm the email matches the board.
- [ ] Real WhatsApp in-app browser check (implementation-plan.md §10, row 1) on a Vercel preview, once one exists.

## Builder — round 1 — 2026-11-04
- Task: slice-1 — auth, profile setup, Home first time, log out
- Requirements: GC-001, 003, 004, 005, 006, 024
- Files/components:
  - Dependencies: `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0
  - Database: migration `20261104103840_profiles_user_settings.sql`; tests 060 (22)/070 (20)/080 (17); seed update
  - Libraries: `lib/supabase/*`, root `proxy.ts`, `lib/auth/*`
  - Features: `features/{auth,account,onboarding}`, `components/{auth/AuthFrame,ui/OtpInput}`
  - Routes: `(auth)/{signup,login,verify}`, `(app)/{welcome,home,profile}`, Landing
  - Tests: unit `auth.test.ts` (63); e2e `auth-entry` (stubbed) and `auth-signed-in` (DB-dependent); fixtures
  - Config and docs: ci.yml, .env.example, .gitignore, copy-pending (4 rows), progress, "Owner setup checklist" section
- Work completed (builder-reported):
  - typecheck, lint, tokens and build pass; Vitest 102/102; e2e 194 passed, 37 skipped (signed-in specs skip until the migration is applied).
  - Screens checked visually against the boards at 390/1440.
  - The builder used `SUPABASE_SECRET_KEY` from `.env.local` to probe the dev project. It created and deleted one throwaway user and sent no email, as approved under Q9.
- Decisions to confirm:
  - auth/Home column width uses the `max-w-dialog` token (boards 440/640); Landing max 1040 (board 1120); Landing "Get started" not disabled offline
  - `/profile` = avatar, name h1, Log out, Back title "Profile"
  - auth gate per page; Welcome is a standalone screen
  - "Account exists" is detected by a log-in probe first; the wrong-code state shows the countdown before "Resend code" (60 s limit)
- Outstanding issues:
  - The dev project sends **8-digit** codes; the owner must set OTP length to 6.
  - Migration not applied; pgTAP 060–080 never run; signed-in e2e not run.
  - Types not regenerated (untyped client until then).
  - Story notes not written.
- Next action: owner approves the migration; main session runs the tests first (expect failures), applies, seeds, re-runs 010–080, regenerates types.

## Main session — apply and security tests — 2026-11-04
- Task: slice-1 — apply the migration, seed, run security tests (owner approved)
- Requirements: AC-21–AC-24; CLAUDE.md "Database changes"
- Files/components: `supabase/migrations/20261104103840_profiles_user_settings.sql` (renamed from 20261104093342 to match the hosted version), `supabase/seed.sql`, `supabase/tests/security/0*.sql`, `lib/supabase/database.types.ts`
- Work completed (verified, through the connector on `ulziqspdjtjszvdcwdek`):
  - Before applying: 0 auth users, 0 public tables. 080 run first failed with `42P01 relation "public.profiles" does not exist` (test-first evidence).
  - Migration applied (`profiles_user_settings`, version 20261104103840). Statements identical to the file; comments trimmed in the applied text.
  - Seed run persistently (owner approved, Q9): 5 users, 5 identities, 5 profiles, 5 settings rows.
  - Security tests, same capture method as slice 0b (rolled back):
    - 010: 4/4
    - 015: 6/6
    - 020: 11/11
    - 030: 6/6
    - 040: 5/5
    - 050: 6/6 (against the persistent seed, not pasted)
    - 060: 22/22
    - 070: 20/20
    - 080: 17/17
    - **Total 97/97.**
  - Leftover check: 0 `b0000000…` fixture users, pgtap not installed, 0 `zz_selfcheck` objects; 5 users and 5 profiles remain (personas).
  - Types regenerated through the connector into `lib/supabase/database.types.ts` (profiles, user_settings). CI's drift step may again need the CLI-formatted output (as in slice 0b); take the CI file if it differs only in formatting.
- Outstanding issues:
  - Builder follow-up: pass the `Database` generic in `lib/supabase/{client,server,proxy}.ts`, drop the manual type guard in `lib/auth/session.ts`.
  - Owner: OTP length 6 (the project currently sends 8 digits) and checklist C–F.
  - Signed-in e2e not yet run.
- Next action: builder round 2 (types follow-up) and re-run e2e incl. auth-signed-in once OTP length is 6.

## Builder — round 2 — 2026-11-04
- Task: slice-1 — types follow-up and full re-run
- Requirements: step-4 follow-up
- Files/components: `lib/supabase/{client,server,proxy}.ts`, `lib/auth/session.ts`
- Work completed (builder-reported): `Database` generic wired in; manual guard removed. typecheck, lint, tokens, Vitest (102/102) and build pass. e2e: 196 passed, 7 skipped, 28 failed.
  - 27 failures are the signed-in specs, all at the fixture's OTP check ("sends 8-digit codes; set OTP length to 6"); nothing past that has run.
  - 1 failure: `auth-entry › Verify › offline` at 390 timed out; it passed alone at all widths (suspected flake).
- Outstanding issues: owner sets OTP length 6; watch the offline-banner flake.
- Next action: owner checklist B–E; then re-run signed-in e2e; tester; reviewer.

## Main session — signed-in e2e — 2026-11-04
- Task: slice-1 — run the signed-in specs after owner checklist A–F
- Requirements: AC-11, 12, 14–20
- Files/components: `tests/e2e/auth-signed-in.spec.ts`; `docs/email-templates.md` (new: paste-ready E01/E02 templates)
- Work completed (verified):
  - Owner reports checklist A–E done, so OTP length is now 6.
  - `npx playwright test auth-signed-in`: **30 passed, 3 skipped** (the opt-in real-email spec at 3 widths), 3.5 min.
  - Covered:
    - returning person → Home first time, with the time zone recorded on every sign-in
    - new account → Profile setup prefilled and saved
    - 50-character emoji truncation
    - Profile + Log out (this device) → Landing
    - signed-in redirects
    - deep-link `next`
    - wrong code refused by the real service
    - axe on /home, /welcome and /profile at 390/768/1440
  - Dev project after the run: 5 users, all personas; the throwaway users were cleaned up.
- Outstanding issues:
  - G1 real-inbox check (owner).
  - G2 WhatsApp check (later, needs a preview deploy).
  - Story notes not written.
- Next action: tester + reviewer.

## Reviewer — round 1 — 2026-11-04
- Task: slice-1 — review
- Requirements: GC-001, 003, 004, 005, 006, 024; plan §3–§8; CLAUDE.md
- Files/components: whole slice diff
- Work completed (reviewer-run): typecheck, lint, tokens and Vitest 102/102. Sound:
  - no email in `public` or props; RLS and column grants; definer trigger hardened
  - `next` sanitising; secret key confined to tests and the CI e2e step
  - Server Actions validate and use `getUser()`; no `any`; tokens only
- Verdict: CHANGES REQUIRED
- Findings:
  - R1-1 High (inferred): an abandoned sign-up leaves an unconfirmed user. A retry or log-in then says "Account exists", sends E01, runs as the log-in flow and skips Profile setup. Confirm on dev, then decide the destination from `email_confirmed_at` set by this verification; add tests.
  - R1-2 Med: errors and focus changes are not announced (wrong code, locked, account exists / no account). Use live regions and move focus.
  - R1-3 Med: "Emails sent per hour" is project-wide, not per IP. Fix the checklist note; open item for CAPTCHA and a Resend plan before launch (owner).
  - R1-4 Med: the account-exists probe sends a real E02, and "Log in with this email" goes to Verify, not Log in (board). Needs owner sign-off; update the email-templates "Sent when".
  - R1-5 Med: `user_settings` lacks "default wishlist visibility" (approved schema). Record the owner's deferral.
  - R1-6 Med: progress.md, open items and story notes are stale.
  - R1-7 Low: `proxy.ts` matcher `"\."` → `"\."`.
  - R1-8 Low: stale localStorage verify state keeps the email; remove it when stale and on log out.
  - R1-9 Low: email/`next` dropped (Create account from Log in; /welcome redirect; `redirectIfSignedIn`).
  - R1-10 Low: the email greeting uses the sign-up metadata name (goes stale; check escaping in G1).
  - R1-11 Low: GC-001 story vs board copy conflict (full stop; "got. Not even"). Needs owner ruling.
  - R1-12 Low: tighten 070 #13 to 22023.
  - R1-13 Low: trigger/no-cascade side effects on Studio add/delete user; operational note.
  - R1-14 Low: `check_timezone` accepts POSIX strings; fix the comment or check `pg_timezone_names`.
  - R1-15 Low: no error state for signed-in routes; open item.
  - R1-16 Low: column widths approximate (480 vs 440/640; 1040 vs 1120). Owner/designer to confirm or add tokens.
- Outstanding issues: owner decisions R1-3/4/5/11/16; G1/G2.
- Next action: owner decisions; builder fixes R1-1, R1-2 and R1-6–R1-14; tester; reviewer round 2.

## Owner answers (review) — main session — 2026-11-04
- Task: slice-1 — decisions on reviewer round 1
- Requirements: R1-3, R1-4, R1-5, R1-11
- Files/components: none
- Work completed (owner, Tobechukwu Olih):
  - R1-4: accepted. The account-exists probe sends a real log-in code; "Log in with this email" goes straight to Verify.
  - R1-11: the board wording wins on Landing; the GC-001 Content lines are to be updated to match.
  - R1-5: `default wishlist visibility` is deferred to slice 3, in a new migration.
  - R1-3: open item before launch: Cloudflare Turnstile CAPTCHA on code requests, and a paid Resend plan.
- Main session: R1-16 widths kept as token approximations (`max-w-dialog`, `max-w-content-max`) until a designer adds tokens; logged as an open item.
- Outstanding issues: tester round 1 pending.
- Next action: builder round 3 with the reviewer + tester findings.

## Tester — round 1 — 2026-11-04
- Task: slice-1 — verify
- Requirements: AC-1–AC-30
- Files/components: whole slice
- Work completed (tester-run): typecheck, lint, tokens, Vitest (102/102) and build pass.
  - e2e run 1: 222 passed, 2 failed, 7 skipped. Run 2: 223 passed, 1 failed, 7 skipped. A different test failed each time, against an already-running shared `next dev` on port 3000 (`E2E_PORT=3000`).
  - Security by code/grep: secret confined; no secret-shaped value in the build output; `sanitizeNext` OK; verify cookie httpOnly/lax, Secure in prod; no raw error text; email only on the person's own Verify screen; `.gitignore` OK.
  - Copy matches the boards; 4 pending rows present. Screenshots consistent with the boards.
- Verdict: FAIL (narrowly; flaky e2e only)
- Outstanding issues:
  - T1-1 Med: "Change email" stayed on /verify once (possible race between `changeEmail` and the resume effect).
  - T1-2 Low: "Log out" and "Try again" are not in copy-pending.
  - T1-3 Low: Landing 390, check the content scrolls clear of the pinned "Get started".
  - Flaky: the Log out test timed out in run 1.
  - Needs a human: real inbox, WhatsApp, iPhone keyboard.
- Next action: builder round 3.

## Builder — round 3 — 2026-11-04 (took over after a rate limit; Opus)
- Task: slice-1 — reviewer R1-1–R1-16, tester T1-1–T1-3 and the flake; docs
- Requirements: GC-001, 003, 004, 005, 006, 024; GC-028 note
- Files/components:
  - verify page, `lib/auth/verify-state.ts`, `features/auth/*`, `prefill-email.ts`, LogOutButton
  - `components/ui/{Field,OtpInput}.tsx` (`role="alert"`, shared), welcome page, `proxy.ts`
  - 070 test, unit and e2e specs, fixtures, global-setup
  - docs: stories, email-templates, progress (open items 27–36), copy-pending, checklist D
- Work completed (builder-reported):
  - R1-1 reproduced on dev: an unconfirmed user plus `signInWithOtp(shouldCreateUser:false)` returns success (sends E01); an unknown address returns 422 `otp_disabled`. Fixed: the destination after Verify comes from the verified user (first confirmation → `/welcome`, keeping `next`). The throwaway user was deleted.
  - R1-2 focus and announcements; R1-7/8/9/12 done; R1-3/5/10/13/14/15/16 logged as open items; T1-1 root-cause fix (10/10 at 768); T1-2/T1-3 done; Log out flake fixed (wait for settle).
  - Checks: typecheck, lint, tokens, Vitest 107/107 and build pass; e2e run 1: 255 passed, 9 skipped, 0 failed; run 2: same.
- Outstanding issues:
  - Open item 36: Sign up still says "Account exists" for an unconfirmed account. Fixing it needs a public status function (schema change, enumeration) or a Server Action with the secret key. Owner decision.
  - 070 edited and needed a re-run.
- Next action: main session re-runs 070; owner decides item 36; tester + reviewer round 2.

## Main session — 070 re-run — 2026-11-04
- Task: slice-1 — re-run the edited 070 on the dev project
- Requirements: R1-12
- Files/components: `supabase/tests/security/070_user_settings.sql`
- Work completed (verified): 070 is 20/20 with #12 and #13 expecting 22023 (rolled back).
  - Dev project users: 5 personas and 1 real, confirmed Gmail account with a profile (created 2026-11-04 11:10 UTC). Likely the owner's G1 sign-up; to confirm with the owner. No throwaway test users left.
- Outstanding issues: open item 36; G1 confirmation; G2.
- Next action: tester + reviewer round 2.

## Owner answers (round 3) — main session — 2026-11-04
- Task: slice-1 — open item 36 and G1
- Requirements: R1-1 (second part), checklist G1
- Files/components: none yet
- Work completed (owner, Tobechukwu Olih):
  - Item 36: use a **server-only check with the secret key** to tell an unconfirmed account from an existing one, so Sign up continues as a sign-up. This widens where `SUPABASE_SECRET_KEY` lives: it is now also used by server code (never `NEXT_PUBLIC_`, never in client bundles); the dev server and deployments need it.
  - G1: the owner signed up with a real address (the Gmail account created 11:10 UTC); the email arrived from `notice@unwrap.ink`, matched the design and showed the code. The `<b>x</b>` escaping test is still to do.
- Outstanding issues: implement item 36; G1 escaping test; G2.
- Next action: builder round 4.

## Builder — round 4 — 2026-11-04
- Task: slice-1 — open item 36: server-only account status check
- Requirements: GC-003; R1-1 (second part); owner answers (round 3)
- Files/components:
  - new: `lib/supabase/admin.ts` (server-only), `lib/auth/account-status.ts`, `scripts/check-client-secrets.ts` (`secrets:check`), `tests/unit/account-status.test.ts`
  - modified: `features/auth/{actions,SignupForm,VerifyForm}.tsx`, `eslint.config.mjs`, ci.yml, `playwright.config.ts`, `.env.example`, e2e specs and fixtures
  - docs: progress, stories, email-templates, checklist F
- Work completed (builder-reported):
  - `checkAccountStatus` returns `confirmed` / `not-confirmed` / `unknown`. Unconfirmed accounts continue as sign-up (E01, no log-in probe); confirmed accounts keep R1-4; unknown falls back to the probe.
  - Guards: `server-only`, a `typeof window` throw, a lint rule, and `secrets:check` (no key name or value in client or prerendered output).
  - Checks: typecheck, lint, tokens, Vitest 115/115, build and secrets:check pass. e2e on the final code: run 4 had 2 failures after the machine suspended the network mid-run (`ERR_NETWORK_IO_SUSPENDED`); run 5: 267 passed, 9 skipped, 0 failed.
  - Dev project: 6 users (5 personas + the owner), 0 throwaway.
- Outstanding issues:
  - `checkAccountStatus` is an unauthenticated Server Action with no rate limit. It reveals confirmed-account status without sending email, which is cheaper enumeration than before. Reviewer and owner to judge (item 29, Turnstile, should cover it).
  - The admin `filter` parameter is undocumented in supabase-js (exact match is enforced in code).
  - G1 escaping test; G2.
- Next action: tester round 2 + reviewer round 2.

## Reviewer — round 2 — 2026-11-04
- Task: slice-1 — re-review after builder rounds 3–4
- Requirements: R1-1–R1-16, T1-1–T1-3, item 36
- Files/components: admin.ts, account-status.ts, auth features, Field/OtpInput, eslint, secrets check, ci.yml, docs
- Work completed (reviewer-run): typecheck, lint and Vitest 115/115. All R1/T1 findings resolved or logged as open items 27–36. The item-36 design is acceptable: guards hold, CI uses `pull_request` (no secret for forks), the key is not in traces.
- Verdict: APPROVED, on condition that the owner records a decision on R2-1.
- Findings:
  - R2-1 Med: `checkAccountStatus` is a silent, unthrottled account-existence oracle. Recommended (A): accept until launch; make item 29 a launch blocker naming the action (Turnstile token verified server-side) plus a Vercel WAF rate-limit on `POST /signup`; record in decisions and the GC-003 note. (B, mitigate now, needs a new table or service: not recommended.)
  - R2-2 Low: no test proves the admin `filter` narrows results (dev has fewer than 50 users).
  - R2-3 Low: no signal when the server check degrades to `unknown` (log the condition or add a checklist step).
  - R2-4 Low: ci.yml "no secrets needed" comment stale; progress.md slice 1 row stale; item 29 wording.
- Residual: `isFirstConfirmation` 1 s window; `server-only` via Next's alias; lint allowlist by filename; human checks (screen reader, G1 escaping, G2, iPhone keyboard). Keep the CI secret as the dev project key only.
- Next action: owner decides R2-1; small doc fixes; tester round 2 verdict; commit.

## Tester — round 2 — 2026-11-04
- Task: slice-1 — verify builder rounds 3–4
- Requirements: R1/T1 findings, item 36, R1-2, docs
- Files/components: whole slice
- Work completed (tester-run):
  - typecheck, lint, tokens, Vitest 115/115, build and secrets:check pass.
  - Item 36 guards verified (lint rule fires on a client import; no secret in `.next/static`; minimal action result).
  - R1-2 focus/announce code and `toBeFocused` asserts present. Docs and story notes present.
- e2e: run 1: 265 passed, **2 failed** (13.1 min); run 2: 257 passed, **10 failed** (21.9 min). Timeouts across many signed-in and entry specs.
- Verdict: FAIL
- Outstanding issues:
  - T2-1 High: the full e2e is not green on two runs.
  - T2-2 Med: the Log out test (`auth-signed-in.spec.ts:147`) times out at `contextB.close()` on both runs.

## Main session — Supabase auth logs check — 2026-11-04
- Task: slice-1 — is T2-1 caused by Supabase rate limits?
- Requirements: T2-1
- Files/components: none (read-only log query through the connector)
- Work completed (verified):
  - Auth errors since 13:20 UTC: 1124 `bad_jwt` on `/user` (tests that use tampered/fake session cookies), 21 `otp_expired` on `/verify` (wrong-code tests), 8 `user_not_found`. **No 429 / rate-limit responses.** So the failures are not Supabase rate limits.
  - Dev project users: 5 personas and the owner's account; no stray test users.
- Outstanding issues: likely test-harness load/timing (run 2 took 21.9 min) plus a real hang at `contextB.close()` (T2-2).
- Next action: builder round 5: harden e2e (root cause, not retries).

## Main session — builder round 5 stalled — 2026-11-05
- Task: slice-1 — T2-1/T2-2 e2e stability
- Requirements: T2-1, T2-2
- Files/components: `playwright.config.ts` (`.env.local` loading), `tests/e2e/global-setup.ts` (more route warm-up): the only round-5 changes on disk
- Work completed (verified from disk and the run outputs):
  - The builder stalled (watchdog) mid-round. A targeted run took 2.8 h with 2 failures: the Log out test at 390 and Verify countdown at 768. The machine is likely sleeping or throttled during long runs.
  - The Log out hang (T2-2) is not fixed.
- Owner decision: a fresh builder fixes T2-2 and serialises the signed-in specs, checking only the affected specs locally. Then the main session commits to `slice-1-auth` and pushes; **GitHub CI's e2e result is the e2e pass** for this slice.
- Next action: builder round 6.

## Owner checks — main session — 2026-11-05
- Task: slice-1 — human checks
- Requirements: checklist G1 (incl. `<b>x</b>` escaping), G2 WhatsApp in-app browser, screen-reader pass (R1-2), iPhone keyboard (CLAUDE.md UI rule)
- Files/components: none
- Work completed (owner-reported, Tobechukwu Olih, 2026-11-05): all four checks done and working.
- Outstanding issues: progress.md items 27 and 28 to be closed once builder round 6 finishes (avoiding concurrent edits).
- Next action: builder round 6 → commit and push → CI.

## Builder — round 6 — 2026-11-05
- Task: slice-1 — T2-1/T2-2 e2e reliability
- Requirements: T2-1, T2-2
- Files/components: `playwright.config.ts` (new single-worker `signed-in` project), `tests/e2e/viewports.ts` (new), `tests/e2e/auth-signed-in.spec.ts` (loops widths), `tests/e2e/global-setup.ts`
- Work completed (builder-reported):
  - T2-2 root cause: no real hang. The test ran out of time under contention, and the timeout surfaced at `close()`. Fixed by running signed-in tests one at a time; `test.slow()` removed; no assertions changed.
  - Targeted runs ×2: 45 passed, 3 skipped, 0 failed.
  - Full local run ×1: 265 passed, 9 skipped, 2 failed (stubbed entry tests where `next dev` stalled >10 s locally; the signed-in project was fully green).
  - typecheck, lint, Vitest 115/115, tokens, build and secrets:check pass. No processes left running.
- Outstanding issues: local `next dev` stalls under 2 workers (CI runs 1 worker). GitHub CI is the e2e judge (owner decision).
- Next action: main session commits, pushes, opens the PR, reads CI.
