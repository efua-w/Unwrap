# Unwrap — User Stories v1.1

Oct 30, 2026 · @Tobechukwu Olih

This is the living copy. The approved v1.1 original is kept unchanged in [user-stories.baseline.md](user-stories.baseline.md).

## Decisions since v1.1

Each decision below is rewritten into the stories it affects, which carry an **Updated** note with its date. Decided by Tobechukwu Olih on 2026-11-03, except the rows dated 2026-11-09.

| Area | Decision | Stories |
| --- | --- | --- |
| Phone sign-in | No phone number and no SMS login in v1. Sign-in is by email code only. No Twilio. | GC-003, GC-004, GC-024, GC-025 |
| Invite QR code | Dropped from v1. | GCO-005 |
| Budget ranges | The presets are: ₦5,000 to ₦10,000; ₦10,000 to ₦20,000; ₦20,000 to ₦50,000; Above ₦50,000. These override any ranges shown in the designs. | GCO-002, GCO-010 |
| Telling exchanges apart | Exchanges are told apart by their colour tint, even when two share an initial. | GC-008, GC-006 |
| Exchange size | At most 100 people in an exchange. This is the invite limit and what "full" means. | GC-009, GCO-005 |
| Rejoining | Someone who left an exchange can rejoin through the invite link, under the normal join rules. Someone the organiser removed can also rejoin, but always as a join request the organiser must approve, even when approval is off. | GC-017, GC-009, GCO-007 |
| Open design questions | Where the designs and stories left a question open (Names drawn as its own page, the Verify button, Reopen joining as its own page), build what the designs show. | GC-003, GCO-012, GCO-007 |
| Gift day (2026-11-09) | The gift day is a date only, with no gift time. This replaces the v1.1 "Event time" row. The organiser sets it in their own time zone. It counts as passed at the end of that day in the organiser's time zone. The gift day is shown as stored, the same date for every viewer; only the end-of-day cutoff uses the organiser's time zone (owner, Q2, 2026-11-09). The join-by day must be before the gift day, in both draw modes (owner, Q1, 2026-11-09). The event reminder (E24) goes at 9:00 am the day before the gift day, in each person's time zone. Join-by and the draw time keep their times. | GC-002, GC-009, GC-013, GC-014, GC-015, GC-026, GCO-002, GCO-004, GCO-010, GCO-015 |
| Organiser's own list (2026-11-09) | S49 "Your list for this exchange" is its own page. An organiser taking part reaches it from S14 › Your part. They attach a whole wishlist or add ideas just for this exchange. Boards Org-List-* and Exchange-Detail-oattached / -oideas. | GC-010, GCO-004 |
| Creation limits (2026-11-13) | Each person can start at most 10 exchanges, 30 wishlists and 300 items in an hour. Past that the action fails with the normal save error, and works again once the hour has passed. Decided by Tobechukwu Olih. | GCO-001, GC-019, GC-021 |

## What changed in v1.1

Version 1.1 folds in the UX architecture decisions: 28 stories are updated (18 participant, 10 organiser) and none are removed. Mobile-first web app. Every story marked **Updated in v1.1** carries a one-line note of what changed.

| Area | Decision | Stories |
| --- | --- | --- |
| Reminders | Automatic emails 24 hours before join-by (to people taking part with no wishlist) and, from 2026-11-09, at 9:00 am the day before the gift day in each person's time zone (to everyone taking part). Shown in Activity too. | GC-006, GC-007, GC-010, GC-011, GC-026 |
| Pair secrecy | Fix the pairs is a blind system re-match; the organiser only confirms and never sees a name | GC-017, GCO-007 |
| Re-match impossible | When the leaver and their giver had drawn each other, the organiser confirms a full re-draw (before the event only) | GC-017, GCO-011 |
| After the event | A giver who loses their person is given someone at random by the system; the organiser confirms, warned that one person will have two givers | GC-017, GCO-011 |
| Re-draw notice | Everyone gets the names-drawn email; people whose person changed get an added note that names nobody | GC-014, GCO-012 |
| Invite preview | Inviter + count only; faces and names appear after sign-in | GC-002, GC-009 |
| Reveal privacy | "Hide again" hides the name on Reveal and the exchange page, per device | GC-013, GC-014 |
| Sign-up | Email only; phone added later in Settings | GC-003 (no change) |
| Profile setup | Skipped for invitees, who keep their sign-up name and get a photo prompt later; Landing sign-ups still see it | GC-005, GC-006, GC-009 |
| Pending at draw | Request closes; shown on the requester's Home only | GC-006, GC-012 |
| Removed person | Neutral email: "You're no longer in {exchange}." | GCO-007, GC-029 |
| Only 2 left after the draw | Organiser chooses: invite more (joining reopens with a new join-by, event must be ahead, then a full re-draw) or cancel | GC-012, GC-017, GCO-007 |
| One list per exchange | Wishlist, ideas and kept items all show as "Your list for this exchange", with a source subline | GC-010, GC-011, GC-013, GC-015, GC-030 |
| Time zones | Every date and time shows in the viewer's own time zone | GC-013, GCO-002 |
| Event time | ~~The organiser sets an event time as well as a date~~ Replaced 2026-11-09: the gift day is a date only (see Decisions since v1.1) | GCO-002, GCO-004, GCO-010 |
| Never drawn, event passed | To draw, the organiser sets a new event date first; or cancels | GCO-015 |
| Completion | Organiser marks it complete after the event; otherwise it completes 7 days after the event | GCO-015 |
| Organiser not taking part | Same layout; Your part says "You're just organising" | GC-006, GC-013 |
| Hand over organising | In v1, instant, can't be declined; new organiser can pass it on; only people taking part are eligible; an organiser who wasn't taking part leaves | GCO-013, GCO-014, GC-028 |
| Desktop | Left sidebar for the four sections; personal action as a banner above page content | GC-006, GC-008 |

## Participant stories

Every signed-in user. Anyone can be a participant in one exchange and an organiser in another. Visitors (no account) only see landing, invite preview and shared wishlists.

| ID | Epic / Feature | As Participant, I want to… | v1.1 |
| --- | --- | --- | --- |
| GC-001 | Entry: Landing | Understand what Unwrap is before signing up |  |
| GC-002 | Entry: Invite preview | Preview an exchange I've been invited to without logging in | Updated |
| GC-003 | Authentication: Sign up | Create an account with just my first name and email | Updated |
| GC-004 | Authentication: Log in | Log back in with a one-time code |  |
| GC-005 | Onboarding: Profile setup | Set the name and photo people in my exchanges will see | Updated |
| GC-006 | Home | See what needs me across all my exchanges and wishlists | Updated |
| GC-007 | Activity | See a timeline of what happened in my exchanges | Updated |
| GC-008 | Exchanges: List | See every exchange I organise or belong to | Updated |
| GC-009 | Joining: Confirm | Confirm joining an exchange and see what I'm agreeing to | Updated |
| GC-010 | Joining: Attach wishlist | Pick one of my wishlists or add ideas now | Updated |
| GC-011 | Joining: You're in | See that I'm done and what happens next | Updated |
| GC-012 | Joining: Invite unavailable | Understand why an invite link doesn't work and what I can do | Updated |
| GC-013 | Exchange detail | See where an exchange stands and what I need to do | Updated |
| GC-014 | Draw & gifting: Reveal | Privately reveal who I'm buying for | Updated |
| GC-015 | Draw & gifting: Recipient's wishlist | Browse my recipient's wishlist, open items and privately mark what I've bought | Updated |
| GC-016 | Draw & gifting: Ask for a hint | Ask my recipient for a hint without revealing myself |  |
| GC-017 | Exchanges: Leave | Leave an exchange I joined | Updated |
| GC-018 | Wishlists: List | See all my wishlists and who can see each one |  |
| GC-019 | Wishlists: Create / edit list | Create or edit a wishlist and choose who can see it |  |
| GC-020 | Wishlists: Detail | View and maintain one list |  |
| GC-021 | Wishlists: Add / edit item | Add an item with a link, price and a note for my giver |  |
| GC-022 | Wishlists: Share | Share a wishlist outside an exchange |  |
| GC-023 | Wishlists: Shared view | Open a friend's shared wishlist without an account |  |
| GC-024 | Account: Profile | Edit how I appear to others |  |
| GC-025 | Account: Settings | Change my email | Updated 2026-11-03 |
| GC-026 | Account: Notifications | Choose how I'm told about each thing | Updated |
| GC-027 | Account: Privacy | See and control who sees my stuff |  |
| GC-028 | Account: Delete | Delete my account and understand the consequences | Updated |
| GC-029 | System: Unavailable & offline | Get a clear message when something is gone or I'm offline | Updated |
| GC-030 | Wishlists: Delete an attached list | Delete a wishlist that is attached to one or more exchanges | Updated |

## Entry and authentication

### GC-001 · Entry: Landing

**Updated 2026-11-04 (Tobechukwu Olih):** the Landing copy follows the design board, and the Content lines below are changed to match (full stop after "spreadsheet"; "Only you see who you got. Not even the organiser."). Slice 1 built it as a static page.

**As Participant, I want to** understand what Unwrap is before signing up, **so that** I can decide if it's worth an account.

#### Context

- A. Landing (logged out). Entry: direct URL, search, shared-wishlist footer, logged-out deep-link fallback.

#### In scope — Dev tasks

- Value proposition + 3-step how it works (start, share link, we draw).
- Trust cues: free, only you see your person, no passwords.
- Get started → GC-003; Log in → GC-004.

#### Edge cases — Non-standard scenarios

- Assets fail to load → offline banner; page is static and renders immediately.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Assumption: mobile-first web, not a native app.

#### Content

- "Secret Santa, without the spreadsheet."
- "Only you see who you got. Not even the organiser."

### GC-002 · Entry: Invite preview

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** built as `/i/[inviteToken]`. The board lines replace the one-sentence explainer: "{Inviter} invited you", "{N} people have joined so far." (hidden at 0, where the board says "You'd be one of the first to join."; one person reads "1 person has joined so far."), and "How it works" with three steps. The count is active members other than the organiser (Q5). Join this exchange goes to Sign up when signed out (with the invite carried, GC-003), to the join confirmation when signed in, and to the exchange page for a member. A link that is wrong, reset, closed, cancelled or full shows Invite unavailable (GC-012) with status 200 and no search indexing (Q10). The page is `noindex`, sends no referrer, and its title is generic. Not in v1: "Open in browser" fallback, Switch account, QR. Manual-draw exchanges read "Names drawn" as the join-by moment until the preview returns the draw mode (open item, owner decision pending).

**Updated in v1.1:** the public preview shows a count of who has joined, not faces or names. Shows the event time.

**Updated 2026-11-09 (Tobechukwu Olih):** the gift day is a date only, with no gift time (board Entry-Invite: "Gift day Thu 24 Dec").

**As Participant, I want to** preview an exchange I've been invited to without logging in, **so that** I can trust the link and decide to join.

#### Context

- A. Invite preview (public). The most common entry point — a link dropped in a WhatsApp group, often opened in WhatsApp's in-app browser.
- B. Critical moment: must prove the invite is legit before asking for anything.
- C. Because the link can be forwarded to strangers, the public preview never shows who has joined. Faces and names first appear on Join confirmation (GC-009), once the person is signed in.

#### In scope — Dev tasks

- Show inviter name + photo, exchange name, budget range (₦), join-by, gift day (date only), how many people have joined (count only), 3-line explainer.
- All dates and times show in the viewer's own time zone.
- Join this exchange: not signed in → GC-003 (every participant needs an account; join resumes after); signed in → GC-009; already a member → exchange detail (GC-013).
- Skeleton of inviter, title and dates while the link resolves.

#### Edge cases — Non-standard scenarios

- Invalid / expired / cancelled / closed link → Invite unavailable (GC-012).
- Link forwarded to a stranger → approval setting applies (GCO-003); the stranger sees only the inviter and a count.
- No one else has joined yet → show only the inviter, no count line.
- Signed in as the wrong account → Switch account: not in v1 (the join confirmation shows "Joining as {name}, {email}").
- Joining reopened after the draw (GCO-007, only 2 left) → the preview works again until the new join-by.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (High): sign-up wall kills joins — preview must come before any account step.
- Risk (High): in-app browser breakage — provide "Open in browser" fallback; resume join after login.
- Risk (Med): a count alone is weaker proof than faces; the inviter's name and photo carry the trust.

#### Content

- "Amaka Obi invited you"
- "{N} people have joined so far." (board; replaces "{N} people have joined")
- "How it works": "Join and add a wishlist so your giver has ideas." / "On {day} we draw names for everyone." / "You find out who you are buying for. Only you." (boards Entry-Invite-*; replaces the one-sentence explainer, 2026-11-13)

### GC-003 · Authentication: Sign up

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** when an invite is pending, Sign up, Log in and Verify show "You're joining {exchange}" above the title (the banner comes only from an exact `/i/<token>` or `/i/<token>/join` next, never from other paths). After Verify with an invite pending the person goes straight to the join confirmation and skips Profile setup (Q1): joining sets `onboarded_at` and keeps the name typed at sign-up; "Not now" goes to Home, which then shows Profile setup. A Landing sign-up still reaches Profile setup. Verify shows the banner when the verify cookie holds the invite (not when only the localStorage backup restores it; open item).

**Updated in v1.1:** sign-up stays email only. Invitees skip Profile setup. Returning to the page after fetching the code must resume, not restart.

**Updated 2026-11-03 (Tobechukwu Olih):** no phone number can be added later; phone login is not in v1.

**Updated 2026-11-04 (Tobechukwu Olih), slice 1:**
- **Existing account.** Continue first asks the server whether the address has a confirmed account (a server-only check; owner decision 2026-11-04). Only a confirmed account gets "There's already an account with this email.": Sign up then asks for a log-in code with sign-ups off, so a real log-in code (E02) has already been sent, and "Log in with this email" goes straight to Verify for that code. Account enumeration is accepted. The server check itself can tell, silently and without a limit, whether an address has a confirmed account; accepted until launch and closed before launch by Turnstile and a per-IP rate limit (progress item 29; owner decision 2026-11-04).
- **Abandoned sign-ups.** An address that started sign-up but never verified continues as a sign-up: it gets the sign-up code (E01) and Verify, then Profile setup. The name it first signed up with is kept (Supabase does not replace it), and Profile setup lets the person change it. If the server cannot check, Sign up falls back to the log-in-code check, which shows "Account exists" for an abandoned sign-up too. Either way the destination after Verify is decided from the verified user: a first confirmation always goes to Profile setup (GC-005), even from Log in, keeping the deep link.
- **Verify.** There is no Verify button (the designs show none). The resend countdown is 60 seconds (also shown as the wrong-code state's resend, once the 60 seconds are up). The saved state is a 30-minute httpOnly cookie plus a localStorage backup that is removed when stale and on Log out.
- **Name.** First name: at most 50 characters; longer or emoji-heavy names are cut safely (whole characters, counted in code points).

**As Participant, I want to** create an account with just my first name and email, **so that** I can join or start an exchange in under a minute.

#### Context

- A. Sign up → Verify code. Passwordless one-time code only (works inside in-app browsers). No Google or other social sign-in.
- B. Entry: Landing "Get started", Invite preview "Join" (carries invite context), Log in "Create an account".

#### In scope — Dev tasks

- Fields: first name, email.
- Invite context banner when arriving from Invite preview ("You're joining Cousins' Christmas 2026").
- Continue emails a 6-digit code, valid for 10 minutes. The email carries the code only, with no link. Auto-submit when all digits are in; resend after cooldown; change email.
- Verify code keeps its state (email, invite context, cooldown) when the person leaves for their email app and comes back, including inside WhatsApp's in-app browser. If the page reloads, it reopens on Verify code for the same email, not on Sign up.
- On verify: invite pending → GC-009 (Profile setup is skipped; the sign-up first name is used); new user with no invite → GC-005; else Home or original deep link.
- Phone numbers and SMS login: not in v1 (decided 2026-11-03).

#### Edge cases — Non-standard scenarios

- Account already exists → route to Log in.
- Wrong / expired code; too many attempts; send rate-limited.
- Code email opened in a different app or browser than the webview → there's no link to follow; the code is typed where sign-up started, so the session completes there.
- In-app browser discards the page while the person is in their email app → reopen on Verify code with the email kept; the code already sent still works.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Dependency: email code delivery.
- Risk (High): leaving the in-app browser to fetch the code loses the session.

#### Content

- "No password needed."
- "It checks automatically once all 6 digits are in."

### GC-004 · Authentication: Log in

**Updated 2026-11-03 (Tobechukwu Olih):** email code only; phone login and SMS are not in v1.

**Updated 2026-11-04 (Tobechukwu Olih), slice 1:** Log in never creates an account (the code is requested with sign-ups off), so an unknown address shows "We couldn't find an account with this email." with "Create an account with this email" (it carries the address to Sign up, not in the URL) and "Try a different email". A code that is refused for too many requests shows the same alert as Sign up. After Verify: a returning person goes to `next` or Home; a first confirmation (an abandoned sign-up) goes to Profile setup. A signed-in person opening Log in goes to `next` or Home.

**As Participant, I want to** log back in with a one-time code, **so that** I can get back to my exchanges and lists.

#### Context

- A. Log in → Verify code. One-time code only; no Google sign-in. Entry: Landing, Invite preview, Sign up "Log in", session expired.

#### In scope — Dev tasks

- Email field; Send code → Verify code.
- The 6-digit code goes by email (code only, no link).
- Phone login and SMS codes: not in v1.
- Invite context banner when relevant.
- After verify: invite pending → GC-009, else Home or original deep link.

#### Edge cases — Non-standard scenarios

- No account found → Sign up.
- Rate-limited; offline.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Dependency: same email code service as GC-003.

#### Content

- "Welcome back"

### GC-005 · Onboarding: Profile setup

**Updated in v1.1:** shown only to new users who didn't arrive from an invite. Invitees are prompted to add a photo later.

**Updated 2026-11-04 (Tobechukwu Olih), slice 1:** Profile setup is name only for now: the photo control and its upload states move to slice 17, and everyone sees initials until then. The display name is limited to 50 characters, enforced in the database as well. Continue opens `next` if there is one (a deep link kept through sign-up), otherwise Home.

**As Participant, I want to** set the name and photo people in my exchanges will see, **so that** my group recognises me.

#### Context

- A. Profile setup — first sign-in only, and only when the person did not arrive from an invite (Landing "Get started", Log in "Create an account").
- B. Invitees skip this step to keep the join short. Their sign-up first name is their display name, and they see initials until they add a photo.

#### In scope — Dev tasks

- Display name (prefilled from sign-up); optional photo with local preview + upload progress.
- No photo → initials avatar.
- Continue → Home (new-user state).
- Photo prompt for anyone with no photo (invitees and people who skipped it): a dismissible line on Home and in Your part on exchange detail, linking to Profile (GC-024). Dismissed → not shown again.

#### Edge cases — Non-standard scenarios

- Upload failed / file too large → keep name, allow retry or skip.
- Very long or emoji-only names → truncate safely.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Assumption: first + last name encouraged for big groups, not required.
- Risk (Low): invitees known only by first name can be ambiguous in large groups; the photo prompt mitigates.

#### Content

- "How should people see you?"
- Photo prompt: "Add a photo so your group knows it's you."

## Home, Activity and Exchanges

### GC-006 · Home

**Updated in v1.1:** adds pending and closed join-request states, the photo prompt, reminder copy, the organiser-only case and the desktop banner.

**Updated 2026-11-04 (Tobechukwu Olih), slice 1:** only the new-user (first-time) state is built: the date line in the viewer's own time zone, "Welcome, {name}.", the three steps with Start an exchange and Make a wishlist, and the invite line. Those two buttons link to routes later slices build. The other states arrive with the slices that create the data.

**As Participant, I want to** see what needs me across all my exchanges and wishlists, **so that** I know my next action and next date at a glance.

#### Context

- A. Home. Entry: after sign-in, Home tab, app open.
- B. Hierarchy: Needs you first (own action in the bottom tray on mobile, a banner above the page content on desktop; organiser blocks at top), then exchanges, then wishlists.
- C. Navigation: bottom tabs on mobile; a left sidebar with Home, Exchanges, Wishlists and Activity on desktop. Activity's unread badge shows in both.

#### In scope — Dev tasks

- Action tray (mobile) / banner (desktop) shows the single most urgent personal action (soonest deadline; an unrevealed draw, or a changed person after a re-draw, counts as due today) + "+N more need you". The mobile tray shrinks to its button while scrolling.
- Up to two organiser blocks (see GCO-006), then "See all". A block for an exchange with join requests says "Needs you now", "{Name} wants to join." / "{N} people want to join.", who is waiting and until when people can join, with Review request / Review {N} requests → Participants.
- The organiser block's "Needs you by {date}" uses the join-by date.
- Your exchanges (status, next date); Your wishlists (who-can-see icon, "{N} items · updated {date}").
- Join request pending (approval on): a row in Your exchanges, "Request sent. Waiting for {organiser} to let you in." No action.
- Join request closed by the draw: the same row becomes "Names were drawn before {organiser} could let you in." with Dismiss. No email is sent.
- An organiser who isn't taking part sees their exchanges with organiser blocks only; no personal action is created for them.
- Photo prompt (GC-005) for anyone with no photo, below the action area, dismissible.
- States: new user (how it works as three numbered steps + Start exchange / Make a wishlist); all caught up (block naming the next date); loading skeleton (slow line after 8s); error (section retry); offline banner (GC-029).
- All dates and times show in the viewer's own time zone.

#### Edge cases — Non-standard scenarios

- Many exchanges needing action at once → one in tray, rest counted.
- Browser notifications blocked → not applicable in v1 (no web push).
- "All caught up" names the next date. It may say an email reminder comes the day before join-by or the event (GC-026), only if that reminder type is on.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- No web push in v1. Reminders go by email and the Activity feed.

#### Content

- "Needs you now"
- "All caught up. Nothing needs you right now."
- "Request sent. Waiting for {organiser} to let you in."
- "Names were drawn before {organiser} could let you in."

### GC-007 · Activity

**Updated in v1.1:** adds event types for reminders, re-draws, changed people, hand-over and reopened joining.

**As Participant, I want to** see a timeline of what happened in my exchanges, **so that** I can catch up and act on changes.

#### Context

- A. Activity — 4th tab on mobile, 4th sidebar item on desktop (unread badge shows in every screen).

#### In scope — Dev tasks

- Grouped by day. v1 event types:
  - Names drawn (everyone taking part, links to Reveal).
  - Names drawn again (everyone taking part, links to Reveal; "Your person has changed" added only for those whose person changed).
  - Your person has changed after a blind re-match or assignment (only the giver affected, links to Reveal).
  - Someone joined / asked to join (organiser, links to Participants).
  - Dates changed (everyone but the organiser).
  - Join-by reminder (people taking part with no wishlist, 24 hours before join-by).
  - Event reminder (everyone taking part, at 9:00 am the day before the gift day in each person's time zone; updated 2026-11-09, Tobechukwu Olih).
  - Joining reopened (everyone taking part, GCO-007).
  - You're now the organiser (new organiser, GCO-014); {name} is now the organiser (everyone else).
  - Exchange complete (GCO-015).
- Unread markers; Mark all as read; tap → destination screen; link to notification preferences (GC-026).
- Never shows a recipient's name, and never says whose person changed except to that person.
- Hint requests: not in v1 (GC-016).

#### Edge cases — Non-standard scenarios

- Target deleted → Not available (GC-029).
- Removed from an exchange → its events stay, but tapping them opens "You're no longer in {exchange}" (GC-029).
- Load failed → retry; older items paginated.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Only the database writes events; you read and mark only your own; no event says who gives to whom.

#### Content

- Empty: "You're all caught up." / "When something happens in your exchanges, it'll show here."

### GC-008 · Exchanges: List

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** Exchanges lists joined exchanges as well as the ones the person organises (slice 5). Member rows: "You joined today. Names are drawn {date}." (board Exchanges-joined); a person who joined earlier reads "You're in. Names are drawn {date}."; organiser-draws exchanges say "Names are drawn when the organiser is ready." (members) or "You draw names when you're ready." (organiser). An organiser's row with people in reads "You created this. {N} people in. Names are drawn {date}." and, when only organising, "You're just organising. {N} people in. Names are drawn {date}."; this replaces the slice 4 line "{N} people in." until readiness counts arrive with slice 8. Pending, request and closed-request rows stay with slices 6 to 10.

**Updated 2026-11-09 (Tobechukwu Olih):** until slice 6 the load error reads "We couldn't load your exchanges. Your wishlists still work.". Each exchange has a tint (clay, peach, sand or mint): the one the organiser uses least among their live exchanges, ties broken at random, and it never changes. Slice 4 lists the exchanges the person started; joined, pending and closed-request rows arrive with slices 5 to 10.

**Updated in v1.1:** desktop personal action is a banner; pending and closed requests show as rows; organiser-only exchanges are marked.

**As Participant, I want to** see every exchange I organise or belong to, **so that** I can find a specific one fast.

#### Context

- A. Exchanges. Entry: Exchanges tab (mobile) or sidebar (desktop), Home "See all".

#### In scope — Dev tasks

- List rows: name, one written sentence of status/next date, faces on the right.
- Exchanges I created are marked in the subtext ("You created this."). Exchanges I organise but don't take part in say "You're just organising."
- Active / Past switch (labels only, no counts).
- Start exchange at the end of the list → GCO-001. Primary style, unless an organiser block above already shows a primary button; then secondary.
- Organiser blocks show join requests: "{Name} wants to join." + "Approve or decline {first name}'s request. People can join until {date}." / "{N} people want to join." + "{A, B and C} are waiting for you to approve or decline them. …", with Review request / Review {N} requests → Participants.
- One personal action: an unrevealed draw or a changed person ("Needs you now", Reveal who you got), otherwise an exchange you joined today without a wishlist ("You're in" / "{exchange}: you've joined." / "Names are drawn {date}. Add a wishlist so your giver knows what you'd like." / Add a wishlist). Pinned above the tab bar on mobile, a banner above the list on desktop. The joined row reads "You joined today. Names are drawn {date}."
- Pending request row: "Request sent. Waiting for {organiser}." Closed request row: "Names were drawn before {organiser} could let you in." Both sit in Active until dismissed.
- States: first time (how it works + Start exchange); empty; past empty (quiet note, no CTA); loading; error; offline; joined success.

#### Edge cases — Non-standard scenarios

- Deleted exchange opened from a stale link → "This exchange isn't available to you".
- Removed from an exchange → it leaves the list; a stale link shows "You're no longer in {exchange}" (GC-029).
- Organiser hands over without taking part (GCO-014) → the exchange leaves their list.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Exchanges uses an Active/Past switch on its own screen; past exchanges elsewhere are a text link.
- Pronouns: use the person's name or "they" — we don't know anyone's pronouns.

#### Content

- "You're in. Church choir Kris Kringle: you've joined."
- "You're just organising."

## Joining

### GC-009 · Joining: Confirm

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** built as `/i/[inviteToken]/join`. Shows what you're agreeing to, the organiser, faces and names of people already in, budget, join-by, names-drawn moment (or "When {first name} is ready" for organiser-draws), gift day, the organiser's note, and "Joining as {name}" with the person's own email only. Only `join_exchange(token)` creates a membership: one active membership per person, idempotent, the 100-person limit counts every active row including the organiser (Q5), a person who left can rejoin, a removed person is refused, and an approval-required exchange admits nobody directly until slice 6 (Q2). Join exchange goes to the attach page (`/exchanges/[id]/list?from=join`); a refusal re-renders as Invite unavailable; a failed attempt keeps everything and offers Try again. A person without Profile setup may join (Q1). Not now goes to Home.

**Updated in v1.1:** first screen to show faces and names. Invitees arrive here straight from Verify code.

**As Participant, I want to** confirm joining an exchange and see what I'm agreeing to, **so that** I join with the right account and know the rules.

#### Context

- A. Join confirmation. Entry: Invite preview when signed in; straight after Verify code with a pending invite (Profile setup is skipped for invitees, GC-005).

#### In scope — Dev tasks

- Show exchange, organiser, participant faces and names (first shown here, not on the public preview), budget (₦), join-by, draw date and time, gift day (date only; updated 2026-11-09, Tobechukwu Olih), organiser's note, signed-in account. All in the viewer's own time zone.
- Join exchange → GC-010; Not now. (Switch account: not in v1.)
- If the organiser approves joins → request sent, user lands on Home with the pending row (GC-006).

#### Edge cases — Non-standard scenarios

- Already a member → exchange detail.
- Exchange closed, full (100 people) or already drawn → GC-012 (unless joining was reopened, GCO-007). (100-person limit decided 2026-11-03 by Tobechukwu Olih.)
- Someone who left before → can join again under the normal rules. Someone the organiser removed → can ask again; it always becomes a join request the organiser approves, even when approval is off (decided 2026-11-03 by Tobechukwu Olih).
- Same person invited twice (two identifiers).

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Dependency: GCO-003 approval setting.

#### Content

- "What you're agreeing to"
- "Joining as Ifeoma Nwosu"

### GC-010 · Joining: Attach wishlist

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** built as `/exchanges/[id]/list` (S11). Skip for now shows only when reached from Join (`?from=join`, Q11); from the exchange page the page has Back and no Skip. Choose a wishlist opens a picker ("Use this wishlist"); Add items instead makes an ideas list for this exchange (add, edit, remove with Undo, names in single quotes, Q9). A chosen wishlist replaces the ideas; the ideas are kept and return when the person switches back. Ideas never appear in My wishlists, cannot be shared and cannot be attached elsewhere. Nobody sees whether another person has added a list. A failed attach shows "We couldn't attach '{name}'. Nothing has changed, so you can try again." with Try again. After the draw (slice 11) and deleting an attached list (slice 16) are out of this slice. Toasts "Wishlist attached. Your giver will see it after the draw." and "Your list is ready. Your giver will see it after the draw." show on the exchange page.

**Updated in v1.1:** whatever is attached shows as one "Your list for this exchange" with a source subline. Skip for now is backed by the join-by reminder email.

**Updated 2026-11-09 (Tobechukwu Olih):** the organiser's own list is its own page, S49, entered from S14 › Your part. Boards Org-List-* and Exchange-Detail-oattached / -oideas. It works as below, with no Skip: Back leaves without a list. See GCO-004.

**As Participant, I want to** pick one of my wishlists or add ideas now, **so that** my giver knows what I'd like.

#### Context

- A. Attach wishlist. Entry: Join confirmation, exchange detail (including the organiser's own), Exchanges list "only you" block, Home action.
- B. A wishlist can also be added after the draw if none was attached, and an attached one can be removed.
- C. Two ways in: "Choose a wishlist" (primary) and "Add items instead" (secondary). Add items instead adds ideas one at a time, just for this exchange; they are never added to my Wishlists.
- D. One concept for people: "Your list for this exchange". It can come from three sources, named in a subline in Your part and on You're in:
  - Attached wishlist: "From '{wishlist name}'. Changes when you edit that list."
  - Ideas: "Only for this exchange."
  - Kept from a deleted list (GC-030): "Kept from a list you deleted. It can't be changed now."

#### In scope — Dev tasks

- Show the exchange budget as a price guide; the picker lists my wishlists (name, "{N} items · updated {date}").
- Choose a wishlist (primary; opens a picker sheet with "Use this wishlist") / Add items instead (secondary) / Skip for now (not after the draw). Skipping means a join-by reminder email goes 24 hours before join-by, if that type is on (GC-026).
- Add items instead → "Add an item", the same fields as a wishlist item (GC-021): "Only the person who draws your name will see it. It won't be added to your wishlists." → "Your list for this exchange (n) · Only for this exchange" with Done / Add another item, toast "Added '…'." with Undo. Tap an idea to edit it; a bin at the end of its row removes it ("Removed '…'." with Undo).
- Ideas count as my list in this exchange only while there is at least one; my giver sees them like any attached list.
- Ideas never show in my Wishlists, can't be shared by link and can't be attached to another exchange.
- Your part (exchange detail) shows "Your list for this exchange" with its source subline and item count: "{N} items. Your giver will see them after the draw." before the draw, "{N} items. Only your giver can see them." after. After the draw the row opens Attach wishlist.
- Say that the list picked is visible only to my giver, after the draw — not to everyone in the exchange.
- After the draw, with nothing attached: Your part shows "Add your wishlist / Your giver has nothing to go on yet." The attach page says "Your giver will see the list you pick as soon as you attach it.", has no Skip, and returns to the exchange with "Wishlist attached. Your giver can see it now."
- After the draw, with a list attached: "Remove wishlist…" → "Remove your wishlist from {exchange}? Your giver won't see it any more. The list stays in your Wishlists, and you can attach it again later." → toast "Wishlist removed from {exchange}." with Undo. To change lists after the draw, remove then add.

#### Edge cases — Non-standard scenarios

- No wishlists → "Choose a wishlist" is unavailable, with the reason: "You don't have any wishlists yet, so add a few items instead."
- Ideas added, then a wishlist chosen before the draw → the wishlist replaces the ideas (kept hidden; Add items instead brings them back).
- After the draw, ideas can be added only if nothing else is attached; removing the last idea leaves me with no list here.
- List deleted meanwhile; attach failed → retry.
- A Private list attached → it stays Private; only my giver in this exchange can see it, after the draw.
- After the draw, a list kept from a deleted wishlist (GC-030) can't be removed or replaced.
- Removing keeps my giver's got-it marks; Undo brings the list back with them. Nobody is told.
- Full re-draw (GCO-011) → my list stays attached; my new giver sees it.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (High): empty or vague wishlists bring back guessing.

#### Content

- "Tell your giver what you'd like"
- "Your list for this exchange"

### GC-011 · Joining: You're in

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** built as `/exchanges/[id]/joined` (S12). Shows "You're in", the timeline (names drawn, gift day), the list status with its source line, "There's nothing else to do until names are drawn.", Go to exchange and Close. Left out until the features exist: the notification and email promises (slices 7 and 12, Q8), "Share the invite link" (the token stays organiser-only, Q7) and the "You're in" action card (slice 10, Q12). A skipped list reads "No list yet" and "Add one before {day}."; the email sentence is omitted.

**Updated in v1.1:** names the list as "Your list for this exchange" and can mention reminder emails.

**As Participant, I want to** see that I'm done and what happens next, **so that** I know there's nothing to do until the draw.

#### Context

- A. You're in. Entry: Attach wishlist success or skip.

#### In scope — Dev tasks

- Timeline: names drawn → event day and time (viewer's time zone); list status ("Your list for this exchange" with its source subline, or missing; editable until the draw); how I'll be notified.
- How I'll be notified: an email when names are drawn, plus reminder emails the day before join-by (only if I have no list) and the day before the event, for each type that's on (GC-026).
- Go to exchange; Share the invite link (if allowed) — pinned to the bottom on mobile.
- Close (×) goes to the exchange.

#### Edge cases — Non-standard scenarios

- Wishlist skipped → "Add one before {join-by}. We'll email you the day before." (only if the join-by reminder type is on).
- Reminder types turned off → no reminder promise is shown.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "There's nothing else to do until names are drawn."

### GC-012 · Joining: Invite unavailable

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** built as the Invite unavailable state on `/i/[inviteToken]` and `/join` (S13): "This invite can't be used" with a reason line for a wrong or reset link, closed joining ("{Organiser} closed joining for '{exchange}' on {day}."), cancelled, full (100 people), approval-required (neutral line, Q2) and removed; "Go to Unwrap" goes to Home when signed in. "You can still ask to be let in" and Ask to join arrive with slice 6. The status is 200 and the page is not indexed (Q10). Reasons are read from the public preview only, so no private data is shown.

**Updated in v1.1:** joining can reopen after the draw in one case (only 2 left); a request still waiting at the draw closes and shows on the requester's Home.

**As Participant, I want to** understand why an invite link doesn't work and what I can do, **so that** I'm not left stuck.

#### Context

- A. Invite unavailable. Entry: Invite preview or Join confirmation with an invalid, expired, cancelled or closed invite.

#### In scope — Dev tasks

- Plain reason (link incorrect, expired, exchange cancelled, joining closed) with who closed it and when.
- Joining closed → Ask to join (organiser decides, see GCO-007); otherwise Go to Unwrap.
- Names already drawn → no Ask to join: "Names for {exchange} have already been drawn." The organiser is not notified.

#### Edge cases — Non-standard scenarios

- Join after join-by → request only.
- Join after the draw → not possible, not even as a request, except when the organiser reopens joining because only 2 people are left (GCO-007). Then the invite works again until the new join-by, and everyone is re-drawn after.
- Someone already in just sees their exchange.
- Request still waiting when names are drawn → it closes and can no longer be approved. The requester sees "Names were drawn before {organiser} could let you in." on Home only (GC-006); no email.
- Request already sent → show pending.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Late joins after the draw are blocked, so no late-joiner draw is needed. The one exception (reopened joining) always ends in a full re-draw.

#### Content

- "This invite can't be used"
- "You can still ask to be let in. {Organiser} decides."

## Exchange detail

### GC-013 · Exchange detail

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** before the draw, a participant's `/exchanges/[id]` shows: "Names are drawn on {date}." (or "when {first name} is ready"), "Organised by {name} · Everyone spends {budget}", "You're all set" once a list is attached, Your part (the list row to `/exchanges/[id]/list` with its source line, and "Who you're buying for" with the draw date), Dates (join by, names drawn, gifts exchanged, time zone line), People (faces and names only, never list status), and "From {first name}" for the organiser's note. A participant's page has no invite link, no organiser tools, no Leave (slice 14) and no "Add your wishlist" card (slice 10). The organiser's page gains Your part (the S49 row, only when taking part), People (header "{N} people in." once someone has joined, Q14) and Organiser tools > Invite people. Every date shows in the viewer's zone; the gift day shows as stored.

**Updated 2026-11-09 (Tobechukwu Olih):** the detail load error reads "We couldn't load this exchange. Nothing has changed.". Slice 4 builds the organiser's "just started" state only (see GCO-004); an exchange the person cannot see, a cancelled one and a missing one all show "This exchange isn't available to you" and no exchange data.

**Updated in v1.1:** adds the organiser-only part, "Hide again" on the recipient row, viewer time zones, and the new lifecycle states (reopened joining, re-draw, awaiting completion, never drawn after the event).

**Updated 2026-11-09 (Tobechukwu Olih):** the gift day is a date only. Dates blocks read "Gifts exchanged {Thu 24 Dec}" with no time. The event has passed at the end of the gift day in the organiser's time zone. For an organiser taking part, Your part › "Your list for this exchange" opens S49 (GC-010, GCO-004).

**As Participant, I want to** see where an exchange stands and what I need to do, **so that** I always know my next date and action.

#### Context

- A. Exchange detail. Content changes by role (participant / organiser taking part / organiser just organising) and status (open → joining closed → drawn → event passed → complete, plus cancelled).
- B. All dates and times show in the viewer's own time zone. The gift day is a date only (2026-11-09).

#### In scope — Dev tasks

- Status + next date; my part ("Your list for this exchange", who I'm buying for — hidden until revealed); dates timeline; people summary.
- Status-driven main action: Add your wishlist → Reveal who you got → View their wishlist.
- Organiser layer: see GCO-006.
- Organiser not taking part: same layout. Your part says "You're just organising." with no list, no recipient row and no Reveal.
- Participant before the draw: "Organised by {name}." in the header; "You're all set / Names are drawn on {date}. / We'll tell you who you're buying for. Only you will see it."; your list "Attached. You can change it until the draw."; dates with the draw time; faces without anyone's wishlist status; "From the organiser" with their note.
- Participant after the draw: "Needs you now / Names are drawn. / See who you're buying for. Only you will see it. The event is on {date}." + Reveal who you got; "Who you're buying for: Hidden until you reveal it."
- After you've revealed, the "Who you're buying for" row shows your person's name. After "Hide again" on this device (GC-014) it shows "Hidden on this device" with Show; tapping Show reveals the name again on this device.
- Your person has changed (re-draw or blind re-match): the row returns to "Hidden until you reveal it." with the note "Your person has changed." and Reveal becomes the main action again.
- Organiser after the draw: "Names drawn / Everyone has someone to buy for."; Edit details, Hand over organising… and Cancel exchange only.
- After the gift day has ended (organiser's time zone), before completion: "Gifts were exchanged on {date}."; the organiser sees Mark as complete (GCO-015); everyone else sees "This exchange closes on {date}." (7 days after the event).
- Leave exchange… (GC-017).
- States to cover: participant / organiser taking part / organiser just organising, before and after the draw; participant without a list; after you've revealed; hidden on this device; your person has changed; joining reopened (GCO-007); only 2 left (organiser); a scheduled draw that couldn't run; event passed, awaiting completion; never drawn, event passed (GCO-015); complete (GCO-015).

#### Edge cases — Non-standard scenarios

- Recipient slot before the draw → placeholder with the draw date.
- Cancelled → Not available (GC-029). Removed → "You're no longer in {exchange}" (GC-029).
- Offline → offline banner (GC-029).
- Joining reopened → participants see "Joining is open again until {date}. Names will be drawn again after that."

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (Med): the recipient name on this page is a shoulder-surfing risk; "Hide again" covers it per device.

#### Content

- "Who you're buying for. You'll find out on Sat 3 Oct."
- "You're just organising."
- "Hidden on this device"
- "Your person has changed."

## Draw, gifting and leaving

### GC-014 · Draw & gifting: Reveal

**Updated in v1.1:** "Hide again" also hides the name on the exchange page. Adds the "Your person has changed" state.

**As Participant, I want to** privately reveal who I'm buying for, **so that** the surprise stays secret.

#### Context

- A. Reveal (before → revealed). Entry: notification, Home tray or banner, exchange detail, Names drawn.
- B. The emotional peak and the biggest secrecy risk. Never a default landing — always behind a deliberate tap. The privacy check ("Make sure no one's looking") shows only until you first reveal. After that, opening Reveal goes straight to your person, unless you tapped "Hide again" on that device; then the privacy check shows until you reveal again.
- C. Once you have revealed, the exchange page's "Who you're buying for" row shows your person's name. "Hide again" hides it there too, on that device, until you tap Show or reveal again.
- D. Organising gives no access to the draw. Every participant, the organiser included, can see only their own "who I'm buying for".

#### In scope — Dev tasks

- Before: privacy check ("Make sure no one's looking"); Reveal who you got / Not now.
- After: recipient name + photo, budget (₦), gift day (date only; updated 2026-11-09, Tobechukwu Olih), top "Most wanted" items; View their wishlist (GC-015); Hide again.
- Data loaded before the tap (fetched by the browser after the page loads, never in the page's HTML); short anticipation beat.
- Home's tray (banner on desktop) shows an unrevealed draw first until you've revealed it.
- Your person has changed (full re-draw, blind re-match or blind assignment, GC-017): Reveal resets to the before state with the note "Your person has changed." and the privacy check, on every device. It never names the previous person.

#### Edge cases — Non-standard scenarios

- Shared device / screen sharing → Hide again; nothing on lock-screen notifications.
- Got-it marks for a previous person stay with that exchange's old pairing and aren't shown after the change.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (High): secrecy leaks — notifications say "names are drawn", never the name.

#### Content

- "Only you will see who you got. The organiser can't see it either."
- "Your person has changed."

### GC-015 · Draw & gifting: Recipient's wishlist

**Updated in v1.1:** the giver sees one list whatever its source; ideas no longer get a separate heading.

**As Participant, I want to** browse my recipient's wishlist, open items and privately mark one as bought, **so that** I pick something they want, within budget.

#### Context

- A. Recipient's wishlist and Item detail. Entry: Reveal, exchange detail.
- B. Only after you've revealed.

#### In scope — Dev tasks

- Recipient's wishlist: "{N} items" / "Recently changed first"; each item with name, Most wanted / Nice to have badge, owner note and ₦ price; budget + event date reminder ("You're buying for {name}. Spend … Gifts are exchanged on …"; no time since 2026-11-09, Tobechukwu Olih).
- Badges on a row: "Updated" (changed since you last opened the list), "You got this" (your own mark only), "Over budget" under the price.
- Item detail (sheet on mobile, dialog on desktop): price with "Within / Over / Under the {budget} budget."; note; Open the shop (new tab); Copy link; "I got this" → "Marked “{name}” as got. Only you can see this." with Undo; "I haven't got it after all".
- A giver may mark several items. Marks are visible to that giver only — never to the owner, the organiser or anyone else.
- Home: "Gift bought · Exchange {date}" on that exchange's row.
- The list reaches the giver the same way whether it's an attached wishlist, ideas or items kept from a deleted list (GC-010). The giver never sees which source it is or the wishlist's own name.

#### Edge cases — Non-standard scenarios

- Empty list → "They haven't added anything yet". No list → "{first name} hasn't added a wishlist yet." Ask for a hint (GC-016): not in v1.
- Item taken off the list after it was marked got it → note on the recipient's wishlist naming it; the giver can still unmark it.
- No link → name + note only ("No shop link. The name and note are all there is."); no price → no budget flag.
- Recipient has two givers after a blind assignment (GC-017) → each giver sees the list and their own marks only; neither is told.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Items reach the giver with an opaque per-giver reference, never an item id.

#### Content

- "They haven't added anything yet"
- "Only you can see this. {name} never will."

### GC-016 · Draw & gifting: Ask for a hint

**As Participant, I want to** ask my recipient for a hint without revealing myself, **so that** I have more to go on when their list is thin.

#### Context

- A. Ask for a hint (sheet). Not in v1.

#### In scope — Dev tasks

- Not in v1: pick a prompt (sizes, likes, dislikes); preview what the recipient sees; send anonymously.
- Not in v1: recipient gets a hint request in Activity / notifications (GC-026 "Hint requests" type).

#### Edge cases — Non-standard scenarios

- Rate-limited; send failed.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Your gift-giver wants a hint"

### GC-017 · Exchanges: Leave

**Updated in v1.1:** pair repairs are blind; adds the full re-draw, the only-2-left choice and the after-the-event assignment.

**As Participant, I want to** leave an exchange I joined, **so that** I can exit without spoiling it for others.

#### Context

- A. Leave exchange (participant variant), before and after the draw, until the exchange is complete.
- B. Every repair is run by the system. The organiser confirms it but never sees who is matched with whom.

#### In scope — Dev tasks

- Explain consequences; Leave exchange / Keep.
- Before the draw: the person leaves; nothing else changes.
- After the draw, before the event: the organiser sees "{name} left. One person needs someone new to buy for." and Fix the pairs…. Confirming re-matches the giver who lost their person to the person who lost their giver, blindly. Everyone else stays paired.
- Re-match impossible (the leaver and their giver had drawn each other): the organiser sees "{name} left. Names need to be drawn again." and Draw all names again… (GCO-011). Only before the event.
- Only 2 people left: the organiser chooses Invite more people (GCO-007: joining reopens with a new join-by, then a full re-draw) or Cancel exchange (GCO-013). Only before the event.
- After the event, before completion: the organiser sees "{name} left. One person needs someone new to buy for." and Give them someone…. The system picks a person at random (never the giver, never an excluded pair). The confirmation says "Someone will end up with two givers. We won't say who."
- Only the giver who has someone new is told ("Your person has changed", GC-014).
- The organiser can't leave; they hand over (GCO-014) or cancel (GCO-013).

#### Edge cases — Non-standard scenarios

- Leaving before the draw drops the group below 3 → allowed; the draw is blocked until more people join (GCO-011).
- Several people leave before the organiser confirms → one repair covers all of them; a full re-draw is offered if a blind re-match can't cover everyone.
- Complete exchange → Leave isn't offered (GCO-015).
- Someone who left can rejoin through the invite link under the normal join rules (decided 2026-11-03 by Tobechukwu Olih).

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (High): any repair that names people would reveal pairs. Repairs are confirmed without names.

#### Content

- "{name} left. One person needs someone new to buy for."
- "{name} left. Names need to be drawn again."
- "Someone will end up with two givers. We won't say who."

## Wishlists

### GC-018 · Wishlists: List

**Updated 2026-11-05 (Tobechukwu Olih, slice 2):** toasts use straight single quotes, not curly double quotes ("Deleted 'Birthday list'."); a Private row's label reads "Only you"; the date after "updated" reads "today", "yesterday", "N days ago" (up to 6), then "Wed 9 Sep" (with the year when it isn't this year), in the viewer's zone. The "Your givers in X and Y" label arrives with exchanges (slice 5). Home's "Your wishlists" section is a later slice.

**As Participant, I want to** see all my wishlists and who can see each one, **so that** I can find or start a list.

#### Context

- A. My wishlists. Entry: Wishlists tab (sidebar on desktop), Home.

#### In scope — Dev tasks

- Per list: name with a who-can-see icon (lock "Only you can see this" / globe "Anyone with the link can see this" / attached: "Your givers in X and Y can see this"), then "{N} items · updated {date}". No faces.
- New wishlist (+ icon) → GC-019.
- States:
  - First time (why a list helps your giver): "Make your first wishlist."
  - All my lists deleted: "You don't have any wishlists right now." / "Make one for your next exchange or birthday."
  - Loading; slow: "Taking longer than usual." / Try again.
  - Load error: "We couldn't load your wishlists." / "Something went wrong on our side. Nothing you've added is lost." / Try again.
  - Offline (GC-029); deleted with Undo toast.

#### Edge cases — Non-standard scenarios

- Opening someone else's list (or one that's gone) → "This wishlist is private" / "Only its owner, and their giver in an exchange, can see it." / Go to your wishlists. Never names the owner or the list.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Deleted 'Birthday — 14 March'. Undo" (toasts use straight single quotes; owner 2026-11-05)

### GC-019 · Wishlists: Create / edit list

**Updated 2026-11-05 (Tobechukwu Olih, slice 2):** the delete confirmation title uses straight single quotes ("Delete 'Birthday list'?"). A Private list's delete body is only "It isn't in any exchange, so nothing else changes."; a list visible by link adds "Anyone with the link will see that it's gone." Delete and Undo do not change the list's place in My wishlists (builder decision, accepted by Tobechukwu Olih). Default visibility from Privacy settings (GC-027) arrives in slice 3; until then new lists start Private.

**As Participant, I want to** create or edit a wishlist and choose who can see it, **so that** my list is ready for exchanges or birthdays.

#### Context

- A. New wishlist / Edit list (sheet on mobile, dialog on desktop). Entry: My wishlists, Home. (Ideas added in an exchange don't create a list; see GC-010.)

#### In scope — Dev tasks

- Name (up to 60 characters).
- Who can see it — exactly two options. New lists start Private.
  - Private: hint "Only you, and your giver in any exchange you add it to."
  - Anyone with the link.
- Wishlist date and its reminders: not in v1.
- Edit: rename, change visibility, delete list.
- Delete is a soft delete with an Undo toast ("Deleted '{name}'."); nothing cascades.
- On create → add first item (GC-021).

#### Edge cases — Non-standard scenarios

- Name missing → inline error "Give your list a name so people know what it's for."
- Deleting a list attached to an exchange → see GC-030.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Default visibility comes from GC-027.

#### Content

- "Who can see it: Private · Anyone with the link"
- "Only you, and your giver in any exchange you add it to."

### GC-020 · Wishlists: Detail

**Updated 2026-11-05 (Tobechukwu Olih, slice 2):** the Share button is hidden until slice 3. The empty-list prompt drops "Add a link and we'll fill in the name and price." until link import (slice 17). Removing an item shows a spinner on the bin, then "Removed '{name}'." with Undo; Undo puts the row back at once (builder decision, accepted by Tobechukwu Olih) and, if the server refuses, takes it away again with "Couldn't save your change, so we put it back." + Retry. If the bin's remove itself fails, or Undo of a deleted list fails, nothing is put back, so the toast reads "Couldn't save your change." + Retry (Tobechukwu Olih, 2026-11-08). After a removal, focus moves to the next row, else the previous one, else "Add an item" (builder decision, accepted by Tobechukwu Olih). The bin's accessible name is "Remove {item}".

**As Participant, I want to** view and maintain one list, **so that** my list stays current.

#### Context

- A. Wishlist detail (owner). Entry: My wishlists, Home, You're in, exchange detail.

#### In scope — Dev tasks

- Items most recently changed first ("Recently changed first"), each marked Most wanted or Nice to have; name, note, price (₦).
- Add an item; tap an item to edit it; a bin at the end of each row removes it, with a spinner while it works, then "Removed '{name}'." with Undo.
- Delete list, a text button beside Add an item, opens the delete confirmation (GC-019, GC-030).
- Back returns to the page I came from, or Wishlists.
- Share (outline button with the share icon) → GC-022; Edit list (GC-019).
- Prices are exact ₦ amounts; no approximate prices.
- Optimistic updates; on failure roll back with Retry.
- No purchase marks ever shown to the owner.

#### Edge cases — Non-standard scenarios

- Empty list → prompt with example item types.
- Owner edits after a giver viewed it → giver sees "updated".

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Couldn't save your change, so we put it back. Retry"

### GC-021 · Wishlists: Add / edit item

**Updated 2026-11-05 (Tobechukwu Olih, slice 2):** slice 2 is manual entry only: the link is stored (with https:// added when missing) and never fetched, and the Link field has no helper text until link import (slice 17); Photo arrives in slice 17. Price is optional; when given it is whole naira from ₦1 to ₦1,000,000,000 (over the limit: "That's over ₦1,000,000,000. Enter a smaller amount."). Priority is required with "Nice to have" preselected (overrides the board). A bad link shows "Check the link. It should start with https://". Toasts use straight single quotes.

**As Participant, I want to** add an item with a link, price and a note for my giver, **so that** my giver gets exactly the right thing.

#### Context

- A. Add / edit item. Entry: Wishlist detail, Attach wishlist, a newly created wishlist.

#### In scope — Dev tasks

- Fields: Link (optional), What is it?, Price (₦, whole Naira), How much do you want it? (Most wanted / Nice to have), Note for your giver, Photo (optional).
- Limits: item name 120 characters, note 280 characters, price up to ₦1bn in whole Naira. Money is stored as kobo.
- Link import: pasting a link fills the name and ₦ price, but only into fields that are still empty. Fields stay editable while it fetches. Links without https:// are accepted.
- Save closes the sheet and shows a toast "Added '{name}'." with "Add another". Editing shows "Saved '{name}'." The sheet has no remove button; items are removed with the bin on their row (GC-020), which shows "Removed '{name}'." with Undo.
- The main button says "Add to list" on a wishlist and "Add item" for ideas in an exchange (GC-010).

#### Edge cases — Non-standard scenarios

- Link unreadable → "We couldn't get details from this link. Fill them in below."; saving is never blocked.
- Only one of name or price fills from the link → say which one filled.
- Shop price in another currency → price is filled only when the shop gives NGN; otherwise it's left for the person to type.
- Price not a valid ₦ amount.
- Photo upload fails or is too large → saving the item is never blocked.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Dependency: image upload and storage for item photos.

#### Content

- "Getting the name and price… You can keep typing."
- "We filled in the name and price from the link. Check they're right."
- "We filled in the name from the link. Check it's right." / "We filled in the price from the link. Check it's right."
- "We couldn't get details from this link. Fill them in below."
- "Added '{name}'." · Add another
- "Saved '{name}'."
- "Removed '{name}'." · Undo

### GC-022 · Wishlists: Share

**Updated 2026-11-08 (Tobechukwu Olih, slice 3):** links are built from a server-only `SITE_URL` per environment (the production domain is not decided). Both the "Anyone with the link" option and "Get a shareable link" make the list shareable, and choosing Private in the sheet turns sharing off. A failed save shows "Couldn't save your change." with Retry; a failed copy selects the link; WhatsApp opens through `wa.me`. The "Link copied" toast appears when the sheet closes (a toast waits while a sheet is open).

**As Participant, I want to** share a wishlist outside an exchange, **so that** friends know what to get me for birthdays.

#### Context

- A. Share wishlist (sheet). Entry: Wishlist detail.

#### In scope — Dev tasks

- Each list has one permanent, random link. It can't be turned off or reset; making the list Private is how sharing stops.
- Visibility choice (Private / Anyone with the link) shown at the point of sharing; the choice saves straight away.
- When Private: "Get a shareable link".
- When Anyone with the link: the link; Copy link → toast "Link copied. Paste it anywhere to share."; Share to WhatsApp.
- WhatsApp message: "Here's my wishlist, "{list name}", on Unwrap. Take a look: {link}"

#### Edge cases — Non-standard scenarios

- List is Private → no link is shown; "Get a shareable link".
- Native share unsupported → copy fallback.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (Med): trust in sharing data — always say who can see it.

#### Content

- "Anyone you send the link to can too. They don't need an account."
- "Link copied. Paste it anywhere to share."
- "Here's my wishlist, "{list name}", on Unwrap. Take a look: {link}"

### GC-023 · Wishlists: Shared view

**Updated 2026-11-09 (Tobechukwu Olih, S25 boards):** the intro is one sentence ("Four things Amaka would love." / "One thing Amaka would love."); the "Recently changed first" line is removed from the public view (the order is unchanged); rows show the price and the note on their own lines, with priority as a badge ("Most wanted" on the surface/brand-subtle wash, "Nice to have" on grey; owner, 2026-11-09); the desktop column is centred, up to 640px.

**Updated 2026-11-08 (Tobechukwu Olih, slice 3):** the intro uses number words for 2 to 10 and digits above, and reads "One thing {first name} would love." for one item (second sentence dropped 2026-11-09). Rows without a shop link are not tappable. The intro and empty state use the first word of the owner's name; the full name sits beside the avatar. The page title and link preview are generic ("A wishlist on Unwrap"). Every unavailable case answers 404. No extra rate limit in v1. The skeleton board is not used: a loading boundary would turn the 404 into a 200 (builder note, open item 49).

**As Participant, I want to** open a friend's shared wishlist without an account, **so that** I can see what they want.

#### Context

- A. Shared wishlist (viewer). Public page; entry from a shared link.

#### In scope — Dev tasks

- No account needed.
- Owner photo + name, list name, intro line ("Six things Amaka would love."), then one list under the "{N} items" count — each row shows the name, the price on its own line, the owner's note on a third line, and a Most wanted / Nice to have badge on the right (Most wanted on the brand wash); tap → shop link. On desktop the page is one centred column.
- Acquisition: Make a wishlist of your own → sign up.
- Hidden from search engines.

#### Edge cases — Non-standard scenarios

- List private, deleted or link unknown → one answer for all: "This wishlist isn't available" / "Its owner may have made it private. Ask them to send you the link again." Never mention turning off the link.
- Owner hasn't added items yet → "{first name} hasn't added anything yet." / "Check back closer to the date. We'll show items here as soon as {first name} adds them."

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (Med, v2): birthday use risks duplicate gifts — leave room for a "claim item" mode. Out of scope v1.

#### Content

- "Six things Amaka would love." / "One thing Amaka would love."
- "Make a wishlist of your own"
- "This wishlist isn't available" / "Its owner may have made it private. Ask them to send you the link again."

## Account and system

### GC-024 · Account: Profile

**Updated 2026-11-04 (Tobechukwu Olih), slice 1:** a minimal Profile is built first: the name and Log out only. Log out ends this device's session only (other devices stay signed in), clears the saved verify state on this device, and lands on Landing. Photo, masked email and the links to Account, Notifications and Privacy arrive with slice 16.

**As Participant, I want to** edit how I appear to others, **so that** my name and photo stay right.

#### Context

- A. Profile. Entry: avatar in header, the photo prompt (GC-005).

#### In scope — Dev tasks

- Name, photo; masked email; links to Account, Notifications, Privacy (in that order); Log out. (Phone: not in v1, decided 2026-11-03.)

#### Edge cases — Non-standard scenarios

- Upload failed; name required.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Until then, people see your initials."

### GC-025 · Account: Settings

**Updated 2026-11-03 (Tobechukwu Olih):** email change only; adding a phone number is not in v1.

**As Participant, I want to** change my email, **so that** I can keep signing in.

#### Context

- A. Account. Entry: Profile. Sign-in is by one-time code only; no Google sign-in.

#### In scope — Dev tasks

- "Signs in with: Email code".
- Change email → code sent to the new address (Verify code). The email changes only once the code sent to the new address is entered.
- Add or change a phone number: not in v1.
- Delete my account… → GC-028.

#### Edge cases — Non-standard scenarios

- Identifier already in use; verification failed.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Used for sign-in codes only. Never shown to others."

### GC-026 · Account: Notifications

**Updated in v1.1:** adds join-by and event reminder emails, and lists the emails that are always sent.

**As Participant, I want to** choose how I'm told about each thing, **so that** I get the reminders I need, not noise.

#### Context

- A. Notifications. Entry: Profile, Activity.

#### In scope — Dev tasks

- v1: email only, four types I can turn off, all on by default:
  - Names are drawn ("Find out who you're buying for."). Covers re-draws and "Your person has changed".
  - Someone joins ("Only for exchanges you organise."). Organisers get "{name} joined {exchange}" / "{name} wants to join {exchange}" emails.
  - Join-by reminder ("If you haven't added a wishlist, we'll remind you the day before joining closes."). Sent 24 hours before join-by, only to people taking part with no list.
  - Event reminder ("We'll remind you the day before gifts are exchanged."). Sent at 9:00 am the day before the gift day, in each person's own time zone, to everyone taking part (updated 2026-11-09, Tobechukwu Olih; was 24 hours before the event time).
- Always sent, can't be turned off: exchange cancelled (GCO-013), you were removed (GCO-007), you're now the organiser (GCO-014), sign-in codes.
- Reminders also appear in Activity (GC-007).
- Not in v1: hint requests (GC-016); push permission status + Send a test (no web push); WhatsApp share reminders.

#### Edge cases — Non-standard scenarios

- Push blocked in browser: not applicable in v1 (no web push).
- Join-by or event date changed after a reminder was scheduled → the reminder moves with it; one already sent isn't resent unless the new date is later.
- Join-by within 24 hours of joining → no join-by reminder.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- No web push in v1. Reminders go by email and the Activity feed.
- Dependency: scheduled email jobs that follow date edits.

#### Content

- "Find out who you're buying for."
- "If you haven't added a wishlist, we'll remind you the day before joining closes."
- "We'll remind you the day before gifts are exchanged."

### GC-027 · Account: Privacy

**Updated 2026-11-08 (Tobechukwu Olih, slice 3):** only "Default for new wishlists" ships now, reached from a "Privacy" row on the minimal Profile; it saves on change. Saved lines: "Saved. New wishlists start as Anyone with the link." / "Saved. New wishlists start as Private."; failure: "We couldn't save your default, so it's still {the previous choice}. Try again." The data export and "Who sees what" arrive with slice 16. New wishlists start from this default (Private if it cannot be read); Edit list shows the list's own value.

**As Participant, I want to** see and control who sees my stuff, **so that** I trust the app with my lists.

#### Context

- A. Privacy. Entry: Profile, Share wishlist.

#### In scope — Dev tasks

- Default visibility for new wishlists (Private or Anyone with the link; starts as Private).
- Read-only explainer of how secrecy works (only you / organisers / your giver).
- Request a copy of my data (emailed): a JSON file of my profile, account email, wishlists and items, and the exchanges I'm in — never anyone's draw. Up to 3 requests a day.
- The default applies to new lists made in Wishlists. Ideas added in an exchange (GC-010) are always private to my giver there.

#### Edge cases — Non-standard scenarios

- Save failed.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Organisers see who has joined and who has a wishlist, but never who got whom."

### GC-028 · Account: Delete

**Updated in v1.1:** an organiser of an active exchange hands it over first; it's cancelled only if nobody can take it.

**Note 2026-11-04 (Tobechukwu Olih), from slice 1:** `profiles.id` references the sign-in account with no cascade, on purpose: deleting the account has to anonymise the profile first (`anonymised_at`), so the database refuses to delete an account that still has a profile. The delete flow in slice 16 must anonymise, then delete. See the plan, section 5.

**As Participant, I want to** delete my account and understand the consequences, **so that** I can leave cleanly.

#### Context

- A. Delete account (sheet / dialog). Entry: Account.

#### In scope — Dev tasks

- List what's deleted (profile, wishlists) and which exchanges are affected (after the draw, the organiser repairs the pairs blindly as in GC-017; everyone else stays paired).
- If I organise an active exchange → "Choose a new organiser" for each one (GCO-014): pick from people taking part. The hand-over is instant and the new organiser is told.
- If nobody else is taking part → that exchange is cancelled and everyone in it is told.
- On delete: the account is anonymised ("Former member"), wishlists hidden (soft delete), photo and login removed; the anonymised profile stays so others' exchanges and pairs hold together.

#### Edge cases — Non-standard scenarios

- Recipient deletes account after the draw → the same repairs as someone leaving (GC-017).
- Organiser of several active exchanges → one new organiser chosen per exchange before Delete is enabled.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Dependency: GCO-014 Hand over organising.

#### Content

- "Choose a new organiser for {exchange}."
- "{exchange}, which you organise, is cancelled. Everyone in it is told." (only when nobody can take it over)

### GC-029 · System: Unavailable & offline

**Updated in v1.1:** adds the removed-person variant.

**As Participant, I want to** get a clear message when something is gone or I'm offline, **so that** I can get back somewhere useful.

#### Context

- A. Not available + offline/error states across Home, Exchanges and Wishlists.

#### In scope — Dev tasks

- Cancelled / deleted / no access → plain reason + Back to Home.
- Removed from an exchange, or left it after handing over as an organiser who wasn't taking part → "You're no longer in {exchange}." + "Your wishlist is still yours to use." + Back to Home.
- Offline → persistent banner; pages already open stay readable (there is no offline cache); no changes can be made or queued while offline (no offline writes in v1). The banner never promises to save changes later. Try again refreshes only once the connection is back.
- Errors stay inline with input kept.

#### Edge cases — Non-standard scenarios

- Deep link from an old notification to a removed item.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "You're offline. Pages you've opened stay on screen. Try again"
- "You're no longer in {exchange}."

### GC-030 · Wishlists: Delete an attached list

**Updated in v1.1:** the kept items show as "Your list for this exchange" with a "kept from a list you deleted" subline.

**As Participant, I want to** delete a wishlist that is attached to one or more exchanges, **so that** I can tidy up my lists without taking away what my giver relies on.

#### Context

- A. "Delete this list…" on Edit list → destructive confirmation (sheet on mobile, dialog on desktop; main button "Delete list") → My wishlists toast "Deleted '…'. Undo".
- B. Deleting the list does not remove its items from any exchange. The items stay in each exchange on their own, no longer tied to a wishlist.

#### In scope — Dev tasks

- Confirmation names every exchange the list is in and says the items will stay there.
- On delete: the list leaves My wishlists; its items stay in each exchange exactly as they were at that moment (same name, price, link, note, priority), frozen — nobody can change them.
- Nothing changes for anyone else: the organiser's readiness count stays the same (GCO-006); my giver still sees the items (GC-015) and their "got it" marks stay; no one is notified.
- In exchange detail, Your part shows "Your list for this exchange" with the subline "Kept from a list you deleted. It can't be changed now."
- Undo restores the list and links it back to every exchange. After undo the items follow the list again.
- Attaching a new list before the draw replaces the kept items.

#### Edge cases — Non-standard scenarios

- List in several exchanges at different stages → items stay in all of them.
- List was empty when deleted → nothing stays, so I count as "no wishlist" in that exchange again; Undo doesn't re-attach it.
- Deleted while my giver has the list open → their view doesn't change.
- Complete / past exchanges → items stay as a read-only record.
- Deleting my account (GC-028) → I leave my exchanges, so my items leave with me. This rule doesn't apply.
- Offline → delete can't be done until I'm back online (no offline writes in v1).

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Privacy: items I deleted stay visible to my giver in the exchange (after the draw). The confirmation must say so plainly; it also qualifies the Privacy and Account copy about deleting wishlists.
- Any future purge of deleted lists must skip attached ones.

#### Content

- "Delete 'My Christmas wishlist'?"
- "Its 6 items stay in Office Secret Santa and Family Christmas 2026, so your givers can still see them."
- Exchange detail: "Your list for this exchange. Kept from a list you deleted. It can't be changed now. 6 items. Your giver will see them after the draw." After the draw: "6 items. Only your giver can see them."

## Organiser stories

Organiser is a participant with all participant abilities, unless they chose "No, just organising" (GCO-003). The ones below are additions.

| ID | Epic / Feature | As Organiser, I want to… | v1.1 |
| --- | --- | --- | --- |
| GCO-001 | Start exchange: Basics | Name a new exchange and add a note for everyone |  |
| GCO-002 | Start exchange: Budget & dates | Set the budget range and the timeline | Updated |
| GCO-003 | Start exchange: Rules & review | Decide whether I take part and who can join, then check everything |  |
| GCO-004 | Start exchange: Created | Get the invite link out straight away | Updated |
| GCO-005 | Invite people | Invite people by WhatsApp, link, email or phone |  |
| GCO-006 | Track readiness | See who has joined and who still needs a wishlist | Updated |
| GCO-007 | Manage participants | Approve or decline join requests and remove people | Updated |
| GCO-008 | Nudge people | Remind people who haven't added a wishlist |  |
| GCO-009 | Exclusions | Stop specific pairs drawing each other |  |
| GCO-010 | Edit exchange | Change details or dates after creating | Updated |
| GCO-011 | Draw names | Draw names once, knowing who isn't ready | Updated |
| GCO-012 | Draw complete | Confirm the draw worked without seeing any pair | Updated |
| GCO-013 | Cancel exchange | Cancel an exchange and tell everyone | Updated |
| GCO-014 | Hand over organising | Make someone else the organiser | Updated |
| GCO-015 | Complete exchange | See an exchange wrap up after the event day | Updated |

## Start an exchange

### GCO-001 · Start exchange: Basics

**Updated 2026-11-09 (Tobechukwu Olih):** the note is at most 280 characters; Close with anything entered opens "Discard this exchange?" ("Keep going" / "Discard"); nothing is saved until Start exchange.

**As Organiser, I want to** name a new exchange and add a note for everyone, **so that** I can start quickly.

#### Context

- A. Start exchange, step 1 of 3. Entry: Exchanges list, Home, Home new-user state.

#### In scope — Dev tasks

- Name (up to 40 characters, shown in the invite); optional note.
- Next → GCO-002; leaving with data entered asks to confirm.

#### Edge cases — Non-standard scenarios

- Name missing / too long.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "This is what people see in the invite."

### GCO-002 · Start exchange: Budget & dates

**Updated 2026-11-09 (Tobechukwu Olih):** budget labels use "to" everywhere ("₦10,000 to ₦20,000"; the top preset is "Above ₦50,000"). Dates: the join-by moment must be before the gift moment and both in the future, with no minimum or maximum gap; "When joining closes" draws at the join-by time, and "When I choose" closes joining at the end of the join-by day, which must be before the gift day. Errors: "Join by has to be in the future.", "Join by has to be before the gift day.", "The gift day has to be in the future.". The summary ends with "Times are in your time zone ({zone})." using the organiser's browser zone.

**Updated 2026-11-09 (Tobechukwu Olih), later the same day:** the gift time is removed. The gift day is one date field ("Gift day", for example "Sat 12 Dec 2026"; boards Org-Budget-default / -filled / -error). It is set in the organiser's time zone and has passed at the end of that day there. The join-by day must be before the gift day, in both draw modes. Everyone sees the same gift day date. The Draw time (6:00 pm, "Joining closes at this time on the join-by day.") is unchanged.

**Updated in v1.1:** adds an event time (replaced 2026-11-09: date only). Everyone sees dates and times in their own time zone.

**Updated 2026-11-03 (Tobechukwu Olih):** the four budget presets are fixed (see In scope).

**As Organiser, I want to** set the budget range and the timeline, **so that** everyone knows how much to spend and by when.

#### Context

- A. Start exchange, step 2 of 3.
- B. The organiser sets dates and times in their own time zone. Each moment (join-by, draw time) is fixed once set, and every viewer sees it converted to their own time zone. The gift day is a date in the organiser's time zone; it ends at the end of that day there.

#### In scope — Dev tasks

- Budget per gift: one of four preset ranges — ₦5,000 to ₦10,000; ₦10,000 to ₦20,000; ₦20,000 to ₦50,000; Above ₦50,000 (decided 2026-11-03 by Tobechukwu Olih; overrides the ranges in the designs).
- Join by; gift day (a date, required; no time).
- When are names drawn: when joining closes (default, automatic) or when I choose.
- Draw time (when names are drawn automatically): defaults to 6:00 pm in the organiser's time zone. Joining closes at that time on the join-by day; when the organiser chooses, joining closes at the end of the join-by day.
- Plain-language timeline summary, in the organiser's time zone.

#### Edge cases — Non-standard scenarios

- Dates out of order; gift day in the past; join-by on or after the gift day.
- Participants in other time zones → they see every date and time converted to their own zone, so a date can fall on a different day for them. Countdowns use the same fixed moments.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (High): too many dates — draw defaults to join-by to keep one fewer date.
- Dependency: each viewer's time zone, taken from their browser.

#### Content

- "People can join until Fri 27 Nov. We draw names that evening at 6:00 pm. Gifts are exchanged on Sat 19 Dec. Times are in your time zone (WAT)." (board Org-Budget-filled, 2026-11-09; "Here's how it runs:" removed by the owner 2026-11-12)

### GCO-003 · Start exchange: Rules & review

**Updated 2026-11-09 (Tobechukwu Olih):** "Are you taking part?" starts on "Yes, I'm in" and "Who can join?" on "Anyone with the link". In the Review, "Names drawn" reads "When you're ready" when the organiser draws. If starting fails, "We couldn't start the exchange. Everything you entered is still here, so you can try again." shows and every input is kept; Start exchange is disabled offline.

**As Organiser, I want to** decide whether I take part and who can join, then check everything, **so that** nothing goes out wrong.

#### Context

- A. Start exchange, step 3 of 3.

#### In scope — Dev tasks

- Are you taking part? (Yes / No, just organising).
- I approve each person before they join (off = anyone with the link joins).
- Review summary with Edit per section; Start exchange → GCO-004.

#### Edge cases — Non-standard scenarios

- Create failed → retry with inputs kept.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Exclusions are set after people join (GCO-009).

#### Content

- "Nothing is sent until you tap Start exchange."

### GCO-004 · Start exchange: Created

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** the organiser's exchange page shows Your part with "Your list for this exchange" (to `/exchanges/[id]/my-list`, S49) only when the organiser takes part; the sublines follow the boards ("From '{wishlist}'. {N} items. You can change it until the draw.", "Only for this exchange. {N} items. You can change them until the draw.", "Nothing yet. Add one so your giver has ideas."). S49 has no Skip, Back leaves without a list, and "Choose a different wishlist" is offered once a wishlist is attached. Just organising shows no list row and `/my-list` is "isn't available". People shows faces and names, or "Only you so far. People show here as they join." when alone. Organiser tools shows only Invite people; Edit details, Draw names now, Exclusions, Hand over and Cancel come with their slices.

**Updated 2026-11-09 (Tobechukwu Olih):** the header follows the board: the title, "Only you so far.", then "Created by you on {Mon 2 Nov} · Everyone spends {budget}" (budget labels as in GCO-002). The page has no separate Dates section and no note; "What happens next" ends with "Times are in your time zone ({zone})." in the viewer's zone. The invite link is `{site}/i/<token>`, readable by the organiser only. Controls whose feature is not built yet are hidden: Invite by email (slice 7), Add your wishlist (slice 5), Organiser tools (slices 5, 10, 13, 15). "Share invite link" on Exchanges goes to the invite section of the exchange page.

**Updated 2026-11-09 (Tobechukwu Olih), later the same day:** the gift day is a date only. "What happens next" step 3 reads "{Sat 12 Dec}." with no time. "Add your wishlist" for an organiser taking part becomes Your part › "Your list for this exchange", which opens S49, its own page. S49 is built with the attach work in slice 5; boards Org-List-* and Exchange-Detail-oattached / -oideas. S49 copy:
- Entry row: "Your list for this exchange" / "Nothing yet. Add one so your giver has ideas."
- Page: H1 "Your list for this exchange", sub "{Family Christmas 2026}". In-app page with Back and the tab bar; Back leaves without a list (no Skip).
- "Pick one of your wishlists, or add a few ideas just for this exchange. Everyone spends ₦10,000 to ₦20,000, so ideas in that range help most."
- "Only your giver will see it, and only after names are drawn."
- Buttons "Choose a wishlist" (primary) and "Add items instead". No wishlists: "You don't have any wishlists yet, so add a few items instead." and Choose is unavailable.
- Item sheet helper: "Your budget here is ₦10,000 to ₦20,000." Ideas: "Your list for this exchange (2)" / "Only for this exchange", Done / Add another item, toast "Added "Ankara tote bag"." with Undo.
- Attach failed: "We couldn't attach "My Christmas wishlist". Nothing has changed, so you can try again."
- Current: "Your giver will see it after the draw. You can change it until then." with "Choose a different wishlist". Choosing another wishlist before the draw replaces the current one.
- Back on the exchange page: toasts "Wishlist attached. Your giver will see it after the draw." / "Your list is ready. Your giver will see it after the draw."; sublines "From "My Christmas wishlist". 6 items. You can change it until the draw." / "Only for this exchange. 2 items. You can change them until the draw."
- A whole wishlist or ideas only; single items from a wishlist are not picked. The organiser sees only their own list, never reservations or pairs.

**Updated in v1.1:** the timeline shows the event time (replaced 2026-11-09: date only).

**As Organiser, I want to** get the invite link out straight away, **so that** my group can start joining.

#### Context

- A. Exchange detail, "just started" state. Start exchange lands on the exchange page itself; while the organiser is the only one in, it leads with the invite link — the job isn't done yet. No separate confirmation screen.
- B. Exchanges shows the same state as an "Only you so far" block with Share invite link and Add your wishlist.

#### In scope — Dev tasks

- Header: "Created by you on {day}. Only you so far. Everyone spends {budget}."
- Invite link; what happens next (people join → names drawn at {draw time} → gift day {date}); Dates with the draw time and the gift day (date only); People "Only you so far"; Organiser tools.
- Share to WhatsApp (main); Copy link; Invite by email (GCO-005; SMS invites not in v1); Add your wishlist (GC-010), not shown when just organising.

#### Edge cases — Non-standard scenarios

- Native share unsupported → copy fallback.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Created by you on Mon 12 Oct. Only you so far. Everyone spends ₦10,000 – ₦20,000."
- Exchanges list: "Only you so far. Share the invite link so people can join by Fri 27 Nov. Names are drawn at 6:00 pm that day."

## Run an exchange

### GCO-005 · Invite people

**Updated 2026-11-13 (decided by Tobechukwu Olih, slice 5 owner decisions Q1 to Q14):** Invite people is built as a sheet from Organiser tools: "People can join until {date}.", the link, Share to WhatsApp, Copy link, Done and Reset link…. Reset link asks "Reset the invite link?" ("The old link stops working straight away. Anyone who hasn't joined yet needs the new one. People already in aren't affected.", Reset link / Keep link); on success the toast reads "Link reset. The old link no longer works." and the new link replaces the old one on screen. Only the organiser can reset it (Q6), and a cancelled or complete exchange refuses. Invite by email, the approval line and "waiting for you to let them in" are not built (slices 6 and 7).

**Updated 2026-11-03 (Tobechukwu Olih):** QR code dropped from v1.

**As Organiser, I want to** invite people by WhatsApp, link, email or phone, **so that** everyone in my group gets in.

#### Context

- A. Invite people (sheet on mobile, dialog on desktop). Entry: Exchange detail, Participants.

#### In scope — Dev tasks

- Join-by reminder; invite link; Share to WhatsApp; Copy link; email + Send (SMS/phone invites: not in v1).
- Waiting-to-join list; reset link if leaked. QR code: not in v1 (decided 2026-11-03 by Tobechukwu Olih).
- Toasts: invite sent / link copied / link reset.

#### Edge cases — Non-standard scenarios

- Invalid email/phone; already a member; invite limit reached (100 people in an exchange, decided 2026-11-03 by Tobechukwu Olih).
- Link forwarded to a stranger → reset link or approval.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "People can join until Fri 2 Oct."

### GCO-006 · Track readiness

**Updated in v1.1:** covers the organiser who isn't taking part; Hand over organising joins the tools; the event step shows its time.

**As Organiser, I want to** see who has joined and who still needs a wishlist, **so that** I don't have to chase people in the group chat.

#### Context

- A. Organiser blocks on Home, Exchanges and Exchange detail.
- B. An organiser who isn't taking part is never counted in readiness and has no Your part beyond "You're just organising."

#### In scope — Dev tasks

- "5 of 8 wishlists are in" with dashed avatars for missing people, named in the sentence.
- Organiser tools section in exchange detail: Invite people, Exclusions (with a count of pairs, hidden when there are none), Edit details, Draw names now…, Hand over organising…, Cancel exchange…. While a scheduled draw is blocked ("Names couldn't be drawn"), Draw names now… is hidden until it's fixed.
- Join requests on the exchange page: "Needs you now" — "{Name} wants to join." / Review request; several: "{N} people want to join." / Review {N} requests. Keep the block compact.
- Pair repairs after someone leaves or is removed (GC-017) show here as "Needs you now" blocks: Fix the pairs…, Draw all names again…, Invite more people / Cancel exchange (only 2 left), or Give them someone… (after the event).
- Alert when everyone is ready → Run draw.

#### Edge cases — Non-standard scenarios

- Only the organiser so far → invite prompt + minimum-3 reminder.
- Event step shows the gift day (date only since 2026-11-09); people taking part get an event reminder email the day before (GC-026).

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Organisers are participants too — tools live inside the exchange, not a separate area.

#### Content

- "Emeka, Tolu and Ada haven't added theirs."

### GCO-007 · Manage participants

**Updated in v1.1:** removed people are emailed; removal after the draw uses the blind repairs; adds reopening joining when only 2 are left.

**As Organiser, I want to** approve or decline join requests and remove people, **so that** the right people are in.

#### Context

- A. Participants. Entry: Exchange detail "See all".

#### In scope — Dev tasks

- Sections: Wants to join (Approve / Decline), Still need a wishlist (Nudge…), Ready.
- Remove person… (confirms first); Invite more people.
- A removed person gets an email: "You're no longer in {exchange}. Your wishlist is still yours to use." It gives no reason and doesn't name the organiser.
- Never shows who drew whom.
- Only 2 left after the draw (GC-017) → Invite more people… asks for a new join-by (before the event). Joining reopens: the invite link works again, joins follow the approval setting, and everyone taking part is told "Joining is open again until {date}. Names will be drawn again after that." At the new join-by, all names are drawn again (GCO-011).

#### Edge cases — Non-standard scenarios

- Remove blocked mid-draw.
- Removing someone after the draw → the same blind repairs as someone leaving (GC-017).
- Join request still waiting when names are drawn → it closes, can't be approved, and no longer shows here (GC-012).
- Same person invited twice.
- A removed person uses the invite link again → it arrives in Wants to join for the organiser to approve or decline, even when approval is off (decided 2026-11-03 by Tobechukwu Olih).
- Reopened joining ends with fewer than 3 → the re-draw can't run; the organiser sees "Names couldn't be drawn" (GCO-011).

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Nobody can see who drew whom, not even you."
- "You're no longer in {exchange}. Your wishlist is still yours to use."

### GCO-008 · Nudge people

**As Organiser, I want to** remind people who haven't added a wishlist, **so that** everyone is ready before the draw.

#### Context

- A. Nudge (confirmation sheet on mobile, dialog on desktop). Entry: Home, Exchanges, Exchange detail and Participants (one person or all).

#### In scope — Dev tasks

- "Nudge 3 people…" opens a confirmation with a message preview → send → undo toast.
- Button busy and disabled against repeats.
- Delivery is by email only: the confirmation says "They'll get this by email:". No WhatsApp sending in v1.
- Nudges everyone taking part who hasn't added a wishlist, except the organiser; anyone nudged in the last 12 hours is skipped. Emails wait 20 seconds so Undo can stop them.
- The organiser never sees anyone's email address; the email goes out from the database.

#### Edge cases — Non-standard scenarios

- Nudge rate-limited: 20 sends an hour per organiser.
- Everyone was nudged in the last 12 hours → "Everyone here was nudged in the last 12 hours. Give them a little time."

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Rule: anything that notifies other people ends in "…" and confirms first.

#### Content

- "Nudge sent to Emeka, Tolu and Ada. Undo"
- Message: "Amaka is waiting on your wishlist for Family Christmas 2026. Names are drawn Sat 3 Oct."

### GCO-009 · Exclusions

**As Organiser, I want to** stop specific pairs drawing each other, **so that** the draw suits our group (couples, siblings).

#### Context

- A. Exclusions. In v1. Entry: organiser tools; Draw names when a draw is blocked.

#### In scope — Dev tasks

- Pairs list (works both ways); Add a pair; Remove; Save pairs.
- Live check that a fair draw is still possible.
- Add a pair: a sheet with two lists — first person, then second. Pairs only between people taking part.

#### Edge cases — Non-standard scenarios

- Rules make a draw impossible → say which pair to relax ("…Remove Nneka and Obinna, or invite more people.").
- Saving pairs that block a fair draw is allowed, with that warning — more people may join; the draw checks again.
- Fewer than 3 people → "Names need at least 3 people to draw."
- Exclusions are organiser-only; participants never see them. Pairs can't change after the draw.
- Pair repairs and re-draws after the draw (GC-017, GCO-011) respect the saved pairs.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "A fair draw is still possible with these pairs."

### GCO-010 · Edit exchange

**Updated in v1.1:** the event time is editable, including after the draw; join-by is editable again while joining is reopened.

**Updated 2026-11-09 (Tobechukwu Olih):** the gift day is a date only. There's no gift time to edit (boards Org-Edit-default / -afterdraw). After the draw, the budget and the gift day can change.

**As Organiser, I want to** change details or dates after creating, **so that** I can fix a date without confusing everyone.

#### Context

- A. Edit exchange. Entry: organiser tools.

#### In scope — Dev tasks

- Same fields as the Basics and Budget & dates steps, including the gift day (date only), the draw choice and the draw time (all editable before the draw).
- After the draw only budget and gift day can change.
- While joining is reopened (GCO-007), the join-by date can change too.
- "Tell everyone what changed" — an email to every other member listing what changed (ticked by default). Reminder emails move with the new dates (GC-026).

#### Edge cases — Non-standard scenarios

- Dates out of order; locked field after the draw.
- Event moved earlier than now → not allowed.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "After names are drawn, only the budget and gift day can change." (wording to confirm against board Org-Edit-afterdraw, which reads "gift day can change")

## Draw, cancel, hand over, complete

### GCO-011 · Draw names

**Updated in v1.1:** adds the full re-draw and the blind assignment after the event.

**As Organiser, I want to** draw names once, knowing who isn't ready, **so that** everyone gets a person and the draw is fair.

#### Context

- A. Draw names (sheet / dialog). Entry: "Draw names now…", Home "everyone's ready". Scheduled draw runs automatically on the set date.
- B. Two follow-up actions use the same engine: Draw all names again… (full re-draw) and Give them someone… (blind assignment after the event). Both confirm first and never show a pair.

#### In scope — Dev tasks

- Show people count, wishlists in, exclusions (Edit); "This can't be undone"; "You won't see who got whom".
- Draw names (celebration button) → short deliberate progress moment → GCO-012.
- Draw is idempotent — safe to retry.
- Full re-draw, used when a blind re-match is impossible (GC-017) or when reopened joining closes (GCO-007): "Draw all names again for {exchange}? Everyone gets a new draw. Some people may get the same person." Only before the event. Got-it marks from the old draw are cleared for anyone whose person changes.
- Blind assignment, used after the event (GC-017): the system picks a person at random, never the giver and never an excluded pair. The confirmation says "Someone will end up with two givers. We won't say who."

#### Edge cases — Non-standard scenarios

- Under 3 people → blocked.
- Exclusions impossible → GCO-009.
- Interrupted / double tap → retry without double draw.
- Scheduled draw fires with people who have no wishlist → it still draws (Draw names warns their givers will have less to go on).
- Scheduled draw can't run (fewer than 3, or exclusions) → it tries once; the organiser is emailed and sees "Names couldn't be drawn" with Change join-by date / Edit exclusions. Changing the join-by date or draw time lets it try again.
- Two people may draw each other. Minimum 3 people.
- Nobody — organisers included — can read the pairs; each giver will see only their own person (GC-014).

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (High): no admin view of pairs exists anywhere, including repairs and re-draws.

#### Content

- "Draw names for Family Christmas 2026?"
- "Draw all names again for {exchange}?"

### GCO-012 · Draw complete

**Updated in v1.1:** adds the re-draw email and the changed-person note.

**As Organiser, I want to** confirm the draw worked without seeing any pair, **so that** I know everyone has been told.

#### Context

- A. Names drawn. Entry: Draw names success; scheduled draw notification; full re-draw success.

#### In scope — Dev tasks

- Everyone told (count); next date; Reveal who you got (if taking part) → GC-014; Back to exchange.
- Everyone in the exchange gets an email that names nobody: "Names are drawn for {exchange}. Open Unwrap to see who you're buying for. Only you will see it."
- After a full re-draw, the same email goes to everyone. People whose person changed get an added line: "Your person has changed." It never names the old or new person.
- After a blind re-match or assignment, only the giver affected is emailed: "Your person for {exchange} has changed. Open Unwrap to see who you're buying for now."

#### Edge cases — Non-standard scenarios

*None noted.*

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Nobody can see who got whom, not even you."

### GCO-013 · Cancel exchange

**Updated in v1.1:** offers Hand over organising instead.

**As Organiser, I want to** cancel an exchange and tell everyone, **so that** it ends cleanly.

#### Context

- A. Cancel exchange (sheet / dialog). Entry: "Cancel exchange…", the only-2-left block (GC-017), the never-drawn block (GCO-015).

#### In scope — Dev tasks

- Explain: everyone is told, wishlists stay with owners, can't be undone. No preview of the message in the confirmation.
- Cancel exchange / Keep exchange / Hand over organising instead (GCO-014), shown when at least one other person is taking part.
- Everyone else in the exchange is emailed the cancellation message (below); unsent nudges and scheduled reminders are stopped.
- Cancelling is possible after the draw too; the pairs stay unreadable.

#### Edge cases — Non-standard scenarios

- Participants opening it later → Not available, "was cancelled".

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Amaka has cancelled Family Christmas 2026. Your wishlist is still yours to use."

### GCO-014 · Hand over organising

**Updated in v1.1:** in v1. Instant, can't be declined, can be passed on.

**As Organiser, I want to** make someone else the organiser, **so that** the exchange continues if I step away or delete my account.

#### Context

- A. Hand over organising (sheet / dialog). Entry: organiser tools "Hand over organising…", Cancel exchange "Hand over organising instead", Delete account "Choose a new organiser".
- B. Available until the exchange is complete. Hand-over gives no access to the draw.

#### In scope — Dev tasks

- Pick from people taking part (not pending requests, not people who left).
- Confirm: "Make {name} the organiser of {exchange}?" The hand-over is instant and can't be declined.
- The new organiser gets organiser tools and an email + Activity item: "You're now the organiser of {exchange}." Everyone else sees "{name} is now the organiser" in Activity. If the new organiser doesn't want the role, they hand it over to someone else the same way.
- The previous organiser, if taking part, stays as a participant. If they weren't taking part, they leave the exchange; the confirmation says "You'll leave {exchange}. {name} will be the organiser."
- Approval setting, exclusions and dates carry over unchanged.

#### Edge cases — Non-standard scenarios

- Nobody else is taking part → Hand over isn't offered; cancel is the only way out.
- New organiser leaves later → they must hand over first (GC-017).
- New organiser deletes their account → GC-028 applies to them.

#### RAIDS — Risks, Assumptions, Issues, Dependencies

- Risk (Low): someone made organiser against their wishes; mitigated by passing it on.

#### Content

- "You're now the organiser of {exchange}."
- "You'll leave {exchange}. {name} will be the organiser."

### GCO-015 · Complete exchange

**Updated in v1.1:** the organiser marks it complete, with an automatic close 7 days after the event; a never-drawn exchange needs a new event date before it can draw.

**As Organiser, I want to** see an exchange wrap up after the event day, **so that** past exchanges are tidy and I can start another.

#### Context

- A. Exchange detail, complete state. Shown as "Complete" in Exchanges.
- B. Only drawn exchanges complete.

#### In scope — Dev tasks

- After the gift day has ended (end of that day in the organiser's time zone; updated 2026-11-09, Tobechukwu Olih), the organiser sees Mark as complete… (confirms first). If not marked, the exchange completes automatically 7 days after the gift day ends.
- Between the event and completion, the exchange stays Active: leaving, pair repairs (GC-017), hand-over and got-it marks still work.
- On completion it moves to Past and is read-only: nothing can be edited, cancelled, left or fixed, and got-it marks can't change.
- Everyone in it gets Activity "{exchange} is complete."
- Exchange page: "Finished / Gifts were exchanged on {event}. / There's nothing left to do here. Your wishlist is still yours to use.", Your part ("Your list for this exchange", "You bought for {name}" — your own person only), Dates, People. No tools.
- Start another; keep wishlist.

#### Edge cases — Non-standard scenarios

- Event date changed after completion → not possible; a complete exchange is read-only.
- Never drawn, event passed → stays in Active with a block for the organiser: "The event date has passed and names were never drawn." with Set a new event date (then the draw can run) / Cancel exchange…. Participants see "Waiting for {organiser} to set new dates."

#### RAIDS — Risks, Assumptions, Issues, Dependencies

*None noted.*

#### Content

- "Mark {exchange} as complete?"
- "The event date has passed and names were never drawn."
