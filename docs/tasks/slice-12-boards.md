# Slice 12 boards: written spec from the live canvases

## Refresh 2026-11-24

Re-read the same day, read-only, through the Artifact tool (`read`, `read_file`, `list`; no WebFetch).

**Headline: the canvas content has not changed since the read below.** The live versions are identical to the ones recorded in the original notes: "Unwrap" is still version `1795545700-3608` and "Unwrap • Part 2" is still `1795545068-f7cd`. I re-opened `Exchange-Detail-ofailed-d`, `Exchange-Wishlist-default-m`, `-removed-m`, `-item-m` and `Exchange-Detail-revealed-m` (canvas 1), `Exchange-Detail-before-m`, `-nolist-m` and `Org-Excl-impossible-m` (canvas 2). Every string matched the notes. If the owner edited the boards after this version was published, the edit is not on the published artifact yet (publish or save it, then ask for another refresh).

### What "three pages" turned out to be (how I found it)

`list` (scope all) shows three Unwrap artifacts, not three pages:

| Artifact | URL | Version | Pages (from `canvas.json`) | Boards |
| --- | --- | --- | --- | --- |
| "Unwrap" (canvas 1) | https://claude.ai/artifact/VAgJERFNKxRU1Y96njz8Ue | 1795545700-3608 | 7: 00 Research (49), 01 Home (16), 02 Exchanges (184), 03 Wishlists (80), 04 Activity (14), 05 Entry, profile, notification (60), 06 Email templates (27) | 430 |
| "Unwrap · Part 2" (canvas 2) | https://claude.ai/artifact/9pHtZC2Z3ctDbsbghVkCKG | 1795545068-f7cd | 4: "02. Exchanges · organiser" (320), "02. Exchanges · participant" (65), "05. Entry, profile, notification" (110), "00. Research · components" (15), plus 1 unpaged (`UwSlider`) | 511 |
| "Unwrap — Part 3" (**new to these notes**) | https://claude.ai/artifact/YaQwgPuKnzVDz27fxzFNsj | 1795347488-5fd0 (updated 2026-11-22) | none | 5 |

- **Part 3** is not in CLAUDE.md "Source of truth". It holds 5 overflow boards copied from Part 2: `Org-Review-nobudget-d/-m` (S28 no budget), `Exchange-Detail-obefore-nobudget-m`, `Exchange-Detail-before-nobudget-m`, `Org-List-itemoverbudget-m`. Nothing about slice 12 (no blocked, reminder, Activity or complete boards). CLAUDE.md should list it.
- The owner's "three pages" is most likely this Part 3 artifact, or the canvas 2 split into "organiser" and "participant" pages. I cannot tell which. Canvas 2's page names are "02. Exchanges · organiser" and "02. Exchanges · participant": the participant page holds only pre-draw, My-List (S49) and organiser-draws boards, no blocked or pending-draw view.
- The earlier notes called canvas 2 boards by file name only, so the page split changes nothing there. Slice 12 boards by page: `Exchange-Detail-ofailed` is on canvas 1 "02. Exchanges"; the under-3 boards, `oclosed`, `Org-Draw-*`, `Org-Complete-*`, `Org-Excl-*` and `Acc-Notif-*` are on canvas 2 (organiser or account page).

### Changes versus the old notes, board by board

| Board | Change |
| --- | --- |
| `Exchange-Detail-ofailed-m` (canvas 1) | None. |
| `Exchange-Detail-ofailed-d` | Newly read. Same content as the mobile twin, no difference except layout: sidebar, 760px column inside a 1040px wrapper, h1 36px, back button "Back to Exchanges", card is `layout="desktop"` full width of the 760px column (not in a grid row: there is only one block). Old note "assumed same content" is now **verified**. |
| `Org-Draw-*`, `Exchange-Detail-ofew*`, `-oclosed`, `Acc-Notif-*`, `Joining-In-*`, `Exchanges-past*`, `-passed`, `-complete`, `-ocomplete`, `Org-Complete-*`, `Email-E15/E23/E24` | Not re-opened individually; version unchanged, so assumed unchanged. |
| Participant view while blocked or pending | Still no board. New evidence: a canvas 2 note ("Organiser: fewer than 3 people") says "Participants see this moment on their own Exchange detail; that view lives in Part 1 and isn't designed here." So the designer states it is not designed. |
| Blocked board for the impossible-exclusions cause | Still no `Exchange-Detail-o*` board. **New related board found:** `Org-Excl-impossible-m/-d` (canvas 2, "S33 Exclusions · Draw impossible"); see below. |
| Activity rows for reminders, complete | Still none. Canvas 1 notes "S09 Activity" only; `Activity-*` boards unchanged (6 rows, none for these). |
| E24 Reveal variant, auto-complete | Still none. |
| New frames / removed frames / layout changes / changed strings | None found. |

### Newly findable (marked "not found" before)

1. **Exclusions page when the draw is impossible** (`Org-Excl-impossible-m`, S33; the `-d` twin exists). Page `/exchanges/[id]/exclusions`: h1 **"Exclusions"**, intro **"Stop two people drawing each other, like couples or siblings. It works both ways, and only you can see these pairs."**, six pair rows (title "Nneka Obi and Obinna Obi", sub **"Neither will draw the other."**, trailing bin icon), an `UwAlert kind="error"` **"With these pairs, names can't be drawn fairly. Remove Nneka Obi and Kemi Bello, or invite more people. You can still save, and the draw checks again later."** with action **"Remove that pair"**, secondary **"Add a pair"** (plus icon), pinned primary **"Save pairs"**. Back goes to `Exchange-Detail-obefore`. This is the page B2's "Edit exclusions" link opens. It is a slice 9 board (probably built); note it says "the draw checks again later", while the blocked card on slice 12 does not retry until slice 13.
2. **Canvas 2 note on the under-3 design** (page organiser, "Assumptions for the under-3 states"): "Draw names now… stays tappable and explains why it can't run instead of being greyed out. The day before join-by, a second block offers Change join-by date, which leads into Edit details. **If it's still under 3 at the draw time, the existing 'Names couldn't be drawn' state takes over.** Exclusions is hidden because there are no pairs yet." This supports owner decision B1 (keep Draw names now… visible) and says the blocked state is the `ofailed` board.
3. **Canvas 2 note on `Exchange-Detail-oclosed`**: "Invite people is hidden from Organiser tools because the link no longer works. Edit exchange opens Edit details, where the join-by date can be moved later." The `ofailed` board still shows an Invite people row with "People can join until Fri 4 Dec." (gap 6 below stands).
4. **Organiser-draws participant boards** (`Joining-In-odraws*`, `Exchanges-odraws`, `Exchanges-joinedodraws`, `Entry-Invite-odraws*`; canvas 2 participant and account pages): note "the participant exchange page for this case isn't designed yet" (the page for organiser-chooses participants). Already summarised under Joining-In.

---

## Original read (2026-11-24, unchanged except where the Refresh above says so)

Read 2026-11-24, read-only, through the Artifact tool (`list_files`, `read_file`; no WebFetch). Sources:

- "Unwrap" (https://claude.ai/artifact/VAgJERFNKxRU1Y96njz8Ue, version 1795545700-3608), called **canvas 1** below.
- "Unwrap • Part 2" (https://claude.ai/artifact/9pHtZC2Z3ctDbsbghVkCKG, version 1795545068-f7cd), called **canvas 2**.

All text below is read from the board source (`project/*.dc.html`) and is **verified** unless marked "assumed". Quoted strings are exact. The boards use raw hex values and the canvas `Uw*` components; build with tokens and the repo components. Every board has an `-m` (390x844) and `-d` (1440) twin. Desktop twins differ in layout only (see "Common layout"). I did not render anything.

## Common layout (all S14 and Account boards)

- **Mobile:** `UwNav kind="back"` (8px top padding), then `main` with 20px side padding and a 32px gap, then the bottom tab bar (Exchanges active, badge 2).
- **Desktop:** left sidebar (240 to 280px) and `main` with 40px padding. A `max-width: 1040px` wrapper holds a `max-width: 760px` column (Account pages: 600px) with a back button (`UwButton variant="back"`), the header, and the sections. h1 is 36px on desktop, 30px on mobile. Organiser blocks (`UwCard kind="block"`) go in a `grid auto-fit minmax(320px, 1fr)` row with `layout="desktop"`.
- S14 section order, organiser: header, organiser block(s), People or Your part, Dates, "Your note to everyone", Organiser tools.

## Board index (what exists)

| Needed | Board file(s) | Canvas | Found? |
| --- | --- | --- | --- |
| Blocked scheduled draw, organiser | `Exchange-Detail-ofailed-m/-d` (title "Names couldn't be drawn.") | canvas 1 only | Yes. One cause only: under 3 people. |
| Blocked draw, exclusions cause | none | | **No board.** Only a pre-draw sheet `Org-Draw-excl` ("Names can't be drawn fairly yet") exists. |
| Participant view while blocked or while scheduled draw is pending | none dedicated. Pre-draw participant boards `Exchange-Detail-before`, `-nolist` | both | **No blocked-participant board.** |
| Org-Draw-* (S35) | `Org-Draw-default/busy/error/excl/few/fewtwo/just` | canvas 2 | Yes (manual draw, not the scheduled state) |
| Email-Inventory, E-numbers | `Email-Inventory`, `Email-E01` to `E26` | canvas 1 | Yes |
| Blocked-draw email | `Email-E15` | canvas 1 | Yes |
| Join-by reminder, event reminder | `Email-E23`, `Email-E24` | canvas 1 | Yes |
| Complete email | none. Inventory says "Exchange complete: Activity only (GCO-015)" | | Decided: no email |
| Activity rows for reminders and complete | none drawn. Only the S09 spec text lists them | | **No row board** |
| S44 notifications | `Acc-Notif-default/off/saving/error/offline` (m, plus d for default) | canvas 2 | Yes |
| Joining-In-skipped, -noreminders | `Joining-In-skipped`, `Joining-In-noreminders` (also `-attached`, `-ideas`) | canvas 1 | Yes. canvas 2 has `Joining-In-odraws`, `-odrawsskipped` |
| Exchanges list Complete row, Past | `Exchanges-past`, `Exchanges-pastempty` | canvas 1 | Yes |
| S14 passed, complete (participant) | `Exchange-Detail-passed`, `-complete` | canvas 1 | Yes |
| S14 passed, complete (organiser) | `Exchange-Detail-ocomplete` (both canvases), `Org-Complete-*` (S41) | both | Yes |
| Auto-complete | no dedicated board; copy only ("it closes by itself on {date}") | | Copy only |

---

## S14 organiser: scheduled draw blocked (`Exchange-Detail-ofailed`, canvas 1)

Organiser who is **just organising**, "Book club gift swap", 2 people joined, joining closed Fri 4 Dec.

- Back: "Back to Exchanges".
- h1 **"Book club gift swap"**. Status line **"Names couldn't be drawn."** Meta line **"You're just organising · Everyone spends ₦5,000 to ₦10,000"**.
- Organiser block (`UwCard kind="block"`, no header, no faces): meta **"Needs you now"**, headline **"Names couldn't be drawn"**, body **"Only Nkem and Chika joined, and names need at least 3 people. Change the join-by date to give people more time. We'll try again then."**, one action **"Change join-by date"** (no href on the board; it is slice 13's edit, the Org-Edit flow).
- **Your part:** the single line **"You're just organising."** (no list row, no person row).
- **Dates:** "Join by" **"Fri 4 Dec, 6:00 pm"**; "Names drawn" **"Couldn't run on Fri 4 Dec"** (date only, no time); "Gifts exchanged" **"Sat 12 Dec"**; **"Times are in your time zone (WAT)."**
- **No People section** on this board (the "People (n)" block is absent).
- **Organiser tools** (four rows, no Exclusions row, no Hand over):
  - **"Invite people"**, sub **"People can join until Fri 4 Dec."**
  - **"Edit details"**, sub **"Name, note, budget and dates"**
  - **"Draw names now…"**, sub **"Or we draw them on Fri 4 Dec at 6:00 pm."** (the row is shown, not hidden)
  - Destructive text button **"Cancel exchange…"**
- Desktop `-d` twin exists; I did not open it. Assumed: same content, card in the grid row.

How it unblocks (board and specs): the card's only action is Change join-by date. Spec text (S35 error, S34, S14 error): "Scheduled draw couldn't run: organiser emailed, Exchange detail shows 'Names couldn't be drawn' with Change join-by date / Edit exclusions." and "Names couldn't be drawn: Change join-by date" under Edit details. Story GCO-011: "Changing the join-by date or draw time lets it try again." The board's body says "We'll try again then." Manual path: "Draw names now…" is still listed; with under 3 people its sheet is `Org-Draw-fewtwo` (below).

### Org-Draw-* (S35, canvas 2): the manual draw sheets reachable from the blocked state

- **`Org-Draw-fewtwo`** (also reached from `Exchange-Detail-ofew`, "2 people in, 1 more needed"): sheet `kind="view"`, title **"Not enough people yet"**, body **"Names need at least 3 people to draw. You and Ifeoma are in, so 1 more person needs to join. People can join until Fri 27 Nov."**, primary **"Invite people"**, cancel **"Close"**. The tool row reads **"Draw names now…"** sub **"Needs 3 people. 1 more to go."**
- **`Org-Draw-few`** (only the organiser so far): sheet **"Not enough people yet"**, body **"Names need at least 3 people to draw. Nobody has joined Book club gift swap yet. Share the invite link and people can join until Fri 4 Dec."**, primary **"Share the invite link"**, cancel **"Close"**.
- **`Org-Draw-excl`** (exclusions make it impossible): sheet `view`, title **"Names can't be drawn fairly yet"**, body **"With 6 exclusion pairs among 8 people, there's no way to give everyone a person. Remove a pair or invite more people, then try again."**, primary **"Edit exclusions"**, cancel **"Not now"**. The tool row there is "Exclusions" sub "6 pairs".
- `Org-Draw-default` confirm sheet: title **"Draw names for Family Christmas 2026?"**, body "8 people are taking part and 5 wishlists are in. Emeka, Tolu and Ada haven't added one, so their givers will have less to go on. This can't be undone.", note "Exclusions: Nneka and Obinna won't draw each other.", privacy "You won't see who got whom. Nobody will.", CTA "Draw names", alt "Edit exclusions", cancel "Not yet". `-busy`: body "Drawing names. This takes a moment, and tapping again won't draw twice." `-error`: note "The draw was interrupted before it finished. No names were drawn, so it's safe to try again." CTA "Try again". `-just`: same for 4 people, no alt. These are slice 10 and already built.
- Tool-row sub for the live scheduled state on every board: **"Or we draw them on Fri 27 Nov at 6:00 pm."**

### What is on the pre-blocked scheduled boards (organiser, canvas 2)

- `Exchange-Detail-ofew` (2 people, first time): status **"2 people are in. Names need at least 3 to draw."**; block meta **"Needs you by Fri 27 Nov"**, headline **"1 more person needed"**, body **"Names need at least 3 people to draw. Share the invite link with someone who'd like to join."**, action **"Invite people"**.
- `Exchange-Detail-ofewsoon` (joining closes tomorrow, still 2): status **"Only 2 people are in, and joining closes tomorrow."** Two blocks: meta **"Needs you today"** headline **"1 more person needed by tomorrow"** body **"If nobody else joins by Fri 27 Nov at 6:00 pm, names can't be drawn. Invite someone now."** action "Invite people"; then meta **"Or give people more time"** headline **"Move the join-by date"** body **"Pick a later date and names are drawn then instead."** action **"Change join-by date"**. This is a *warning before* the blocked state, not the blocked state itself.
- `Exchange-Detail-ofewready` (3 in): status **"3 people are in. Names are drawn Fri 27 Nov."**, no block.
- `Exchange-Detail-ofewreq`: **"2 people are in, and Chidi wants to join."**, block "Chidi wants to join." with action "Review request".
- `Exchange-Detail-ofewoffline`: same as `ofew`, block action `actionState="disabled"`.
- `Exchange-Detail-oclosed` (organiser-chooses, join-by passed): status **"Joining closed on Fri 27 Nov. 5 of 8 wishlists are in."**; block meta **"Joining has closed"**, headline **"The join-by date has passed"**, body **"The invite link no longer works, so this exchange can't be shared. To let more people in, change the join-by date."**, action **"Edit exchange"**. Dates: "Join by" **"Fri 27 Nov, 11:59 pm"**, "Names drawn" **"When you're ready"**. Tool row **"Draw names now…"** sub **"Joining has closed, so you can draw whenever you're ready."** (Exclusions and Edit details rows present.)

### Participant while blocked or pending

- **No board shows a participant view of a blocked draw.** The nearest boards are the ordinary pre-draw views (`Exchange-Detail-before`, `-nolist`; canvas 1 and canvas 2), which say **"Names are drawn on Fri 27 Nov."** (status), "You're all set / Names are drawn on Fri 27 Nov at 6:00 pm. We'll tell you who you're buying for. Only you will see it.", Your part row "Who you're buying for" sub **"You'll find out on Fri 27 Nov."**, Dates ("Join by", "Names drawn", "Gifts exchanged"). Nothing changes after a failed attempt on any board.
- Organiser-chooses participants: "Names are drawn: **When Ngozi is ready**" / "Joining closes at the end of Fri 27 Nov." (`Joining-In-odraws`).
- Activity row for the scheduled blocked draw to members: none. Spec rule: "Never names a recipient."
- Organiser-only: the organiser's block and the E15 email.

---

## Emails (Email-Inventory and templates)

### Inventory structure (`Email-Inventory`)

Categories and rows: Sign-in (E01 to E05), Invitations and joining (E06 to E09), Organiser actions and exchange changes (E10 to E18), Draw and gifting (E19 to E22), Reminders (E23, E24), Account, privacy, deletion (E25, E26). Each row: Subject, trigger, recipient, timing, variables, mandatory or optional, opt-out toggle, source story, status, priority. The P0 MVP list (T1 to T12) includes T3 E19, T3b E20, T3c E22, T3d E21, T4 E23, T5 E24, T6 E10, T7 E07, T7b E08, **T8 E15**, T9 E13, T10 E12, T11 E14, T12 E11.

### E-numbers after E21 (and the ones slice 12 touches)

| No. | Name | Trigger | Recipient | Mandatory | Subject | Status |
| --- | --- | --- | --- | --- | --- | --- |
| E15 | Names couldn't be drawn | "Scheduled draw tries once and can't run (under 3 people, or exclusions make it impossible)." Timing "At the draw time, after the one attempt." | The organiser | **Mandatory**, no unsubscribe, "Not in the GC-026 list, so add it to 'always sent'" | "Names couldn't be drawn for {exchange_name}" | In stories, P0 |
| E22 | Your person has changed | Organiser confirms Fix the pairs or Give them someone | Only that giver | Mandatory | "Your person for {exchange_name} has changed" | In stories, P0 (slice 14) |
| E23 | Join-by reminder | "24 hours before join-by." | "People taking part who have no list for this exchange." | Optional, toggle "Join-by reminder" | "Add your wishlist before tomorrow" | In stories, P0 |
| E24 | Event reminder | "9:00 am the day before the gift day, in each person's time zone." | "Everyone taking part (not an organiser who is just organising)." | Optional, toggle "Event reminder" | "Gifts are exchanged tomorrow" | In stories, P0 |
| E25 | Your data is ready | Privacy, request data | account email | Mandatory | "Your Unwrap data is ready" | P1, not slice 12 |
| E26 | Account deleted | Delete confirmed | account address | Mandatory | "Your Unwrap account has been deleted" | P2, not slice 12 |

E19 (Names are drawn), E20 (drawn again), E21 (just organising) already exist; E17 "Gift day passed, names never drawn" is slice 15; E16 "Someone left" and E18 "Everyone's ready" are not slice 12. **There is no complete email.** Inventory "Not sent" table: **"Exchange complete: Activity only (GCO-015). Nothing to do, so no email."**

### E15 Names couldn't be drawn (`Email-E15`)

Spec: Subject "Names couldn't be drawn for {{exchange_name}}"; Preview text **"Fix it and we'll try again."**; Trigger "A scheduled draw tries once and can't run (GCO-011)."; Recipient "The organiser."; Primary CTA **"Fix the draw"** → `{{action_url}}` (ink button); Variables `first_name, exchange_name, draw_at, reason, fix, action_url`; "Mandatory: no unsubscribe link"; Notes "Not in the GC-026 lists. Recommended as always sent."

Body (mobile and desktop identical):
- Wordmark "Unwrap"; h2 **"We couldn't draw names"**
- "Hi Tolu,"
- **"We tried to draw names for Family Christmas 2026 at Fri 27 Nov, 6:00 pm WAT, but couldn't. Only 2 people are taking part, and a draw needs at least 3."**
- **"To fix it: Invite at least one more person and move the join-by date, or cancel the exchange. Once you do, we'll try again at the new draw time."**
- Button **"Fix the draw"**; **"Button not working? Paste this link into your browser:"** + link
- "Happy gifting," / "The Unwrap team"
- Footer: **"You're getting this because you're organising Family Christmas 2026."** and "Unwrap · Secret Santa, without the spreadsheet". **No "Manage email settings" link.**

Only the "under 3 people" body is drawn. The "exclusions" body has no board (variables `reason` and `fix` imply it switches).

### E23 Join-by reminder (`Email-E23`)

Spec: Subject **"Add your wishlist before tomorrow"**; Preview **"Joining for {{exchange_name}} closes {{join_by}}."**; Trigger "24 hours before join-by."; Recipient "People taking part with no list for this exchange."; CTA **"Add my wishlist"** → `{{action_url}}` (ink); Variables `first_name, exchange_name, join_by, action_url, settings_url`; "Optional: carries Manage email settings"; Notes **"Not sent if join-by was within 24 hours of joining."**
Body: h2 **"One day left to add your wishlist"**; "Hi Tolu,"; **"Joining for Family Christmas 2026 closes on Fri 27 Nov, 6:00 pm WAT, and you haven't added a wishlist yet."**; **"Add a few ideas so whoever draws your name knows what you'd like. It takes a minute, and only they will see it."**; button **"Add my wishlist"**; paste-link line; sign-off. Footer **"You're getting this because you're taking part in Family Christmas 2026 and haven't added a wishlist."** + **"Manage email settings"** link.
The inventory also recommends "skip anyone nudged (E10) in the last 12 hours" and "if a reminder is due within an hour of E11, fold it into E11" (marked Recommendation, not decided).

### E24 Event reminder (`Email-E24`)

Spec: Subject **"Gifts are exchanged tomorrow"**; Preview **"{{exchange_name}} is on {{event_date}}."**; Trigger "9:00 am the day before the gift day, in each person's time zone."; Recipient "Everyone taking part."; CTA **"View their wishlist"** (ink) if revealed, otherwise **"Reveal who you got"** (clay), both → `{{action_url}}`; Variables `first_name, exchange_name, event_date, budget_range, revealed, action_url, settings_url`; Optional, carries Manage email settings; Notes "Two button versions".
Body: h2 **"It's nearly gift day"**; "Hi Tolu,"; **"Family Christmas 2026 is tomorrow, Thu 24 Dec. Time to make sure your gift is ready."**; rows "Budget per gift" **"₦10,000 to ₦20,000"** and "Gift day" **"Thu 24 Dec"**; button; paste-link line; sign-off. Footer **"You're getting this because you're taking part in Family Christmas 2026."** + "Manage email settings".
Only the "View their wishlist" version is drawn (the Reveal version is spec text only).

### E19, E21 (context, already built)

E19 CTA "Reveal who you got" (clay), footer "taking part"; E21 recipient "The organiser, when not taking part", CTA "View exchange" (ink), footer "You're getting this because you're organising Family Christmas 2026." Both include "Manage email settings". Notes "Never names anyone."

### Common rules (inventory `rules` and `merges`)

- Secrecy: no email names who someone buys for, in subject, preview or body.
- Time zones: "emails can't read the browser. Assumption: store each person's last-seen time zone and use it for every date and time. For invitees with no account (E06), show the organiser's zone with its label, for example '6:00 pm WAT'. The gift day is a date only, with no time, so it reads the same in every zone."
- Opt-outs: the four GC-026 types carry "Manage email settings" and one-click unsubscribe for that type only; mandatory emails carry neither.
- "Notification settings: add E15 (names couldn't be drawn) and E22 (your person has changed) to the 'always sent' list in Notifications."
- Stop rules: cancelling stops unsent nudges and scheduled reminders; leaving or removal stops that person's emails for that exchange.
- Questions answered: join request declined: no email; joining open again: Activity only.

---

## Activity (S09): reminders and complete rows

- `Activity-default-m/-d` (and `-older`, `-allread`, `-offline`) show only: "Names are drawn for Office Secret Santa." (sub "9:00 am · See who you're buying for", unread), "Chidi asked to join Family Christmas 2026." (sub "8:12 am · Approve or decline"), "Tolu joined Family Christmas 2026.", "Dates changed for Office Secret Santa." (sub "2:15 pm · Gifts are now on Sat 19 Dec"), "Ifeoma is now the organiser of Office Secret Santa.", "Emeka joined Family Christmas 2026." Row format: `UwListItem kind="activity"`, title sentence with full stop, sub "time · call to action", exchange tag and tint, chevron, unread dot. Headings Today / Yesterday / date. Footer buttons "Load older activity" and link **"Choose which emails you get"**.
- **No board draws a join-by reminder row, an event reminder row, or an exchange-complete row.**
- Spec text only (`Core.dc.html` S09): "Events grouped by day with unread markers: Names drawn / drawn again (to everyone taking part); Your person has changed (only that giver); Someone joined / asked to join (organiser); Dates changed; **Join-by reminder and event reminder**; Joining reopened; You're now the organiser / {name} is now the organiser; **Exchange complete**. Never names a recipient or says whose person changed."
- S41 success (spec text): "Moves to Past. Everyone gets Activity '**{exchange} is complete.**' Page shows 'Finished' with Start another." The toast on `Org-Complete-done`: **"Family Christmas 2026 is complete."** (a plain toast, not an Activity row).
- Other states: `Activity-empty` is `UwEmpty kind="caught-up"`; `-error` alert "We couldn't load your activity. Nothing you've done is lost."

---

## S44 Notifications (`Acc-Notif-*`, canvas 2)

Page `/profile/notifications`. Back "Go back" to Profile. h1 **"Notifications"**, intro **"Changes save as you make them. We only send email for now."** Then one checkbox group (`UwRadio kind="check"`, label "Emails you can turn off"), four options, all selected by default:

1. **"Names are drawn"**: "Find out who you're buying for. Also sent if names are drawn again or your person changes."
2. **"Someone joins"**: "Only for exchanges you organise."
3. **"Join-by reminder"**: **"If you haven't added a wishlist, we'll remind you the day before joining closes."**
4. **"Event reminder"**: **"We'll remind you the day before gifts are exchanged."**

Then h2 **"Always sent"** with **"You can't turn these off: an exchange you're in is cancelled, you were removed from one, you're now the organiser, and sign-in codes."** Then a muted 14px line **"Reminders also show in Activity."** (below Always sent).

States: `off` (option 2 unchecked, toast **"Saved. You won't get Someone joins emails."**), `saving` (boxes disabled, `UwLoading spinner` "Saving your change"), `error` (alert **"We couldn't turn off Someone joins, so it's still on. Try again."**), `offline` (alert **"You're offline. Pages you've opened stay on screen."**, boxes disabled). Desktop: 600px column. Spec text (Account.dc, S44): "Four types, all on by default... Reminders also appear in Activity" and "Saved quietly. Reminder promises elsewhere (You're in, Home) follow these settings."

The "Always sent" board text does not list E15 (names couldn't be drawn) or E22, although the inventory says to add them.

---

## S12 You're in: reminder promises (`Joining-In-*`)

- **`Joining-In-attached`** (list attached, join-by reminder irrelevant): "How we'll tell you": **"An email when names are drawn."** / **"A reminder the day before gifts are exchanged."** / link **"Choose which emails you get"**. Timeline: "Names are drawn **Fri 27 Nov, 6:00 pm**", "Gifts are exchanged **Sun 20 Dec**", "Times are in your time zone (WAT)."
- **`Joining-In-skipped`** (no list): Your list row **"No list yet"** sub **"Add one before Fri 27 Nov. We'll email you the day before."**, button "Add a wishlist" (plus icon), and "How we'll tell you": **"An email when names are drawn."** / **"A reminder the day before joining closes, if you still have no list."** / **"A reminder the day before gifts are exchanged."** / link "Choose which emails you get".
- **`Joining-In-noreminders`** (all reminder emails off): list attached; "How we'll tell you": **"You've turned these emails off, so updates show in Activity only."** then the link. (Shows no per-type lines, and says nothing about the draw email specifically.)
- **`Joining-In-ideas`** also has a reminders block (not read in detail).
- Spec text (`Joining.dc`): "How I'll be told: draw email, join-by reminder (only with no list), event reminder, each shown only if that type is on" and "List skipped: 'Add one before {join-by}. We'll email you the day before.' Only if the join-by reminder is on. All reminder types off: no reminder promise."
- Canvas 2, organiser-chooses (`Joining-In-odraws`, `-odrawsskipped`): timeline "Names are drawn **When Ngozi is ready**" / "Joining closes at the end of Fri 27 Nov. Only you will see who you're buying for." The skipped board keeps "A reminder the day before joining closes, if you still have no list." and "Add one before Fri 27 Nov. We'll email you the day before."

---

## Exchanges list: Past and Complete (`Exchanges-past`, `-pastempty`, canvas 1)

- Header "Exchanges" with the profile avatar, `UwTabs` "Active | Past" (Past active, full width).
- Past rows (`UwListItem kind="exchange"`, faces trailing): **"Family Christmas 2025"** sub **"Complete. Gifts were exchanged on Wed 24 Dec 2025."** (not a link on the board), **"Office Secret Santa 2025"** sub **"Complete. Gifts were exchanged on Fri 19 Dec 2025."** (links to `Exchange-Detail-complete`). Sub format: "Complete. Gifts were exchanged on {weekday day month year}."
- `-pastempty`: `UwEmpty kind="quiet"` (copy in the component, not read).
- The mobile boards also show a floating `UwCard kind="action"` "Names are drawn for Office Secret Santa / Only you will see who you got / Reveal who you got" above the tab bar (a leftover from the Active tab; it is the personal-action tray, assumed not part of Past).
- Active rows show states such as "Names are drawn. Gifts on Sat 19 Dec." and "Uni friends Secret Santa / Names were drawn before Kemi could let you in." (Dismiss).

## S14 passed and complete

### Participant, passed (`Exchange-Detail-passed`)
h1 "Office Secret Santa"; line **"Gifts were exchanged on Sat 19 Dec."**; meta "Organised by Ifeoma Nwosu · Everyone spends ₦15,000 to ₦25,000"; a block (h2) **"Gifts were exchanged on Sat 19 Dec"** with **"This exchange closes on Sat 26 Dec. Until then you can still open their wishlist."**; Your part keeps the list row ("Your list for this exchange", "From “My Christmas wishlist”. 6 items. Only your giver can see them.", chevron) and the person row ("Kemi Bello", "Who you're buying for", chevron to the wishlist); Dates ("Join by", "Names drawn", "Gifts exchanged"); People (6); "Leave exchange…" still present. No ActionCard. Gift day Sat 19 Dec, closing date shown Sat 26 Dec (gift day + 7).

### Participant, complete (`Exchange-Detail-complete`)
Back goes to Exchanges Past. h1 "Office Secret Santa 2025"; line **"Complete. Gifts were exchanged on Fri 19 Dec 2025."**; meta "Organised by Ifeoma Nwosu · Everyone spends ₦10,000 to ₦20,000"; block h2 **"Finished"** with **"There's nothing left to do here. Your wishlist is still yours to use."**; Your part list row (sub "From “My Christmas wishlist”. 6 items.", no chevron) and person row "Tobi Ojo" sub **"You bought for Tobi"** (no chevron, no link); Dates (only "Names drawn" **"Fri 28 Nov 2025, 6:00 pm"** and "Gifts exchanged" **"Fri 19 Dec 2025"**); People (4); button **"Start another exchange"**. No Leave, no tools.

### Organiser, gift day passed (`Exchange-Detail-ocomplete`, both canvases)
h1 "Family Christmas 2026"; line **"Gifts were exchanged on Thu 24 Dec."**; meta "You organise this and you're taking part · Everyone spends ₦10,000 to ₦20,000"; block meta **"Needs you now"**, headline **"Gifts were exchanged on Thu 24 Dec"**, body **"Mark it as complete to wrap things up. If you don't, it closes by itself on Thu 31 Dec."**, action **"Mark as complete…"**. Then Your part (list row, person row "Kemi Bello"), Dates, People (8) with "See all", Organiser tools ("Edit details" sub "After the draw, only the budget and gift day can change.", "Hand over organising…", "Cancel exchange…").

### Mark as complete (`Org-Complete-*`, canvas 2, slice 15)
Confirm sheet title **"Mark Family Christmas 2026 as complete?"**, body **"After this, nothing can be edited, cancelled, left or fixed, and got-it marks freeze. If you don't, it closes by itself on Thu 31 Dec."**, CTA "Mark as complete", cancel "Not yet". `-error`: note "We couldn't mark it as complete just now. Nothing has changed.", CTA "Try again". `-done`: block "Finished" with **"Everyone was told it's complete. It's now under Past, and nothing here can change."**, person row "You bought for Kemi", button "Start another exchange", toast "Family Christmas 2026 is complete."

### Auto-complete
No board. Only copy: "it closes by itself on {date}" (organiser, date = gift day + 7) and "This exchange closes on {date}." (everyone else). S41 purpose in the spec: "Close a drawn exchange after the event. Otherwise it closes by itself 7 days after." Story GCO-015: automatic completion "7 days after the gift day ends". Auto-complete has no email and no screen of its own; Activity text "{exchange} is complete." is the S41 rule, shown to everyone.

---

## What I could not find or read

- Participant-facing blocked-draw state: no board.
- Blocked draw for the exclusions cause: no organiser block board; only the pre-draw sheet `Org-Draw-excl`. The E15 exclusions body copy: no board.
- Activity rows for join-by reminder, event reminder and exchange complete: no board (spec text only). Activity copy for those three is not on any board.
- E24 "Reveal who you got" variant: spec text only.
- Home "All caught up" next-date line with a reminder promise: spec text only (item 56, out of scope here).
- Desktop twins: I read `Exchange-Detail-ofew-d` and `Acc-Notif-default-d` fully; I did not open `Exchange-Detail-ofailed-d`, `Exchanges-past-d` or other desktop twins (sizes match their mobile twins).
- I did not render the boards, so chip, colour and icon details come from component props.
- Canvas 2 `Exchange-Detail-ofailed` does not exist (only canvas 1 has it).

## Conflicts or gaps vs the plan (`docs/tasks/slice-12.md`), the stories and the email docs

1. **"Draw names now…" is NOT hidden while blocked.** The board `Exchange-Detail-ofailed` keeps the row, with sub "Or we draw them on Fri 4 Dec at 6:00 pm." The plan ("Draw names now… hidden while blocked") and Q3 recommend hiding it. The board's sub is also wrong after a failed attempt (nothing will draw then) and contradicts "never retries". Decision needed: follow the board and fix the sub, or hide it. Related: story GCO-011 wording (check it says hidden).
2. **Blocked board shows only the "under 3 people" cause.** The exclusions cause has no card, no body, no "Edit exclusions" action, and the board's Organiser tools has no Exclusions row, although GCO-011 and the S35/S14 spec text say "Change join-by date / Edit exclusions". Plan item 4 (reason in 'few', 'exclusions') needs a card copy for exclusions that has no design. Ask or put in copy-pending.
3. **The card names the people who joined** ("Only Nkem and Chika joined"). Fine for the organiser, but the body needs variants for 0, 1 or 3+ people (not drawn), and must stay organiser-only (plan Q5 hides the reason from members). The board shows "Names drawn: Couldn't run on Fri 4 Dec" in the Dates block, which is also a signal members would see on the same page if shown to them; no participant version exists.
4. **Participant while blocked: no board** (plan Q6). Boards give only the ordinary "Names are drawn on {date}" view. The plan's "nothing dated" recommendation has no design either way.
5. **Blocked board is for a "just organising" organiser with no People section and no Hand over row.** The plan does not say whether those rows hide when blocked. Treat the board as a variant, not a rule (assumed).
6. **"Invite people" on the blocked board says "People can join until Fri 4 Dec."** but joining closed at the scheduled draw (state `joining_closed`; slice 10 says drawing closes joining and the link stops). The invite link does not work after join-by; the copy contradicts the plan's state model. Compare `Exchange-Detail-oclosed` ("The invite link no longer works").
7. **Date edit unblocks, but the "Change join-by date" action is slice 13** (plan out of scope). Slice 12 needs the card button to link somewhere; Edit details exists (slice 6/slice 13). The plan's "slice 13's date edit clears the reason" matches the card's "We'll try again then." That body copy promises a retry the plan defers to slice 13: CLAUDE.md says never promise what is not built. Ask whether slice 12 ships the copy before slice 13.
8. **E15 variables are `first_name, exchange_name, draw_at, reason, fix, action_url`** and the body names the reason ("Only 2 people are taking part, and a draw needs at least 3."). The plan says templates carry the exchange id only and members never learn the reason; the organiser email is organiser-only, so the reason is fine for the organiser, but the plan's "carry the exchange id only" must allow `people_count`, `draw_at` and the reason code. Needs the plan to say how the template gets those without pair data (they are not pair data).
9. **E15 draw time text.** Body says "at Fri 27 Nov, 6:00 pm WAT" in the recipient's zone with a label. Plan AC-10 (every date in the recipient's zone) matches; the gift day "as stored" is not in E15.
10. **E15 numbering and docs.** The plan says "template numbers from Email-Inventory"; the numbers are E15 (blocked), E23 (join-by), E24 (event). Existing repo docs (`docs/email-templates.md`) cover only E01 and E02 (sign-in) so there is no repo copy of these three yet; copy-pending should list subjects and preview lines for E15, E23 and E24. Not found in `docs/email-sender.md` conflicts: not checked beyond the inventory (assumed no conflict).
11. **E15 is Mandatory with no "Manage email settings" link.** Matches plan Q4 ("always sent, no Activity event"). But the S44 "Always sent" line on the board does not list it, and the inventory says to add it. Conflict between board and inventory; story GC-026 (as updated 2026-11-17) lists only emails that exist now, so slice 12 should add "names couldn't be drawn" to that line (needs owner approval of the line).
12. **Event reminder recipient.** Inventory E24: "Everyone taking part (not an organiser who is just organising)." Plan: "members taking part." Same. Plan Q7 says drawn only; the inventory trigger is "9:00 am the day before the gift day" with no draw condition and a `revealed` variable, and the second button "Reveal who you got" assumes the draw happened. The "if the person hasn't revealed yet" wording needs a drawn exchange. Drawn-only fits, so a never-drawn exchange gets no event reminder (matches plan Q7).
13. **E24 `revealed` variable and button.** The email picks "View their wishlist" vs "Reveal who you got" from whether the member has revealed. Reading that flag in `tick()` is per-member state, not pair data, but it must not touch `assignments` for the host's pair. Confirm it reads only the member's own reveal flag (plan did not mention it).
14. **E23 skip rules.** The board and GC-026: skipped when join-by was within 24 hours of joining (plan matches: "joined at least 24h before join-by"). The inventory's extra recommendations (skip anyone nudged in the last 12 hours; fold into E11 if a reminder is due within an hour of E11) are **not in the plan**. They are labelled "Recommendation", not decided; ask.
15. **E23 and organiser-chooses.** Plan: "while open", due between join-by minus 24h and join-by. Canvas 2 organiser-chooses boards show a join-by of "Fri 27 Nov, 11:59 pm" and still promise the join-by reminder (`Joining-In-odrawsskipped`). So the join-by reminder applies in both draw modes (assumed, plan seems to agree).
16. **Auto-complete date and copy.** Boards: gift day Thu 24 Dec, "closes by itself on Thu 31 Dec"; gift day Sat 19 Dec, "closes on Sat 26 Dec". That is gift day + 7 as the last day shown. Plan: completes at `(gift_day + 8)::timestamp at organiser_tz`, i.e. the end of the 7th day after the gift day. These agree if the UI shows `gift_day + 7`. State it explicitly in the build, or the UI will say "Fri 1 Jan" (gift day + 8). Story: "7 days after the gift day ends."
17. **Auto-complete Activity row.** Plan: one Activity event per active member, no email. Spec: "Everyone gets Activity '{exchange} is complete.'" Matches. Row copy "{exchange} is complete." appears only in the spec text and the toast "Family Christmas 2026 is complete."; no row board. Putting this copy in the Activity feed needs approval (copy-pending).
18. **Reminder Activity rows have no design and no copy.** Plan Q12 (Activity copy for the three kinds: board, otherwise copy-pending) resolves to copy-pending. The spec only lists the kinds. Row format must follow existing `kind="activity"` rows (title sentence with full stop, sub "time · call to action"). Unknown sub text.
19. **S44 toggles.** All four are on one checkbox group; the two reminder toggles use the exact lines above, and the extra line "Reminders also show in Activity." sits below "Always sent". The slice 7 story says those two toggles stay hidden until slice 12 and the line "waits with them"; consistent. Saved toasts follow the existing pattern ("Saved. You won't get Join-by reminder emails." assumed from "Saved. You won't get Someone joins emails."; no board for Join-by or Event reminder names in a toast).
20. **Reminder promise lines (items 77, 88).** Boards: "A reminder the day before joining closes, if you still have no list.", "A reminder the day before gifts are exchanged." on S12; "Add one before Fri 27 Nov. We'll email you the day before." on the skipped list row; noreminders: "You've turned these emails off, so updates show in Activity only." Spec: shown only if the type is on. The skipped board's list-row line is written "the day before" but E23 goes out 24 hours before join-by, not "the day before" in calendar terms; wording can promise more than the schedule delivers for join-by at, say, 1:00 am. Event reminder wording "the day before gifts are exchanged" matches 9:00 am the day before.
21. **Noreminders board.** Says "You've turned these emails off" even though the "Names are drawn" email may still be on; the board does not distinguish. When only reminders are off (draw email on), no board exists.
22. **GC-011 and GC-010 promise lines** (the plan's Q11): the boards give the exact S12 lines above. GC-010's "Add your wishlist / Your giver has nothing to go on yet." is the card on `Exchange-Detail-nolist` (title "Add your wishlist", sub "Your giver has nothing to go on yet. Names are drawn on Fri 27 Nov.", CTA "Add your wishlist", `dismiss="false"`).
23. **Complete row in the Exchanges list.** "Complete. Gifts were exchanged on {date with year}." The plan notes completed rows open "Not available" until slice 15; the board shows the Past row linking to `Exchange-Detail-complete`. One of the two Past rows has no link on the board. Consistent with the plan's open item.
24. **Passed state.** The passed board shows "Leave exchange…" still available and "Names drawn" row in Dates. The plan does not touch the passed state (slice 15), so no conflict, but the closing date "Sat 26 Dec" must use the same +7 rule as item 16.
25. **E19/E21 "Optional: carries Manage email settings"** versus E15/E22 mandatory. Plan consistent.
26. **Complete email.** Inventory says no email on completion; plan says no email. Matches.
27. **Time zones in emails.** Inventory assumption: "store each person's last-seen time zone". The plan uses `user_settings.timezone`, then `organiser_tz`, then Lagos. Same idea, different wording (plan decided).
28. **Cancel stops reminders.** Inventory "Stop rules: cancelling an exchange stops its unsent nudges and scheduled reminders." Plan AC-7 covers cancel; leaving or removal stops that person's reminders ("Leaving, removal or account deletion stops that person's emails for that exchange"): the plan's recipient rules only say "active members", which covers it.

## Conflicts or gaps vs the plan: update after the 2026-11-24 refresh

Items 1 to 28 above still stand. Status against the four owner decisions recorded in `docs/tasks/slice-12.md` (Board decisions 2026-11-24), and additions:

- **B1 (keep "Draw names now…" visible, drop "Or we draw them on {date}." and "We'll try again then")**: consistent with the live boards. The re-read of `ofailed-d` confirms the board still carries both strings, so the built UI will deliberately differ from the board here; copy goes to copy-pending. The canvas 2 note ("Draw names now… stays tappable and explains why it can't run") supports keeping the row. Not contradicted.
- **B2 (exclusions cause uses the same blocked card with an "Edit exclusions" link)**: still no board for the card; `Org-Excl-impossible` exists and is the link target. Not contradicted.
- **B3 (no extra E23 skip rule)**: not contradicted; no board changed.
- **B4 (E15 mentioned on S44 "Always sent")**: not contradicted; the `Acc-Notif-default` "Always sent" line still omits the could-not-draw email.
- **29 (new).** `Org-Excl-impossible` promises "the draw checks again later". The blocked card on slice 12 does not retry until slice 13 changes the date. Different surface (pre-draw warning), so no conflict, but the word "later" must not be copied onto the blocked card.
- **30 (new).** Part 3 (https://claude.ai/artifact/YaQwgPuKnzVDz27fxzFNsj) exists and is not in CLAUDE.md "Source of truth". It has no slice 12 boards. Ask the owner whether to add it to CLAUDE.md.
- **31 (new).** The designer's own note says the participant view of the under-3 moment "isn't designed here". So the plan's "participants see nothing dated" (Q6) has no board either way; unchanged gap, now confirmed as deliberate.
- **32.** The owner said the canvases were updated. The published versions equal those read earlier today, so either the update is unpublished or it was already included in the earlier read. If new boards were expected (participant blocked view, Activity rows, E15 exclusions body, E24 Reveal variant), they are **not on the published canvases**.
