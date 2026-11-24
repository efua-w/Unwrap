import { budgetText, formatGiftDay, formatMoment } from "./dates.ts";
import { firstName, oneLine } from "./escape.ts";
import { renderHtml, renderText, type EmailContent } from "./layout.ts";
import { exchangeLink, inviteLink, notificationsLink, participantsLink, recipientLink, revealLink } from "./links.ts";
import type { RenderedEmail, RenderInput } from "./types.ts";

// The emails slices 7, 8, 10 and 12 send, from boards Email-E06, -E07, -E08, -E09, -E10, -E12, -E15, -E19, -E21, -E23 and -E24 (canvas "Unwrap").
// Slice 12 leaves out of E15 the board's "we'll try again" lines and its "invite one more person and move the join-by date"
// advice: neither can be done or promised until slice 13 (docs/copy-pending.md). No E15, E23 or E24 names a pair, a giver or
// a receiver: the only person in them is the reader, and E24 carries the reader's own "revealed" flag, never who they got.
// Left out, by owner decisions Q9 and the round 3 decision (2026-11-17): the draw date ("Names drawn"), auto-close,
// "Wishlists in {n} of {m}" and the E07 counts, and anything that promises the draw or a reminder. E06 shows the
// budget, join-by, gift day and the organiser's note, with moments in the recipient's zone and its label.
// No "Stop invite emails" link (Q6). Subjects and preview lines that are not on a board are listed in
// docs/copy-pending.md. WHY E09 and E12 name no organiser (GCO-007): the sender is never given one.

function greeting(name: string | null): string {
  const first = name ? firstName(name) : "";
  return first ? `Hi ${first},` : "Hi there,";
}

// The board's E06 detail rows. A row whose value is missing or unreadable is left out, never guessed.
function inviteDetails(input: RenderInput, other: string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const budget = input.budgetPreset ? budgetText(input.budgetPreset) : null;
  if (budget) rows.push({ label: "Budget per gift", value: budget });
  const joinBy = input.joinByAt ? formatMoment(input.joinByAt, input.toTimezone) : null;
  if (joinBy) rows.push({ label: "Join by", value: joinBy });
  const gift = input.giftDay ? formatGiftDay(input.giftDay) : null;
  if (gift) rows.push({ label: "Gift day", value: gift });
  const note = input.note ? input.note.trim() : "";
  if (note) rows.push({ label: other ? `A note from ${other}` : "A note from the organiser", value: note });
  return rows;
}

// The budget and gift-day rows of E19 and E21 (boards Email-E19, -E21). A missing value leaves its row out.
function drawDetails(input: RenderInput): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const budget = input.budgetPreset ? budgetText(input.budgetPreset) : null;
  if (budget) rows.push({ label: "Budget per gift", value: budget });
  const gift = input.giftDay ? formatGiftDay(input.giftDay) : null;
  if (gift) rows.push({ label: "Gift day", value: gift });
  return rows;
}

function content(input: RenderInput, base: string): EmailContent & { subject: string } {
  const exchange = oneLine(input.exchangeName);
  // WHY a fallback: other_name is null only if the person's profile is gone; the email still has to read well.
  const other = input.otherName ? firstName(input.otherName) : "";

  switch (input.template) {
    case "E06": {
      const link = inviteLink(base, input.inviteToken ?? "");
      return {
        subject: other ? `${other} invited you to ${exchange}` : `You're invited to ${exchange}`,
        preview: "Join and add a wishlist so your giver has ideas.",
        details: inviteDetails(input, other),
        heading: `You're invited to ${exchange}`,
        greeting: "Hi there,",
        paragraphs: [
          other
            ? `${other} is organising a gift exchange on Unwrap and would like you in it.`
            : "You've been invited to a gift exchange on Unwrap.",
          "Join and add a wishlist so your giver has ideas. Once names are drawn, you find out who you're buying for. Only you will see it.",
        ],
        cta: { label: "Join the exchange", url: link },
        signoff: "Happy gifting,",
        reason: other
          ? `You're getting this because ${other} invited ${input.toEmail} to an exchange on Unwrap.`
          : `You're getting this because ${input.toEmail} was invited to an exchange on Unwrap.`,
      };
    }
    case "E07":
      return {
        subject: `${other || "Someone"} joined ${exchange}`,
        preview: "You can see everyone who's in on the exchange page.",
        heading: `${other || "Someone"} is in`,
        greeting: greeting(input.toName),
        paragraphs: [
          `${other || "Someone"} just joined ${exchange}, the exchange you're organising.`,
          "There's nothing you need to do. You can see everyone who's in on the exchange page.",
        ],
        cta: { label: "See who's in", url: exchangeLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you're organising ${exchange} and asked to hear when people join.`,
        settings: { label: "Manage email settings", url: notificationsLink(base) },
      };
    case "E08":
      return {
        subject: `${other || "Someone"} wants to join ${exchange}`,
        preview: "They're waiting for you to let them in.",
        heading: `${other || "Someone"} wants to join`,
        greeting: greeting(input.toName),
        paragraphs: [
          `${other || "Someone"} asked to join ${exchange}. Because you approve each person yourself, they're waiting for you.`,
        ],
        cta: { label: "Review request", url: participantsLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you're organising ${exchange} and asked to hear when people join.`,
        settings: { label: "Manage email settings", url: notificationsLink(base) },
      };
    case "E09":
      return {
        subject: `You're in ${exchange}`,
        preview: "Add a wishlist so your giver has ideas.",
        heading: "You're in",
        greeting: greeting(input.toName),
        paragraphs: [
          `Good news: you've been let into ${exchange}.`,
          "Next, add a wishlist so whoever draws your name knows what you'd like. Only they will see it, after names are drawn.",
        ],
        cta: { label: "Add my wishlist", url: exchangeLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you asked to join ${exchange}.`,
      };
    case "E10": {
      // WHY the organiser's name and nobody else's (GCO-008): the email says who is waiting, and never who gives to whom.
      const organiser = other || "The organiser";
      const when =
        input.scheduleMode === "at_join_by" && input.scheduleAt ? formatMoment(input.scheduleAt, input.toTimezone) : null;
      return {
        subject: `${organiser} is waiting on your wishlist`,
        // pending (docs/copy-pending.md): the board's preview has the day; a manual draw has none.
        preview: when ? `Add it before names are drawn on ${when}.` : "Add it before names are drawn.",
        heading: `Add your wishlist for ${exchange}`,
        greeting: greeting(input.toName),
        paragraphs: [
          `${organiser} is waiting on your wishlist for ${exchange}. ${
            when ? `Names are drawn on ${when}.` : `Names are drawn when ${organiser} is ready.`
          }`,
          "A wishlist gives whoever draws your name a few ideas, so you get something you'll actually like. Only they will see it.",
        ],
        cta: { label: "Add my wishlist", url: exchangeLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because ${organiser} sent you a reminder in ${exchange}.`,
      };
    }
    case "E15": {
      // WHY the reason comes from the count (owner, slice 12): under 3 people is "too few", 3 or more means the pairs ruled
      // out every fair draw. The claim carries the count and nothing about who. Organiser only, always sent (Q4): no settings link.
      const when = input.joinByAt ? formatMoment(input.joinByAt, input.toTimezone) : null;
      const tried = `We tried to draw names for ${exchange}${when ? ` at ${when}` : ""}, but couldn't.`;
      const count = input.peopleCount;
      const few = count === null || count < 3;
      const cause = few
        ? count === null
          ? "Not enough people are taking part, and a draw needs at least 3."
          : count === 0
            ? "Nobody is taking part, and a draw needs at least 3 people."
            : `Only ${count} ${count === 1 ? "person is" : "people are"} taking part, and a draw needs at least 3.`
        : "With the exclusion pairs you set, there's no way to give everyone a person.";
      return {
        subject: `Names couldn't be drawn for ${exchange}`,
        // pending (docs/copy-pending.md): the board's "Fix it and we'll try again." promises a retry slice 13 builds.
        preview: "No names were drawn.",
        heading: "We couldn't draw names",
        greeting: greeting(input.toName),
        paragraphs: [
          `${tried} ${cause}`,
          // pending: the board's "To fix it: Invite at least one more person and move the join-by date, or cancel the exchange.
          // Once you do, we'll try again at the new draw time." needs slice 13 (edit date, retry) and slice 15 (cancel).
          few
            ? "Open the exchange to see where things stand."
            : "To fix it, remove a pair, then draw names yourself from the exchange page.",
        ],
        cta: { label: few ? "View exchange" : "Fix the draw", url: exchangeLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you're organising ${exchange}.`,
      };
    }
    case "E23": {
      // WHY the zone label (AC-10): the sentence names a moment, so it is written in the reader's zone with its label.
      const when = input.joinByAt ? formatMoment(input.joinByAt, input.toTimezone) : null;
      return {
        subject: "Add your wishlist before tomorrow",
        preview: `Joining for ${exchange} closes ${when ?? "soon"}.`,
        heading: "One day left to add your wishlist",
        greeting: greeting(input.toName),
        paragraphs: [
          `Joining for ${exchange} closes ${when ? `on ${when}` : "soon"}, and you haven't added a wishlist yet.`,
          "Add a few ideas so whoever draws your name knows what you'd like. It takes a minute, and only they will see it.",
        ],
        cta: { label: "Add my wishlist", url: exchangeLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you're taking part in ${exchange} and haven't added a wishlist.`,
        settings: { label: "Manage email settings", url: notificationsLink(base) },
      };
    }
    case "E24": {
      // WHY the gift day as stored (AC-10): it is a date with no time, the same for everyone. WHY two buttons (board): a person
      // who has opened who they got is sent to the wishlist, anyone else to Reveal. Neither link, line nor row names the person.
      const gift = input.giftDay ? formatGiftDay(input.giftDay) : null;
      return {
        subject: "Gifts are exchanged tomorrow",
        preview: `${exchange} is on ${gift ?? "the gift day"}.`,
        details: drawDetails(input),
        heading: "It's nearly gift day",
        greeting: greeting(input.toName),
        paragraphs: [`${exchange} is tomorrow${gift ? `, ${gift}` : ""}. Time to make sure your gift is ready.`],
        cta:
          input.revealed === true
            ? { label: "View their wishlist", url: recipientLink(base, input.exchangeId) }
            : { label: "Reveal who you got", url: revealLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you're taking part in ${exchange}.`,
        settings: { label: "Manage email settings", url: notificationsLink(base) },
      };
    }
    case "E19": {
      // WHY no name but the organiser's, and that only as "not even {organiser}" (GCO-012, board Email-E19): the email
      // never says who gives to whom. WHY a name match decides "the recipient is the organiser" (Q11): the claim
      // carries no such flag; two people with the same name only lose the words "not even {name}", which is safe.
      const organiserIsReader =
        !other || (input.toName !== null && input.otherName !== null && oneLine(input.toName) === oneLine(input.otherName));
      return {
        subject: `Names are drawn for ${exchange}`,
        preview: "Find out who you're buying for. Only you will see it.",
        details: drawDetails(input),
        heading: "Names are drawn",
        greeting: greeting(input.toName),
        paragraphs: [
          `Names have been drawn for ${exchange}. Open Unwrap to see who you're buying for. ${
            organiserIsReader ? "Only you will see it." : `Only you will see it, not even ${other}.`
          }`,
        ],
        cta: { label: "Reveal who you got", url: revealLink(base, input.exchangeId) },
        tip: "Tip: make sure nobody's looking over your shoulder.",
        signoff: "Happy gifting,",
        reason: `You're getting this because you're taking part in ${exchange}.`,
        settings: { label: "Manage email settings", url: notificationsLink(base) },
      };
    }
    case "E21": {
      // WHY no count (GCO-012, Q3): "All {n} people taking part have been told" can be false when some people have the
      // email off, and the claim carries the people count, not how many were queued. Deferred: docs/copy-pending.md.
      return {
        subject: `Names are drawn for ${exchange}`,
        preview: "Everyone has someone to buy for.",
        details: drawDetails(input),
        heading: "Names are drawn",
        greeting: greeting(input.toName),
        paragraphs: [
          `Names have been drawn for ${exchange}. Everyone taking part has someone to buy for.`,
          "Nobody can see who got whom, not even you. You don't need to do anything else unless someone leaves.",
        ],
        cta: { label: "View exchange", url: exchangeLink(base, input.exchangeId) },
        signoff: "Happy gifting,",
        reason: `You're getting this because you're organising ${exchange}.`,
        settings: { label: "Manage email settings", url: notificationsLink(base) },
      };
    }
    case "E12":
      return {
        subject: `You're no longer in ${exchange}`,
        preview: "Your wishlist is still yours to use.",
        heading: `You're no longer in ${exchange}`,
        greeting: greeting(input.toName),
        paragraphs: [
          `You've been removed from ${exchange}, so you won't get any more emails about it.`,
          "Your wishlists are still yours to use, in another exchange or on their own.",
        ],
        signoff: "All the best,",
        reason: `You're getting this because you were in ${exchange}.`,
      };
  }
}

export function renderEmail(input: RenderInput, appBaseUrl: string): RenderedEmail {
  const { subject, ...c } = content(input, appBaseUrl);
  return { subject: oneLine(subject), preview: c.preview, html: renderHtml(c), text: renderText(c) };
}
