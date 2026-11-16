// UI copy for the invite preview (S02), the join confirmation (S10), Invite unavailable (S13) and Ask to join.
// Boards: Entry-Invite-*, Entry-Signup/Login/Verify-invite, Joining-Confirm-*, Joining-Unavailable-*
// (the boards decide where they differ from the story, owner decision Q9, 2026-11-13). Lines not on a
// board or in a story are marked "pending" and listed in docs/copy-pending.md. Names go in single
// quotes inside a sentence (owner decision Q9).

import { firstName } from "@/features/shared-wishlist/copy";
import type { UnavailableKind } from "./types";

export { firstName };

export const INVITE_COPY = {
  pageTitle: "You're invited to an exchange on Unwrap",
  invitedYou: (inviter: string) => `${inviter} invited you`,
  budget: "Budget",
  joinBy: "Join by",
  namesDrawn: "Names drawn",
  giftDay: "Gift day",
  giftsExchanged: "Gifts exchanged",
  zoneLine: (zone: string) => `Times are in your time zone (${zone}).`,
  how: {
    title: "How it works",
    // Board lines; the story's one-sentence explainer is superseded by the board (Q9).
    join: "Join and add a wishlist so your giver has ideas.",
    drawn: (day: string) => `On ${day} we draw names for everyone.`,
    reveal: "You find out who you are buying for. Only you.",
  },
  privacy: (organiserFirstName: string) => `Nobody sees who got whom, not even ${organiserFirstName}.`,
  join: "Join this exchange",
  haveAccount: "I already have an account",
  banner: (exchange: string) => `You're joining ${exchange}`,
  loading: "Loading the invite",
} as const;

// "5 people have joined so far." The count is hidden at 0 (owner decision Q5); the board's own line
// for that state is shown instead. "1 person has joined so far." is pending (no board, no story).
export function joinedCountLine(joinedCount: number): string {
  if (joinedCount <= 0) return "You'd be one of the first to join.";
  if (joinedCount === 1) return "1 person has joined so far.";
  return `${joinedCount} people have joined so far.`;
}

export const JOIN_COPY = {
  organisedBy: (name: string) => `Organised by ${name}`,
  whosIn: (count: number) => `Who's in (${count})`,
  // "Ngozi Eze, Femi Adeyemi and Bisi Lawal." No "(organising)" suffix (owner 2026-11-16).
  peopleLine: (people: ReadonlyArray<{ name: string }>): string => {
    const labels = people.map((p) => p.name);
    if (labels.length <= 1) return `${labels.join("")}.`;
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}.`;
  },
  stackLabel: (people: ReadonlyArray<{ name: string }>) => {
    const count = people.length;
    const named = JOIN_COPY.peopleLine(people).replace(/\.$/, "");
    return `${count} ${count === 1 ? "person is" : "people are"} in: ${named}`;
  },
  onlyOrganiser: (organiserFirstName: string) => `Only ${organiserFirstName} so far. You'd be one of the first to join.`,
  // Pending: the board shows only the automatic draw; this is the organiser-draws variant (Q13).
  drawWhenReady: (organiserFirstName: string) => `When ${organiserFirstName} is ready`,
  from: (organiserFirstName: string) => `From ${organiserFirstName}`,
  agreeing: {
    title: "What you're agreeing to",
    wishlist: "Add a wishlist, or a few ideas, so your giver has something to go on.",
    buy: (budget: string) => `Buy one gift for the person you draw, within ${budget}.`,
    bring: "Bring your gift on the day.",
    // Part 1 board Joining-Confirm-*: the organiser can see your address (owner decision 2026-11-15).
    email: (organiserFirstName: string) => `${organiserFirstName}, the organiser, can see your email address.`,
  },
  joiningAs: "Joining as",
  join: "Join exchange",
  notNow: "Not now",
  failed: (exchange: string) => `We couldn't add you to ${exchange}. Nothing has changed, so you can try again.`,
  tryAgain: "Try again",
  loading: "Loading the invite",
} as const;

export const UNAVAILABLE_COPY = {
  title: "This invite can't be used",
  goToUnwrap: "Go to Unwrap",
  incorrect: "We couldn't find an exchange for this link. Check you copied all of it, or ask for it again.",
  // Board: "{Organiser} closed joining for {exchange} on {day}." The second board line is REQUEST_COPY.stillAsk.
  closed: (who: string, exchange: string, day: string | null) =>
    day ? `${who} closed joining for ${exchange} on ${day}.` : `${who} closed joining for ${exchange}.`,
  cancelled: (who: string, exchange: string, day: string | null) =>
    day ? `${who} cancelled ${exchange} on ${day}.` : `${who} cancelled ${exchange}.`,
  // Approved (no board, no story): full.
  full: (exchange: string) => `${exchange} has reached its limit of 100 people.`,
} as const;

// Ask to join (GC-012, slice 6). Boards: Joining-Confirm-approval / -requested, Joining-Unavailable-closed /
// -asking / -error / -pending / -sent. Lines marked "drafted" have no board once the email and Home
// promises are dropped (owner decision Q6); they are listed in docs/copy-pending.md.
export const REQUEST_COPY = {
  ask: "Ask to join",
  // Board.
  approvalLine: (organiser: string) => `${organiser} approves everyone who joins, so this sends a request. Nobody else is told.`,
  // Board.
  stillAsk: (organiser: string) => `You can still ask to be let in. ${organiser} decides.`,
  // Board.
  failed: "We couldn't send your request. Nothing was sent, so you can try again.",
  tryAgain: "Try again",
  // Board heading; the body is the board line without its email sentence.
  alreadyAsked: "You've already asked",
  pending: (exchange: string, organiser: string) => `Your request to join ${exchange} is waiting for ${organiser}.`,
  // Board labels.
  sent: "Request sent",
  waitingFor: (organiser: string) => `Waiting for ${organiser}`,
  // Drafted: the board body promises an email and a Home row, neither built (Q6).
  sentBody: (organiser: string) => `${organiser} has your request and will let you in.`,
  // Drafted: the board says "Go to Home"; the button goes to Exchanges (Q6).
  goToExchanges: "Go to Exchanges",
  // Drafted: a removed person on the link (owner decision Q5); no names of anyone in the exchange.
  removed: (exchange: string) =>
    `You can't join ${exchange} with this link. You can ask to be let in.`,
} as const;

export type UnavailableFacts = {
  /** The organiser's display name, when the preview could be read. */
  who: string | null;
  exchangeName: string | null;
  /** The day joining closed or the exchange was cancelled, in the viewer's zone. */
  day: string | null;
};

// WHY a missing name or exchange falls back to the incorrect line: the facts come from the preview,
// and without them there is nothing true to say about this particular exchange.
export function unavailableBody(kind: UnavailableKind, facts: UnavailableFacts): string {
  const { who, exchangeName, day } = facts;
  if (kind === "incorrect" || !who || !exchangeName) return UNAVAILABLE_COPY.incorrect;
  const exchange = `'${exchangeName}'`;
  switch (kind) {
    case "closed":
      return UNAVAILABLE_COPY.closed(firstName(who), exchange, day);
    case "cancelled":
      return UNAVAILABLE_COPY.cancelled(firstName(who), exchange, day);
    case "full":
      return UNAVAILABLE_COPY.full(exchange);
  }
}
