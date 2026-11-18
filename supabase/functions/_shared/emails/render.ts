import { budgetText, formatGiftDay, formatMoment } from "./dates.ts";
import { firstName, oneLine } from "./escape.ts";
import { renderHtml, renderText, type EmailContent } from "./layout.ts";
import { exchangeLink, inviteLink, notificationsLink, participantsLink } from "./links.ts";
import type { RenderedEmail, RenderInput } from "./types.ts";

// The five emails slice 7 sends, from boards Email-E06, -E07, -E08, -E09 and -E12 (canvas "Unwrap").
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
