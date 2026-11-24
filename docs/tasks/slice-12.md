# Slice 12 — Scheduled jobs

Task ID: slice-12
Stories: GCO-011 (scheduled draw and its blocked state), GC-026 (reminders), GCO-015 (automatic completion). Linked: GC-007, GC-010, GC-011, GC-013, GCO-006, GCO-007, GCO-013.
Designs: S14 (organiser blocked state, participant view while blocked), Email-Inventory (reminder and blocked emails), Activity-default (reminder and complete rows), S44 (reminder toggles), Joining-In-skipped / -noreminders, Exchanges "Complete" row. The planner could not read any board; see docs/tasks/slice-12-boards.md when it exists.
Plan ref: implementation-plan.md slice 12 (`tick()` via `pg_cron`; reminder dedupe from the outbox)

---

## Planner — round 1 — 2026-11-24
- Task: slice-12 — Scheduled jobs: tick() via pg_cron (scheduled draw, blocked state, reminders, auto-complete)
- Requirements: GCO-011, GC-026, GCO-015; GC-007, GC-010, GC-011, GC-013, GCO-006, GCO-007; plan §5, §6 (invariants 9, 11, 12), §7, §8, §10; items 77, 88, 113, 119
- Files/components: migrations draw_and_reveal, email_outbox, exclusions; send-emails and _shared/emails; features/account, exchange-list, exchanges, draw; tests 200, 220, 130, 140 plus new 370 to 400
- Work completed: read CLAUDE.md, stories, plan, progress, email-sender, slice-10 and slice-11 logs and board spec, migrations, templates and feature code (verified). Boards not read.
- Outstanding issues: Q1 to Q12; live board read; dev cron risk
- Next action: main session takes Q1 to Q12 to the owner and has the boards read live; the builder then starts at step 1

### Status: NEEDS CLARIFICATION

### What the code already gives
- The "scheduled draw" is `draw_mode = 'at_join_by'`, where `draw_at = join_by_at`.
- `draw_names` uses `auth.uid()`, so `tick()` cannot call it.
- `draw_blocked_reason` is free text, and members can read it (column grant and `exchanges_visible`).
- `email_outbox` has no `for_at` or `kind` column, although plan §5 lists both.
- No cron job exists in the migrations. `send-emails` runs every minute from an owner-made `pg_cron` + `pg_net` job with a Vault secret.
- No reminder template, no blocked template, and no reminder toggles in the UI. Members already get "Not available" once a state is past `drawn`.

### Scope
**In:** `private.tick()` (scheduled draw, blocked state, reminders, auto-complete); reminder and blocked templates in `send-emails`; the two reminder toggles plus "Reminders also show in Activity." on `/profile/notifications`; Activity rows for the new kinds; the organiser's "Names couldn't be drawn" block ("Draw names now…" hidden while blocked); the reminder promise lines on GC-011 and GC-010 (items 77 and 88), only when the type is on.

**Out:** re-draw at a reopened join-by, re-match, assignment, Leave (slice 14); changing join-by or draw time (slice 13); Mark as complete, the complete and event-passed pages, the never-drawn block, cancel (slice 15); Home "All caught up" (item 56); web push; hints.

### Database objects (each needs owner approval, Q1)
1. `private.run_draw(exchange)`: the body of `draw_names` with no `auth.uid()`. Returns a status (`drawn`, `already`, `few`, `exclusions`, `closed`, `cancelled`) instead of raising. One engine call, no retry; inserts only if the answer is complete.
2. `draw_names` replaced in a new migration, calling `run_draw`. Errcodes and hints unchanged, so 310 must pass unedited.
3. `private.tick()`: definer, `search_path = ''`, `statement_timeout` about 50s. Execute revoked from public, anon, authenticated and service_role. `pg_try_advisory_xact_lock`, returns at once if another run holds it. Locks each exchange `for update skip locked`. Bounded per run (for example 20 draws, 500 reminders, 100 completions), oldest first; catch-up over later runs. Each exchange in its own exception block that logs the exchange id only.
4. A check that `draw_blocked_reason` is in ('few', 'exclusions').
5. `email_outbox.for_at` (the plan's column) and new template codes.
6. Activity kinds `join_by_reminder`, `event_reminder`, `exchange_completed`.
7. `claim_due_emails` dropped and recreated with the dates for the new templates; it also cancels reminder rows no longer needed.
8. Indexes on `join_by_at` and `gift_day` (plan §7).
9. The cron job `cron.schedule('unwrap-tick','* * * * *','select private.tick()')` (Q2).

### Rules
- **Scheduled draw.** Fires when `at_join_by`, the state is exactly `joining_closed`, `draw_round = 0` and `draw_blocked_reason` is null. If infeasible or fewer than 3 people: sets the reason and queues one blocked email to the organiser (dedupe key `blocked:{ex}:{join-by epoch}`). Never retries the engine. Slice 13's date edit clears the reason so the next tick tries again. Never draws after the gift day (the never-drawn case is slice 15).
- **Join-by reminder.** Due between join-by minus 24h and join-by, while open. To active members taking part with no list (`member_has_list`) who joined at least 24h before join-by, with the toggle on. Dedupe `joinby:{ex}:{user}:{epoch}`. Skipped when a sent row for the same person and exchange has a later `for_at`.
- **Event reminder.** Due from 9:00 the day before the gift day in the recipient's zone (`user_settings.timezone`, then `organiser_tz`, then Lagos) until the gift day starts there. To members taking part with the toggle on. Same dedupe scheme. DST handled by `AT TIME ZONE`.
- **Auto-complete.** At or after `(gift_day + 8)::timestamp at time zone organiser_tz`, the exchange was drawn, not cancelled or completed: sets `completed_at` and writes one Activity event per active member. No email. Existing state checks then refuse marks and recipient reads (invariant 12).
- **Pair secrecy.** Templates carry the exchange id only. Members never learn the blocked reason, because "exclusions" reveals that exclusions exist (invariant 11).

### Steps (security tests first; CI runs them)
1. New tests 370 (tick access, cron command), 380 (scheduled draw, blocked, double run, manual draw still works), 390 (reminders, two time zones, toggles, catch-up, dedupe, later date), 400 (auto-complete). Approved edits to 200, 220, 140 and 130.
2. Write the migration.
3. The owner applies it, checks drift, regenerates types.
4. Email templates and their tests.
5. UI: toggles, Activity rows, blocked block, promise lines.
6. E2E without real draws.
7. Owner deploys the function, then schedules the cron job.

### Acceptance criteria
- AC-1: anon, authenticated and service_role get 42501 on `tick` and `run_draw`.
- AC-2: running `tick` twice, or two at once, writes nothing more.
- AC-3: a due scheduled draw makes n rows with no self and no excluded pair, plus E19, E21, events, closed requests and cancelled E10, exactly as a manual draw does.
- AC-4: fewer than 3 people or impossible exclusions: no rows, the reason is set, one email, no second attempt.
- AC-5: never drawn in `organiser_chooses`, open, cancelled, drawn or event-passed exchanges.
- AC-6: reminder recipients, windows, toggles and dedupe follow the rules above.
- AC-7: no reminder after the draw, cancel, completion or once the date has passed.
- AC-8: completion happens only at the boundary and only for drawn exchanges.
- AC-9: no outbox row, event or claim column names a pair. Members cannot read the blocked reason.
- AC-10: every date in an email shows in the recipient's zone. The gift day shows as stored.
- AC-11: content strings exactly as written in GC-026.

### Risks
- The cron job on dev would draw, remind and complete real dev exchanges at once, and those draws cannot be undone.
- Templates queued before the function is redeployed fail as `unknown_template` and give up after five tries.
- Completed rows move to Past but open "Not available" until slice 15.
- Participants see a past "Names are drawn on {date}" while the draw is blocked.

### Boards not read (to be read live before building)
The S14 organiser blocked state (Exchange-Detail-o*, Part 2 canvas), the participant view while blocked, Email-Inventory and the reminder and blocked emails, the Activity-default reminder and complete rows, S44 with the reminder toggles, Joining-In-skipped and -noreminders, and the Exchanges "Complete" row.

### Questions for the owner (planner's recommendation first)
- **Q1.** Approve schema items 1 to 9. Recommendation: yes.
- **Q2.** Should the migration schedule the cron job? Recommendation: no. The owner schedules it after deploying, and after a read-only preview of what the first run would do on dev.
- **Q3.** What happens once the blocked cause is fixed? Recommendation: show "Draw names now…" again for a manual draw; the date edit retries the scheduled draw in slice 13.
- **Q4.** Is the blocked email always sent, or under a toggle (it is in neither GC-026 list)? Recommendation: always sent, no Activity event (GC-007 does not list one).
- **Q5.** Hide the blocked reason from members (drop it from the view, add an organiser-only function)? Recommendation: yes.
- **Q6.** What should participants see while the draw is blocked? Recommendation: needs a board or approved copy; until then, nothing dated.
- **Q7.** Event reminder for an exchange that was never drawn? Recommendation: drawn only.
- **Q8.** Write the reminder Activity event when the email toggle is off? Recommendation: only with a queued email, so the outbox dedupe covers it; otherwise approve an `activity_events.dedupe_key`.
- **Q9.** Build auto-complete now, given that Past rows open "Not available" until slice 15? Recommendation: yes, and log it as an open item.
- **Q10.** Template numbers and copy? Recommendation: from Email-Inventory; anything with no board goes to copy-pending.
- **Q11.** Build the GC-011 and GC-010 reminder lines now? Recommendation: yes.
- **Q12.** Activity copy for the three new kinds? Recommendation: board, otherwise copy-pending.

### Status: APPROVED — building (database first)

### Owner answers — 2026-11-24

All twelve questions accepted as the planner recommended:
- **Q1**: Schema approved (`private.run_draw`, `draw_names` calling it, `private.tick()`, check on `draw_blocked_reason`, `email_outbox.for_at` and new template codes, activity kinds `join_by_reminder`, `event_reminder`, `exchange_completed`, changed `claim_due_emails`, indexes on `join_by_at` and `gift_day`).
- **Q2**: The migration does NOT schedule the cron job. The owner schedules it after deploying the function and after a read-only preview of what the first run would do on dev.
- **Q3**: Once the blocked cause is fixed, "Draw names now…" shows again for a manual draw; the date edit retries the scheduled draw in slice 13.
- **Q4**: The blocked email is always sent; no Activity event.
- **Q5**: The blocked reason is hidden from members (organiser-only read).
- **Q6**: Participants see nothing dated while the draw is blocked, until a board or approved copy exists.
- **Q7**: The event reminder goes to drawn exchanges only.
- **Q8**: A reminder Activity event is written only with a queued email.
- **Q9**: Auto-complete is built now; Past rows open "Not available" until slice 15 (open item).
- **Q10**: Template numbers and copy come from the boards; anything without a board goes to copy-pending.
- **Q11**: The GC-011 and GC-010 reminder promise lines are built now, shown only when the type is on.
- **Q12**: Activity copy for the three new kinds from the boards, otherwise copy-pending.

### Board decisions — 2026-11-24

Boards read from the live canvas by an agent: see docs/tasks/slice-12-boards.md (blocked is E15, join-by reminder E23, event reminder E24; there is no complete email). Not yet compared by eye.

**Owner decided (4 conflicts):**
- **B1 (blocked card)**: keep "Draw names now…" visible; drop the board's "Or we draw them on {date}." sub and "We'll try again then", which are false until slice 13 can retry. Changed wording goes to copy-pending.
- **B2 (exclusions cause)**: the same blocked card with wording for impossible pairs and an "Edit exclusions" link to the existing Exclusions page; members still see nothing. New wording goes to copy-pending.
- **B3 (E23 skip rule)**: NOT added. The plan's reminder rules stand; the inventory's "skip if nudged within 12 hours" is not built.
- **B4 (E15 on S44)**: the notification settings "Always sent" line also mentions the could-not-draw email. New wording goes to copy-pending.

**Main session notes (follow the board, flag the gap):**
- The board shows auto-complete as gift day + 7 ("closes by itself on Thu 31 Dec"). The plan's boundary `(gift_day + 8)::timestamp at time zone organiser_tz` is midnight at the end of gift day + 7, so the UI date shows gift day + 7.
- E23 and E24 bodies carry a zone label ("6:00 pm WAT"); the sender needs the recipient's zone abbreviation.
- Reminder and complete Activity copy, the participant view while blocked, and the Reveal variant of E24 have no board: copy-pending, and nothing dated for participants while blocked (Q6).
