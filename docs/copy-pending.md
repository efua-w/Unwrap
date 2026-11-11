# Copy awaiting approval

UI copy that isn't in a story's Content section. It is used only once approved. Add new lines here instead of scattering unapproved copy through the code (CLAUDE.md "Before coding a slice", rule 5).

| Copy | Where | Source | Status |
|---|---|---|---|
| "Create list" | New wishlist main button (GC-019, S20) | Design canvas | Awaiting approval |
| "Send nudge" | Nudge confirmation main button (GCO-008, S32) | Design canvas | Awaiting approval |
| "Reopen joining" | Reopen joining main button (GCO-007, S38) | Design canvas | Awaiting approval |
| "Keep list" | Delete wishlist cancel button (GC-019, GC-030, S24) | Design canvas | Awaiting approval |
| "Back" | Back button accessible name (Header) | Not in stories | Awaiting approval |
| "Main" | Navigation landmark name | Not in stories | Awaiting approval |
| "Profile and settings" | Profile link accessible name (Header) | Not in stories | Awaiting approval |
| "{Tab}, {n} unread" | Activity tab accessible name when there are unread items | Plan GC-006 C | Awaiting approval |
| "9+" | Count chip above 9 | Board 12 | Awaiting approval |
| "Skip to content" | Skip link in the root layout | Not in stories | Awaiting approval |
| "Something went wrong on our side." | Error alert (with "Try again") on Sign up, Log in, Verify code and Profile setup when the service fails in a way no design covers (slice 1) | Adapted from GC-018 ("Something went wrong on our side.") | Awaiting approval |
| "We've sent a few codes already. Wait a few minutes, then try again." | Alert on Log in (no S04 frame for too many codes) and on Verify code when a resend is refused | Design S03 "too many codes" line, reused on two more screens | Awaiting approval |
| "That email looks incomplete. Check the part after the @." | Also shown for an empty email on Sign up and Log in (the board shows only an incomplete address) | Design S03/S04 line, reused for the empty case | Awaiting approval |
| "Profile" | Back-header title on the minimal Profile page (slice 1) | GC-024 story title; S42 not read | Awaiting approval |
| "Log out" | Log out button on the minimal Profile page (slice 1) | GC-024 In scope ("Log out"); no Content line | Awaiting approval |
| "Try again" | Link in the error Alerts on Sign up, Log in, Verify code and Profile setup | GC-029 Content ("Try again"), same label as the offline banner | Awaiting approval |
| "Something went wrong on our side." | Also inside the New wishlist / Edit list, Add an item / Edit item and Delete list sheets when the server fails (slice 2) | Same line as the slice 1 row above, reused | Approved 2026-11-08 (Tobechukwu Olih) |
| "Couldn't save your change." + "Retry" | When a bin remove fails, and when Undo of a deleted list fails (slice 2). Nothing is put back in either case | GC-020 Content, without "so we put it back" | Approved 2026-11-08 (Tobechukwu Olih) |
| "Couldn't save your change, so we put it back." + "Retry" | Only where something really is put back: a failed Undo of an item removal sends the row away again (slice 2) | GC-020 Content | Approved (GC-020 Content) |
| "Things that tend to land well: a gadget you've had your eye on, or a voucher for a place you love." | Empty-list prompt on every list (slice 2) | Board Wishlist-Detail-newempty, reworded by the owner (drops "something for the new space" and the link-import sentence) | Approved 2026-11-08 (Tobechukwu Olih) |
| "Your giver will know exactly what you'd like, so you get something you'll use. Only you can see it until you share it or add it to an exchange." | First-time panel body on My wishlists (slice 2) | Board Wishlist-List-first, as written ("until you share it": nothing is live before slice 3) | Approved 2026-11-08 (Tobechukwu Olih) |
| "That's over ₦1,000,000,000. Enter a smaller amount." | Price over the limit (GC-021) | Owner 2026-11-05 | Approved 2026-11-05 |
| "Check the link. It should start with https://" | Bad link (GC-021) | Owner 2026-11-05 | Approved 2026-11-05 |
| "We couldn't load this list." + "Something went wrong on our side. Nothing you've added is lost." | Wishlist detail load error (GC-020) | Owner 2026-11-05 | Approved 2026-11-05 |
| "Remove {item}" | Bin button accessible name (GC-020) | Owner 2026-11-05 | Approved 2026-11-05 |
| "1 item" | Singular item count (GC-018, GC-020) | Owner 2026-11-05 | Approved 2026-11-05 |
| Share “{list}” / "It's private, so there's no link yet. Getting one lets anyone with the link see it. Your givers keep seeing it either way." / "Who can see it" / "Saving…" / "Get a shareable link" / "Your link" / "Share to WhatsApp" / "Copy link" / "Done" / "Link copied. Paste it anywhere to share." | Share sheet (GC-022, S23) | Boards Wishlist-Detail-share*; GC-022 Content | Approved 2026-11-08 (Tobechukwu Olih) |
| Here's my wishlist, "{list name}", on Unwrap. Take a look: {link} | WhatsApp message (GC-022) | GC-022 Content | Approved (story) |
| "Share" | Button on Wishlist detail (GC-020, GC-022) | Boards Wishlist-Detail-default / -bday | Approved 2026-11-08 (Tobechukwu Olih) |
| "Couldn't save your change." + "Retry" | Share sheet when saving who can see the list fails (slice 3) | Owner answer; GC-020 wording | Approved 2026-11-08 (Tobechukwu Olih) |
| "{Two to Ten} things {first name} would love." / "One thing {first name} would love." / digits above ten | Public wishlist intro (GC-023, S25) | Board + owner answers (number words 2 to 10) | Approved 2026-11-08; second sentence dropped on the updated board, approved 2026-11-09 (Tobechukwu Olih) |
| "{first name} hasn't added anything yet." / "Check back closer to the date. We'll show items here as soon as {first name} adds them." / "This wishlist isn't available" / "Its owner may have made it private. Ask them to send you the link again." / "Make a wishlist of your own" / "What is Unwrap?" | Public wishlist empty and unavailable states, header (GC-023, S25) | Boards Wishlist-Shared-*; GC-023 Content | Approved 2026-11-08 (Tobechukwu Olih) |
| "A wishlist on Unwrap" | Page title and link preview of every shared wishlist (GC-023) | Owner answer (generic, no list contents) | Approved 2026-11-08 (Tobechukwu Olih) |
| "Privacy" / "Changes save as you make them." / "Default for new wishlists" / "Only you, until you share it." / "People you send the link to can see it." | Privacy page and the "Privacy" row on Profile (GC-027, S45) | Boards Acc-Privacy-* | Approved 2026-11-08 (Tobechukwu Olih) |
| "Saved. New wishlists start as Anyone with the link." / "Saved. New wishlists start as Private." / "We couldn't save your default, so it's still Private. Try again." / "...still Anyone with the link. Try again." | Privacy default toasts and error (GC-027) | Board + owner answers for the Private outcomes | Approved 2026-11-08 (Tobechukwu Olih) |
| "We couldn't load your privacy settings." + "Something went wrong on our side. Nothing you've added is lost." | Privacy page when the setting cannot be read (slice 3) | Same pattern as the wishlist load errors; no board | Awaiting approval |
| Every line of S26 Basics, S27 Budget and dates, S28 Rules and review (titles, labels, helpers, errors, summary, review labels, Discard sheet, failure alert), S14 just-started page, S08 Exchanges and S47 Not available | Slice 4 screens (GCO-001..004, GC-008, GC-013, GC-029) | Boards Org-Basics-*, Org-Budget-*, Org-Review-*, Exchange-Detail-*, Exchanges-*, Acc-NA-exchange (exact), plus the owner decisions of 2026-11-09: budget labels with "to", Review "When you're ready", the two "has to be in the future" lines, the two load errors, the time zone line | Approved 2026-11-09 (Tobechukwu Olih, "Accept all slice 4 recommendations") |
| "Choose a date." / "Choose a time." | Under Join by, Gift day and Draw time when left empty (S27). Gift time removed 2026-11-09 (Tobechukwu Olih): the gift day is a date only | Board placeholders ("Choose a date", "Choose a time"); the boards show no error line for an empty date | Approved 2026-11-09 (Tobechukwu Olih) |
| "The note can be at most 280 characters." | Under the note field (S26). The field stops typing at 280, so this shows only if the server refuses | Not on a board | Approved 2026-11-09 (Tobechukwu Olih) |
| "We draw names that day at {time}." (draw times before 5:00 pm; the board's "that evening" is kept from 5:00 pm) | Budget and dates summary (GCO-002) | Board example draws at 6:00 pm; "that evening" would be wrong for a 9:00 am draw | Approved 2026-11-09 (Tobechukwu Olih) |
| "Here's how it runs: people can join until the end of {join day}. You draw names when you're ready. Gifts are exchanged on {gift day}." | Budget and dates summary when the draw mode is "When I choose" (GCO-002) | Derived from the board's automatic sentence (no gift time); the board shows no manual variant | Approved 2026-11-11 (Tobechukwu Olih) |
| "End of {Fri 4 Dec}" | Review: Join by, when the organiser draws names (S28) | Follows the summary's "until the end of {day}" | Approved 2026-11-09 (Tobechukwu Olih) |
| "People ask to join and you approve each one, until {Fri 4 Dec}." | What happens next, step 1, when "I approve each person" is chosen (S14) | Board shows only the open-link wording | Approved 2026-11-09 (Tobechukwu Olih) |
| "You're taking part. You'll be drawn and buy a gift too." | Your part on the just-started page when the organiser takes part (S14) | Board shows only "You're just organising."; the sentence reuses the Review hint | Approved 2026-11-09 (Tobechukwu Olih) |
| "Share the invite link so people can join by {Fri 4 Dec}. You draw names when you're ready." | Exchanges "Only you so far" block when the organiser draws names (S08) | Board shows only the automatic-draw sentence | Approved 2026-11-09 (Tobechukwu Olih) |
| "You're just organising. Only you so far." / "{N} people in." | Exchanges row sublines: organiser not taking part with nobody else in; an exchange with other people in it (S08) | Board rows: "You created this. Only you so far." and "You're just organising. 4 people in. Names are drawn Fri 4 Dec."; slice 5 replaces the second | Approved 2026-11-09 (Tobechukwu Olih) |
| Join "{exchange}" on Unwrap: {link} | WhatsApp message for the invite link (GCO-004) | GCO-004 gives none; modelled on the wishlist message (GC-022) | Approved 2026-11-09 (Tobechukwu Olih) |
