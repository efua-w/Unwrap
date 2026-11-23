# Slice 11 boards: written spec from the live canvas

Read 2026-11-23, read-only, from the published canvas files of "Unwrap" (https://claude.ai/artifact/VAgJERFNKxRU1Y96njz8Ue, version 1795447101-3e6b), via the Artifact tool (`list_files`, `read_file`). All content below is read from the board source (`project/*.dc.html`) and is **verified** unless marked "assumed".

"Unwrap • Part 2" (https://claude.ai/artifact/9pHtZC2Z3ctDbsbghVkCKG) was listed. It holds only pre-draw and organiser boards (My-List-*, Org-*, Exchange-Detail-o*, Acc-*, Entry-Invite-*). It has no S11 after the draw, S14 revealed, S15 or S16/S17 board. So every board for this slice is in the first canvas, all under the page "02. Exchanges".

Board naming (the canvas does not use S-numbers in the file names, only in titles):

| Spec name | Canvas title prefix | File prefix (each has `-m` 390x844 and `-d` 1440 wide) |
| --- | --- | --- |
| S16 recipient list | "S16 Recipient's wishlist" | `Exchange-Wishlist-*` |
| S17 item detail | "S17 Item detail" | `Exchange-Wishlist-item*`, `-copied`, `-nolink` |
| S11 after the draw | "S11 Attach wishlist" | `Joining-Attach-drawn`, `-drawnlist`, `-remove`, `-removed` |
| S14 exchange detail | "S14 Exchange detail" | `Exchange-Detail-revealed`, `-drawn`, `-hidden`, `-changed`, `-passed`, `-complete` |
| S15 reveal | "S15 Reveal" | `Exchange-Reveal-*` |

Common to all: Bona Nova headings, Plus Jakarta Sans body. Components are the canvas `Uw*` set (UwNav, UwListItem, UwButton, UwAlert, UwToast, UwSheet, UwModal, UwCard, UwAvatar, UwLoading). The boards use raw hex values in the mock-up. The built code must use tokens.

---

## S16 Recipient's wishlist (`Exchange-Wishlist-*`)

### Layout
- **Mobile (390x844):** `UwNav back` ("Go back", goes to Exchange-Detail-revealed) with 8px top padding. Then `main` (20px side padding, 32px gap): header, count row, list, hint line. Bottom tab bar (Exchanges active, badge 2). No ActionCard.
- **Desktop (1440):** left sidebar (240 to 280px, Exchanges active) and `main` with 40px padding. Inside, a `max-width: 1040px` wrapper, and inside it a `max-width: 760px` column holding a back button (`UwButton variant="back"`, "Go back"), the header, the count row, the list and the hint. h1 is 36px (mobile 30px). The page has no banner.
- Header: h1 **"Kemi's wishlist"** (Bona Nova 400). Under it: **"You're buying for Kemi Bello. Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec."** (16px, secondary colour). It uses the recipient's full name and the budget range and the gift day (date only).
- Count row (14px, muted, space-between): **"6 items"** left, **"Recently changed first"** right.
- Rows: `UwListItem kind="item"`, 72px, divider between rows, whole row is a link (opens the item sheet, board S17).
  - title = item name. sub = **"{price} · {Most wanted|Nice to have}. {note}"**. Example: "₦22,000 · Most wanted. Anything that fits small ears. White if possible." Row with no note: "₦6,000 · Nice to have".
  - trailing: `chevron` by default. `date` with label **"Updated"** (first row only on default). `date` with label **"You got this"** (same chip kind as Updated, marked board). `urgent` with label **"Over budget"** (the Silk pillowcase row, ₦28,000 against ₦25,000 max).
  - Only one trailing slot per row. No board shows two badges on one row (for example Updated and Over budget).
- Hint under the list: **"Only you can see what you mark. Kemi never will."** (14px, muted).
- No "taken-off" rows appear in the list (see Removed state).

### Rows in the default board (copy, in order)
1. Noise-cancelling earbuds, "₦22,000 · Most wanted. Anything that fits small ears. White if possible.", Updated
2. Ankara laptop sleeve, 14 inch, "₦12,500 · Most wanted. For my work laptop. Bright colours please."
3. Silk pillowcase, "₦28,000 · Nice to have. Any neutral colour.", Over budget
4. Scented candle set, "₦9,500 · Nice to have. Vanilla or sandalwood."
5. Dotted journal, A5, "₦7,000 · Nice to have. Hardcover, dotted pages."
6. Jollof spice gift box, "₦6,000 · Nice to have" (no note, no link; opens the No shop link sheet)

### States (all have -m and -d)
| State (file) | What it shows |
| --- | --- |
| default | as above |
| loading | Header with the name already shown ("Kemi's wishlist" and the intro line), then `UwLoading kind="row" rows="5"`. No count row, no hint. |
| empty | Header, then h2 (Bona Nova 700, 18px) **"They haven't added anything yet"** and body **"Check back closer to Sat 19 Dec. New items show here as soon as Kemi adds them."** No count row, no hint. |
| nolist | Header, then h2 **"Kemi hasn't added a wishlist yet"** (no full stop) and body **"Ifeoma can send a reminder. Until then, the budget is your best guide."** |
| error | Header, then `UwAlert kind="error"` **"We couldn't load Kemi's wishlist. Nothing you marked is lost."** (the alert carries an href back to default, i.e. a retry/link action; its own button label is the component's, not set on the board). |
| offline | `UwAlert kind="offline"` at the top of main, above the header: **"You're offline. Pages you've opened stay on screen."** Then the normal list (shows Updated, Over budget). No hint line. |
| marked (success) | List as default except row 1 trailing label is **"You got this"**. Toast `UwToast kind="undo"` above the tab bar: **"Marked “Noise-cancelling earbuds” as got. Only you can see this."** with action **"Undo"**. |
| removed (taken off) | Between header and count row, a grey note block (12px radius, 12/16px padding, 14px text, #f7f7f7 background): **"Kemi took “Noise-cancelling earbuds” off the list after you marked it. You can still unmark it."** Count row now **"5 items"**. The taken-off item is not in the list, and the board shows no control to unmark it (gap). The row list has no "Updated" badge on this board. |

Not on any board: a row with no price (and so no budget flag), an Under budget item, a no-budget exchange (the intro sentence without "Spend ..."), a "Hidden on this device" version of `/recipient`, an error for a failed mark, and a combined Updated plus Over budget row.

---

## S17 Item detail (`Exchange-Wishlist-item*`, `-copied`, `-nolink`, `-itemgot`, `-itembusy`, `-itemoffline`)

The S16 default page stays visible behind a scrim (#191a1c at 40% alpha). Mobile: `UwSheet kind="view"` (bottom sheet, hint height 520px). Desktop: `UwModal kind="view"` centred, `max-width: 480px`, 80px from the top. Same props both ways.

### Default item (Noise-cancelling earbuds)
- title **"Noise-cancelling earbuds"**
- meta **"₦22,000 · Most wanted"**
- note (grey rounded block) **"Within the ₦15,000 to ₦25,000 budget."**
- body (item note in curly quotes) **"“Anything that fits small ears. White if possible.”"**
- privacy line (UwAlert privacy) **"Only you can see what you mark. Kemi never will."**
- Buttons, top to bottom: primary **"Open the shop"**, secondary **"I got this"** (the `alt` button, links to the marked board), then **"Copy link"** (the sheet's cancel slot, text/secondary). There is no separate Close button on this variant. (Dismiss is by scrim or the page back; the board shows no close X. Assumed: UwSheet has its own drag/close handling; not verified.)

### States
| State (file) | Differences |
| --- | --- |
| item (default) | as above |
| copied | S16 page with toast `UwToast kind="plain"` **"Link copied. Paste it anywhere to share."**, sheet closed (this board shows the list behind, no sheet). |
| itembusy | same sheet, `alt` button `altState="busy"` (the "I got this" button shows its busy state). |
| itemgot (already marked) | meta **"₦22,000 · Most wanted · You got this"**; alt button label **"I haven't got it after all"**; the list behind shows row 1 with trailing "You got this". |
| nolink | Item "Jollof spice gift box", meta **"₦6,000 · Nice to have"**, note "Within the ₦15,000 to ₦25,000 budget.", body **"No shop link. The name and note are all there is."**, primary button is **"I got this"**, second button **"Close"**. No Open the shop, no Copy link. |
| itemoffline | `UwAlert offline` at the top of the list behind; sheet note replaced with **"You're offline, so marking is off for now. The shop link still works."**; `alt` "I got this" is `altState="disabled"`; Open the shop and Copy link stay active. |

Not on any board: Over budget and Under budget sheets (the note text for those), an item with a link but no price, a failed-mark error, and an "Unmark" path for a taken-off item.

---

## Reveal, S15 (`Exchange-Reveal-*`)

Reveal is a full-screen page with its own header row: wordmark "Unwrap" on the left and `UwButton variant="icon" icon="x" label="Close"` (44x44) on the right. Close goes to Exchange-Detail-revealed (after reveal) or the matching Exchange-Detail board (before).

### before (privacy check)
- h1 **"Make sure no one's looking"**
- body **"Your person's name shows on the next screen. Check nobody can see your screen first."**
- `UwAlert privacy` **"Only you will see who you got. The organiser can't see it either."**
- Buttons: brand **"Reveal who you got"** (envelope icon, full width), text **"Not now"**. Same copy on `changed`.

### revealed (success), `-m` 390 and `-d` 1440 (title 48px on desktop, 36px on mobile)
- Centred block: `UwAvatar kind="profile" size="80"` (initials KB), small label **"You're buying for"**, name **"Kemi Bello"** (Bona Nova 400, 36px mobile or 48px desktop, white on a dark panel).
- Facts (dl): **"Spend"** "₦15,000 to ₦25,000"; **"Gifts exchanged"** "Sat 19 Dec"; then **"Times are in your time zone (WAT)."**
- Section h2 **"Most wanted"**, then up to 2 rows on the board (`UwListItem kind="item"`, chevron): "Noise-cancelling earbuds" / "₦22,000 · Most wanted" and "Ankara laptop sleeve, 14 inch" / "₦12,500 · Most wanted". Sub lines carry price and priority only (no note). Each row is a link: the first goes to the item sheet board (`Exchange-Wishlist-item`), the second to the list. Plan says Most wanted rows are links, which matches. No badges on these rows.
- Line **"Only you can see this. Kemi never will."**
- Pinned bottom buttons (full width): primary **"View their wishlist"** (no icon, goes to S16), text **"Hide again"** (goes to Exchange-Detail-hidden).
- Close X at top goes to Exchange-Detail-revealed.

### empty (revealed, no items)
Same as revealed, but under "Most wanted" a paragraph **"They haven't added anything yet. We'll show their list here as soon as Kemi adds to it."** replaces the rows. "View their wishlist" still shows and goes to the S16 empty board.

### opening, error, offline
Boards exist (`Exchange-Reveal-opening`, `-error`, `-offline`) and belong to slice 10. Not read in detail.

---

## S14 Exchange detail, after the draw (`Exchange-Detail-*`)

### revealed ("After you reveal"), the board named in the plan
- Header: exchange avatar, h1 **"Office Secret Santa"**, **"Names are drawn. Gifts on Sat 19 Dec."**, **"Organised by Ifeoma Nwosu · Everyone spends ₦15,000 to ₦25,000"**.
- **Your part** section, two rows:
  1. `UwListItem kind="item"` **"Your list for this exchange"**, sub **"From “My Christmas wishlist”. 6 items. Only your giver can see them."**, chevron, goes to S11 list-attached board (`Joining-Attach-drawnlist`).
  2. `UwListItem kind="person"` (initials tag KB) **"Kemi Bello"**, sub **"Who you're buying for"**, chevron, goes to S16.
- Then Dates ("Join by", "Names drawn", "Gifts exchanged", "Times are in your time zone (WAT)."), People (6), "From Ifeoma" note card, **"Leave exchange…"** destructive text button.
- **ActionCard (`UwCard kind="action" source="exchange" dismiss="false"`):**
  - title **"You're buying for Kemi."**
  - sub **"Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec."**
  - CTA **"View their wishlist"**, `ctaVariant="primary"`, no icon, goes to S16.
  - **`dismiss="false"`: the card has no dismiss control on the board.**
  - Mobile: card sits in an `<aside aria-label="Needs you">` pinned above the tab bar (12px side padding, hint height 170px). Desktop: card is the first child of the 1040px wrapper, above the back button, full width of that wrapper (hint height 96px), `layout="desktop"`.

### drawn (not revealed)
Your part row 2: item **"Who you're buying for"**, sub **"Hidden until you reveal it."**, chevron to Reveal. Card: title **"Names are drawn for Office Secret Santa."**, sub **"See who you're buying for. Only you will see it."**, CTA **"Reveal who you got"** (brand, envelope), goes to Reveal. Row 1 is the same list row.

### hidden ("Hidden on this device")
Your part row 2: item **"Hidden on this device"**, sub **"Who you're buying for"**, trailing = link **"Show"** (`linkHref` = Exchange-Detail-revealed, i.e. straight to the revealed state, not to Reveal). **No ActionCard.** Everything else as revealed.

### changed
Row 2: **"Who you're buying for"**, sub **"Your person has changed. Hidden until you reveal it."**; card **"Your person has changed."** / **"See who you're buying for now. Only you will see it."** / "Reveal who you got". (Slice 14.)

### passed ("Gifts exchanged, closing soon")
Header line **"Gifts were exchanged on Sat 19 Dec."**; a block h2 **"Gifts were exchanged on Sat 19 Dec"** and body **"This exchange closes on Sat 26 Dec. Until then you can still open their wishlist."** Your part still shows the list row and the person row (**"Kemi Bello"**, "Who you're buying for", chevron to S16). No ActionCard.

### complete (slice 15)
Person row is **"Tobi Ojo"**, sub **"You bought for Tobi"**, no chevron and no link. List row **"Your list for this exchange"**, sub **"From “My Christmas wishlist”. 6 items."** Read-only. Out of scope.

### Not on any board
- The Exchanges list rows (Exchanges-active etc.) have no revealed card. The only "buying for" text there is a sub line on the first-run row (**"9:00 am · See who you're buying for"**).
- Revealed with **no list attached** (the Your part list row copy after the draw). There is no S14 board for it. GC-010 gives the row copy "Add your wishlist / Your giver has nothing to go on yet." but no board shows where it appears.
- Revealed with the list being an ideas list or a list kept from a deleted wishlist (row subline).

---

## S11 Attach wishlist, after the draw (`Joining-Attach-*`)

### drawn (no list)
- Back (to Exchange-Detail-revealed), exchange avatar, h1 **"Tell your giver what you'd like"**, body **"Your giver will see the list you pick as soon as you attach it."**
- `UwAlert privacy` **"Only your giver can see it. Nobody else in the exchange can."**
- Buttons (full width): primary **"Choose a wishlist"**, secondary **"Add items instead"**. **No Skip.**

### drawnlist (list attached)
- h1 **"Your list for this exchange"**, body **"6 items. Only your giver can see them."**
- `UwListItem kind="wishlist"` title **"My Christmas wishlist"**, sub **"From “My Christmas wishlist”. Changes when you edit that list."**, trailing none (not a link).
- `UwAlert privacy` **"Only your giver can see it. Nobody else in the exchange can."**
- Destructive text button **"Remove wishlist…"**.
- No list items are shown on the page (only the list row).

### remove (confirm)
- Drawnlist page behind a scrim. Mobile `UwSheet kind="destructive"`, desktop `UwModal kind="destructive"`:
  - title **"Remove your wishlist from Church choir Kris Kringle?"**
  - body **"Your giver won't see it any more. The list stays in your Wishlists, and you can attach it again later."**
  - CTA (destructive) **"Remove wishlist"**, cancel **"Keep it"**.

### removed
The "drawn (no list)" page, with a toast `UwToast kind="undo"` **"Wishlist removed from Church choir Kris Kringle."** and action **"Undo"** (goes back to drawnlist). The draw-stage copy and buttons are the same as `drawn`.

### Not on any board
- Attach after the draw in progress, success, or failure (no "Wishlist attached. Your giver can see it now." toast board; the `Joining-Attach-attaching`, `-picker`, `-error` boards are pre-draw and are shared by name only).
- Ideas after the draw (the `Joining-Attach-ideas` board is pre-draw: its privacy line says **"Only your giver will see it, and only after names are drawn."**, which is wrong after the draw).
- A list kept from a deleted wishlist (no Remove button, with the reason). No board.
- Remove for an ideas list.
- Remove failed, offline, busy.
- Note: exchange names differ across boards (S11 boards use "Church choir Kris Kringle", S14 boards use "Office Secret Santa"). This is mock-up inconsistency, not a requirement.

---

## What I could not find or read
- No local snapshots exist; everything above comes from the published files. I read S16 default, empty, nolist, error, loading, offline, marked, removed (mobile; desktop default and item); S17 item, itemgot, itembusy, itemoffline, nolink, copied (mobile; desktop item); S15 revealed (m and d), empty, before, changed; S14 revealed (m and d), drawn, hidden, changed, passed, complete (mobile); S11 drawn, drawnlist, remove, removed (mobile; remove desktop). I did not open every desktop twin of every board, but the file sizes and the two desktop pairs I read match the mobile ones apart from layout.
- I did not render the boards, so visual details (colours, the Updated and Over budget chip styling, exact icon) come from component props, not from a screenshot. The row badge "Updated" and "You got this" use the same `trailing="date"` chip; "Over budget" uses `trailing="urgent"`.
- Boards that do not exist: `/recipient` Hidden on this device, attach-after-draw success and ideas after the draw, taken-off unmark control, Over/Under budget sheet copy, no-price row, revealed card on the Exchanges rows, revealed with no list attached.

## Conflicts or gaps vs the plan (`docs/tasks/slice-11.md`) and the stories (GC-015, GC-010)

1. **The revealed ActionCard is not dismissible.** The board has `dismiss="false"`. The plan's Q4 says "dismissible per item 120 with the key `recipient:<assignment id>`". A dismiss control has no design; either follow the board (no dismiss) or ask the owner.
2. **Hint line wording.** Board S16 and S17: **"Only you can see what you mark. Kemi never will."** Plan AC-10 and the GC-015 story Content: "Only you can see this. {name} never will." The board for the reveal page uses the story wording ("Only you can see this. Kemi never will."). So the list and sheet use a different line from the story. Per CLAUDE.md the document wins on conflict, and the boards are also source; two source documents differ, so ask.
3. **Budget note wording.** Board: **"Within the ₦15,000 to ₦25,000 budget."** (the range, not a single figure). Plan and story: "Within / Over / Under the {budget} budget." The Over and Under texts have no board, and "Under" has no design at all. The board also shows the range, so "Under the ₦15,000 to ₦25,000 budget" needs a decision. Over budget is also not shown as a sheet note in any board.
4. **"Over budget" placement.** Story: "Over budget under the price". Board: a trailing badge on the right of the row (and nothing under the price). Follow the board, update the story.
5. **Loading state shows the recipient's name.** Board S16 loading shows "Kemi's wishlist" and the intro line above the skeleton rows. The plan (AC-9, slice-10 AC-12) says the name is never in server HTML and the page loads by Server Action after mount. A server-rendered loading page cannot show the name, so the loading header must be neutral (no board for that) or the name must be client-rendered after the first load. Needs a decision.
6. **"Show" on the hidden row goes straight to the revealed state.** Board `Exchange-Detail-hidden`: Show links to Exchange-Detail-revealed, not to Reveal. The plan's Q3 says "Show (to /reveal)". There is also no board of `/recipient` while hidden.
7. **No-wishlist copy.** Board: h2 "Kemi hasn't added a wishlist yet" (no full stop) plus **"Ifeoma can send a reminder. Until then, the budget is your best guide."** Plan AC-10 and story: "{first} hasn't added a wishlist yet." (with a full stop). The body names the organiser and implies reminders; CLAUDE.md says never promise something that is not built, and nudges are the organiser's tool (slice 8), so this may be fine, but it also reveals the organiser's name to a giver (already shown on the exchange page). Check with the owner.
8. **Taken-off note.** The board exists (grey block above the count row, text "Kemi took “Noise-cancelling earbuds” off the list after you marked it. You can still unmark it."), so it is no longer "copy needing approval" for the wording. But the board shows no way to unmark the item (no row, no button). The plan's AC-7 needs one. Also the text says "Kemi took ... off", which is wrong for the plan's Q6 case (the recipient removed the whole list, or the list was deleted).
9. **Updated badge versus other badges.** One trailing slot per row. A row that is both Updated (or You got this) and Over budget has no design. The plan must pick a priority (assumed: You got this, then Over budget, then Updated; not specified).
10. **Revealed card copy.** Board gives the title "You're buying for Kemi." and sub "Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec." with CTA "View their wishlist". The plan lists the "revealed-card sub line" as copy needing approval; it now has a board. The board has no variant for a no-budget exchange.
11. **ActionCard width.** On desktop the card fills the `max-width: 1040px` wrapper, above the 760px column (hint height 96px). On mobile it is in a pinned `<aside aria-label="Needs you">` above the tab bar. The card is absent in hidden, passed, complete, and in S16.
12. **Passed state.** Board `passed` shows no ActionCard, but the Your part person row still links to the list. It supports plan Q5 (list open during event_passed). Marks during event_passed have no design (assumed allowed).
13. **Item sheet dismissal.** No close X and no Close button on the main item sheet (Open the shop, I got this, Copy link). Only the No-link variant has "Close". Dismissal (scrim, Escape, drag) is unspecified.
14. **Ideas and kept lists after the draw have no board.** Remove wishlist is shown only for an attached wishlist. GC-010 says a kept list cannot be removed and ideas can be added only when nothing is attached; the plan's Q7 (ideas removed item by item) has no board. The Joining-Attach-ideas privacy line ("only after names are drawn") is pre-draw copy.
15. **Attach-after-draw success toast** ("Wishlist attached. Your giver can see it now.") has no board. The story and plan give the string.
16. **Your part list row with no list after the draw.** GC-010 says "Add your wishlist / Your giver has nothing to go on yet."; no S14 board shows a revealed or drawn page with no list. Plan Q9 (Reveal card wins) agrees with the drawn board, which shows only the Reveal card, but the row copy is unverified.
17. **Intro line uses the full name** ("Kemi Bello"); the plan's `open_recipient_list` returns "name" and avatar, so the full name is available. The story says "{first name}" for the no-list state ("{first name} hasn't added...") and "{name}" in the hint; boards use first name "Kemi" there. Matches "Kemi".
18. **Count row** "N items" (the number drops to 5 in the taken-off board; so the count excludes taken-off items).
19. **Reveal Most wanted rows.** Board rows carry price and priority only, no note, and no badges; rows link to the item sheet. Row 1 goes to the item sheet and row 2 to the list on the board, which is a mock-up shortcut; plan says both rows link (assumed to the item sheet).
20. **Error state** on S16 has no mark-failed error (the plan's "mark-failed" copy); the board has one load error: "We couldn't load Kemi's wishlist. Nothing you marked is lost." That string is not in the plan's AC-10 and is new copy to add to the approved list.
21. **Offline sheet copy** "You're offline, so marking is off for now. The shop link still works." and the offline alert are not in the plan's strings; note that offline marking is disabled while Open the shop and Copy link stay on.
