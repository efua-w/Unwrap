# join-one-screen — one screen before joining (S10 Join exchange)

Owner request 2026-11-18 (slice 7 click-through): a participant sees two screens before joining; the design now has one. Own change, own branch and PR (not slice 7).

## Owner decisions — 2026-11-18 (Tobechukwu Olih)
1. Signed-out view keeps names hidden: inviter, count, dates, How it works; no faces, names or organiser note until signed in. No database change for the public preview (GC-002 context C stands).
2. After sign-up/log-in from an invite, follow the board: sign-up → code → name → joined automatically → Attach wishlist (approval exchanges: request sent). If the exchange closed/filled or the person is removed/pending meanwhile, show the existing unavailable/ask states.
3. Accept the board copy ("Gifts exchanged", the three How it works steps, email line under the privacy alert, "Joining as", "Not now"); update stories and copy-pending.
4. Board: canvas "Unwrap", page "02. Exchanges", section "S10 Join exchange" — boards Join-Exchange-guest, -default, -alone, -approval, -busy, -error, -loading, -offline, and Joining-Confirm-requested (Request sent, success), each -m and -d.

## Investigation (main session, 2026-11-18) — summary
- Screen 1: app/(public)/i/[inviteToken]/page.tsx → features/joining/components/InvitePreviewView.tsx, InviteActions.tsx (get_invite_preview; no people/note/email by design).
- Screen 2: app/(public)/i/[inviteToken]/join/page.tsx → JoinForm/JoinContent.tsx, AskToJoin, RequestPending (get_join_details, requireProfile).
- Return path after Verify: lib/auth/invite-path.ts (inviteJoinPath), lib/auth/verify-state.ts; Profile setup currently skipped for invitees.
- Copy: features/joining/copy.ts (INVITE_COPY, JOIN_COPY).
- E2E asserting two steps: tests/e2e/invite-join-signed-in.spec.ts (165–246, 338, 346–367, 761–774), approval-participants-signed-in.spec.ts (72–138, 229, 247, 334), activity-signed-in.spec.ts (52, 59); unit tests/unit/invite-join.test.ts.
- Routes in docs/implementation-plan.md lines 35–36 list /i/[inviteToken]/join as GC-009 confirmation.

## Planner — round 1 — 2026-11-18
- Task: join-one-screen — one screen before joining; auto-join/auto-request after sign-in from an invite
- Requirements: GC-002, GC-003, GC-004, GC-005, GC-009, GC-012 (GC-010 landing); owner decisions 1–4; AC-1…AC-22
- Files/components: app/(public)/i/[inviteToken]/page.tsx and join/page.tsx; features/joining/components/{InvitePreviewView,JoinContent,JoinForm,AskToJoin,InviteActions}.tsx; features/joining/{copy,actions}.ts; features/auth/actions.ts (finishSignIn); lib/auth/{verify-state,invite-path}.ts; new lib/auth/join-intent.ts; docs.
- Work completed: plan (12 steps). No database change: get_invite_preview, get_join_details, join_exchange and request_to_join already cover every state; pgTAP run unchanged as regression.
  - /i/<t> is the only screen. Signed in: JoinForm/AskToJoin act in place (one tap); pending and ask-removed render in place.
  - /i/<t>/join becomes a post-sign-in action page: signed out → login; not set up → /welcome?next=… (name step); no intent cookie → redirect to /i/<t>; intent cookie → same render with autoStart (one call, ref-guarded).
  - Intent cookie set by finishSignIn when next is an invite path: httpOnly, SameSite=Strict, path=/i/<t>, 30 min; cleared by join/request actions. Prevents a crafted link from auto-joining or auto-emailing the organiser.
  - destinationAfterVerify: invite+signup → /welcome?next=/i/<t>/join; invite+login → /i/<t>/join.
  - Changed state after sign-in (closed, full, cancelled, removed, pending, member) shows the existing screen; nothing automatic.
  - Remove: INVITE_COPY.how/join/giftDay, JOIN_COPY.agreeing/whosIn/organisedBy (if unused), /join redirects, allowNotOnboarded on /join.
  - E2E rewrites in invite-join, approval-participants, activity specs.
- Outstanding issues: R-1 (route behaviour change of /i/<t>/join), R-2 (new httpOnly cookie), Q1 (name step = existing S06 Profile setup?) — owner to answer.
- Next action: owner answers R-1, R-2, Q1; builder starts at step 1.

## Owner approvals — 2026-11-18 (Tobechukwu Olih)
- R-1 approved: /i/<t>/join kept only as the post-sign-in action page (auto-join or auto-request); direct opens without intent redirect to /i/<t>.
- R-2 approved: join-intent cookie (httpOnly, SameSite=Strict, path=/i/<t>, 30 min, cleared after the action).
- Q1: the name step is the existing S06 Profile setup (/welcome?next=…), unchanged.

## Board files (saved locally, read-only copies)
C:\Users\P\AppData\Local\Temp\claude\9216d52471611509\192197f4-557d-4210-a98c-c7d84c1587c8\scratchpad\artifact-files\e419cb4a-5935-4f92-9043-cd6d39bc7527\project\
Join-Exchange-{guest,default,alone,approval,busy,error,loading,offline}-{m,d}.dc.html (guest-m/d, default-m/d, approval-m/d, alone-m/d all present), Joining-Confirm-requested-{m,d}.dc.html, Entry-Profile-invite-{m,d}.dc.html.
Notes from the main session: busy = primary busy + "Not now" disabled; error = UwAlert error "We couldn't add you to {exchange}. Nothing has changed, so you can try again." + Try again, placed after "Joining as", buttons enabled; loading = skeleton (36 avatar + line, 48 tile + title, 3-face stack, 4 lines) with Join disabled and Not now enabled; offline = UwAlert offline "You're offline. Pages you've opened stay on screen." at the top, both buttons disabled. Stack shows up to 5 faces; aria-label "{n} people are in: {full names}". Desktop: content max-width 440, buttons inline; mobile: buttons in a footer.

## Builder — round 1 — 2026-11-18
- Task: join-one-screen — build the plan
- Requirements: GC-002, GC-003, GC-004, GC-005, GC-009, GC-012; decisions 1–4; R-1, R-2, Q1; AC-1…AC-22
- Files/components: lib/auth/{join-intent,join-intent-cookie}.ts (new), lib/auth/{verify-state,invite-path}.ts, features/auth/actions.ts, features/joining/copy.ts, features/joining/components/{JoinContent (rewritten, typed audience),InvitePreviewView,InviteActions,SignedInInvite (new),JoinForm,AskToJoin,InviteUnavailable,InviteSkeleton}.tsx, app/(public)/i/[inviteToken]/{page,join/page,loading,join/loading}.tsx, tests (unit + 3 e2e specs), docs.
- Work completed: typecheck, lint, tokens:check pass; unit 373/373; e2e invite-join + approval-participants + activity 75 run: 71 pass, 3 locator fixes re-passed 3/3, 1 environmental (machine sleep) re-passed 3/3. No database change.
- Outstanding issues (deviations): (103) intent cookie not cleared by the actions (Next re-renders on cookie change) — expires after 30 min instead; (104) loading skeleton is the existing line skeleton, not the board shapes; (105) pending copy: organiser-draws How it works step 2, faces line for 1 person and for 6+. Signed-out label "Join exchange" per board.
- Next action: tester verifies AC-1…AC-22 and visuals; owner decides 103–105.

## Owner decisions on builder deviations — 2026-11-18 (Tobechukwu Olih)
- 103: accept — intent cookie expires after 30 minutes; not cleared by the actions.
- 104: match the board — redraw the loading skeleton with the board's shapes (36 avatar + line, 48 tile + title, 3-face stack, 4 lines); buttons as built.
- 105: approve all three lines ("{First} is in.", "{names} and {n} others are in.", organiser-draws step 2 "When {First} is ready, we draw names. Only you see who you're buying for.").

## Tester — round 1 — 2026-11-18
- Task: join-one-screen — verify AC-1…AC-22 and visuals
- Requirements: as above
- Files/components: as builder round 1
- Work completed: typecheck, lint, tokens:check pass; unit 373/373; e2e 74/75 (1 Participants decline flake passed alone). AC-1 (no names/note/emails in signed-out HTML), AC-17 (crafted /join creates nothing), decision 2 flows, changed states, copy, axe, time zone: pass. AC-18 cookie attributes by code read only; AC-11 one request row (E08 count not checked); AC-20 unit only. Verdict PASS with caveats.
- Outstanding issues: T1-1 (Medium) busy/error/offline/loading states not covered by e2e or screenshots; T1-2 (Low) /login?next=/i/<t>/join followed by a real sign-in auto-joins (banner shows the exchange; consistent with R-2); T1-3 (Low) decline test flake. Guest board still draws names/note (decision 1 overrides; board stale).
- Next action: builder round 2 — skeleton to board (104), e2e + screenshots for busy/error/offline/loading (T1-1), mark the 105 lines approved in copy-pending.

## Builder — round 2 — 2026-11-18
- Task: join-one-screen — skeleton to board (104), e2e for busy/error/offline (T1-1), copy and open items
- Requirements: GC-002, GC-009; owner decisions 103–105; T1-1
- Files/components: components/ui/Skeleton.tsx (shape="box"), features/joining/components/InviteSkeleton.tsx, tests/e2e/invite-join-signed-in.spec.ts, docs/copy-pending.md, docs/progress.md
- Work completed: skeleton redrawn to board; new e2e "busy, error and offline states" 3/3 with screenshots; 105 lines approved; items 103–105 closed. typecheck, lint, tokens:check pass; unit 373/373.
- Outstanding issues: loading state has no e2e (next dev doesn't prefetch, so loading.tsx can't be held); checked visually via a throwaway page, not committed.
- Next action: tester narrow retest; then reviewer.

## Tester — round 2 (narrow) — 2026-11-18
- Task: join-one-screen — retest skeleton (104), busy/error/offline e2e (T1-1), docs 103–105
- Requirements: GC-002, GC-009; decisions 103–105; T1-1
- Files/components: InviteSkeleton.tsx, Skeleton.tsx, invite-join-signed-in.spec.ts, copy-pending.md, progress.md
- Work completed: typecheck, lint, tokens:check pass; unit 373/373; busy/error/offline e2e 3/3; skeleton tokens-only with role=status; docs match decisions; no throwaway files. Verdict PASS.
- Outstanding issues (Low): shared OfflineBanner spans full width on desktop with its own Try again (shared component, pre-existing); loading state checked by code only.
- Next action: reviewer.

## Reviewer — round 1 — 2026-11-18
- Task: join-one-screen — full review
- Requirements: GC-002, GC-003, GC-004, GC-005, GC-009, GC-012; decisions 1–4; R-1, R-2, Q1; 103–105
- Files/components: as builder rounds 1–2
- Work completed: Verdict APPROVED. Security verified by code read: guest type has no people/note/email; intent cookie written only after a real verify with anchored next; SameSite=Strict blocks cross-site; /join re-checks state; only own email shown.
- Outstanding issues (Low): R1-1 GC-009 said "once" — main session reworded to the 30-minute, not-single-use intent (decision 103); R1-2 crafted /login?next=…/join auto-joins after a real sign-in (accepted under R-2); R1-3 none. Guest board out of date vs decision 1; E08 once per auto-request not observed.
- Next action: owner approves commit and PR; owner click-through.
