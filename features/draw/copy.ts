// UI copy for the draw (GCO-011), Names drawn (GCO-012) and Reveal (GC-014). Sources: boards Org-Draw-default, -busy,
// -error, -offline, -excl, -few, -fewtwo, -just; Org-Drawn-part, -just, -justexchange; Exchange-Detail-odrawn, -drawn,
// -revealed, -hidden, -nolist; Exchange-Reveal-before, -opening, -revealed, -empty, -error, -offline; Exchanges-active;
// Activity-default (canvas "Unwrap" and Part 2). Lines marked "pending" are not on a board and are listed in
// docs/copy-pending.md for approval (owner Q11, 2026-11-22).

import { waitingNames } from "@/features/participants/format";

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

export const DRAW_COPY = {
  // Organiser tools row (boards Exchange-Detail-obefore, Org-Draw-few, -fewtwo).
  rowTitle: "Draw names now…",
  rowSubAuto: (day: string, time: string) => `Or we draw them on ${day} at ${time}.`,
  // pending: no board for "When I choose" while joining is open.
  rowSubManual: "Draw them when you're ready.",
  rowSubFew: (more: number) => `Needs 3 people. ${more} more to go.`,

  // The confirm sheet (boards Org-Draw-default, -just).
  sheetTitle: (exchange: string) => `Draw names for ${exchange}?`,
  // Board: "{n} people are taking part and {k} wishlists are in. {names} haven't added one, so their givers will have less to go on. This can't be undone."
  bodyMissing: (n: number, inCount: number, missing: readonly string[]) => {
    const one = missing.length === 1;
    return `${people(n)} ${n === 1 ? "is" : "are"} taking part and ${inCount} ${inCount === 1 ? "wishlist is" : "wishlists are"} in. ${waitingNames(missing)} ${
      one ? "hasn't" : "haven't"
    } added one, so ${one ? "their giver" : "their givers"} will have less to go on. This can't be undone.`;
  },
  // pending: the board shows only the "some are missing" body.
  bodyAllIn: (n: number) => `${people(n)} are taking part and every wishlist is in. This can't be undone.`,
  bodyPlain: (n: number) => `${people(n)} are taking part. This can't be undone.`,
  noteOnePair: (a: string, b: string) => `Exclusions: ${a} and ${b} won't draw each other.`,
  // pending: the board shows one pair only.
  noteManyPairs: (n: number) => `Exclusions: ${n} pairs won't draw each other.`,
  privacy: "You won't see who got whom. Nobody will.",
  draw: "Draw names",
  editExclusions: "Edit exclusions",
  notYet: "Not yet",
  busyBody: "Drawing names. This takes a moment, and tapping again won't draw twice.",
  errorNote: "The draw was interrupted before it finished. No names were drawn, so it's safe to try again.",
  tryAgain: "Try again",
  offlineNote: "You're offline. You can do this once you're back online.",
  // pending: no board for the exchange ending or being cancelled at the moment of the draw.
  endedNote: "This exchange has ended, so names can't be drawn.",
  // Board Org-Draw-excl.
  exclTitle: "Names can't be drawn fairly yet",
  exclBody: (pairs: number, n: number) =>
    `With ${pairs} exclusion ${pairs === 1 ? "pair" : "pairs"} among ${n} people, there's no way to give everyone a person. Remove a pair or invite more people, then try again.`,
  exclCta: "Edit exclusions",
  notNow: "Not now",
  // Boards Org-Draw-few, -fewtwo.
  fewTitle: "Not enough people yet",
  fewNobody: (exchange: string, day: string | null) =>
    `Names need at least 3 people to draw. Nobody has joined ${exchange} yet.${
      day ? ` Share the invite link and people can join until ${day}.` : ""
    }`,
  // pending: no board for just organising with one or two others, or for the organiser alone while taking part.
  fewSome: (names: readonly string[], more: number, day: string | null) =>
    `Names need at least 3 people to draw. ${waitingNames(names)} ${names.length === 1 ? "is" : "are"} in, so ${more} more ${
      more === 1 ? "person needs" : "people need"
    } to join.${day ? ` People can join until ${day}.` : ""}`,
  // Board Org-Draw-fewtwo: "You and Ifeoma are in, so 1 more person needs to join."
  fewWithYou: (others: readonly string[], more: number, day: string | null) =>
    `Names need at least 3 people to draw. ${others.length === 0 ? "Only you are" : `You and ${waitingNames(others)} are`} in, so ${more} more ${
      more === 1 ? "person needs" : "people need"
    } to join.${day ? ` People can join until ${day}.` : ""}`,
  fewShare: "Share the invite link",
  fewInvite: "Invite people",
  close: "Close",

  // Names drawn page (boards Org-Drawn-part, -just; Q3 wording).
  drawnTitle: "Names are drawn",
  drawnBody: "Everyone has someone to buy for. We emailed them to open Unwrap and see who they got.",
  // pending: when not everyone has Names are drawn emails on (Q3).
  drawnBodyPartial:
    "Everyone has someone to buy for. We emailed the people who have these emails on, so they can open Unwrap and see who they got.",
  toldLabel: "Everyone told",
  toldValue: (told: number, n: number) => `${told} of ${n} people, by email`,
  giftsLabel: "Gifts exchanged",
  zoneLine: (zone: string) => `Times are in your time zone (${zone}).`,
  drawnPrivacy: "Nobody can see who got whom, not even you.",
  revealCta: "Reveal who you got",
  backToExchange: "Back to exchange",
  closeLabel: "Close",

  // Exchange page after the draw (boards Exchange-Detail-odrawn, -drawn, Org-Drawn-justexchange).
  headerDrawn: (gift: string) => `Names are drawn. Gifts on ${gift}.`,
  drawnSection: "Names drawn",
  // Board: "...and all 8 people were told by email." Q3 pending: "{told} of {n}" when some were not.
  drawnSentence: (told: number, n: number) =>
    `Everyone has someone to buy for, and ${told === n ? `all ${n}` : `${told} of ${n}`} people were told by email. Nobody can see who got whom, not even you.`,
  organiserTakingPart: "You organise this and you're taking part",
  justOrganisingLine: "You're just organising",
  justOrganisingBody: "You're just organising. You won't be drawn, and nobody buys for you.",
  yourNote: "Your note to everyone",
  buyingTitle: "Who you're buying for",
  buyingHidden: "Hidden until you reveal it.",
  hiddenTitle: "Hidden on this device",
  hiddenShow: "Show",
  // Action cards (boards Exchange-Detail-drawn, Exchanges-active, Exchange-Detail-nolist).
  cardTitle: (exchange: string) => `Names are drawn for ${exchange}.`,
  cardSub: "See who you're buying for. Only you will see it.",
  cardListTitle: "Add your wishlist",
  cardListSub: (when: string) => `Your giver has nothing to go on yet. ${when}`,
  cardListWhenDay: (day: string) => `Names are drawn on ${day}.`,
  // pending: the manual variant of the line above.
  cardListWhenManual: (organiserFirst: string) => `Names are drawn when ${organiserFirst} is ready.`,
  // Accessible name of the ActionCard region (screen-reader text only; the board has no visible label).
  needsYou: "Needs you",
  // pending: no board shows the close control's name (owner request 2026-11-23).
  dismissCard: "Dismiss",
  // Exchanges rows.
  rowDrawn: (gift: string) => `Names are drawn. Gifts on ${gift}.`,
  rowCardTitle: (exchange: string) => `Names are drawn for ${exchange}`,
  rowCardSub: "Only you will see who you got",
  closedRequest: (organiserFirst: string) => `Names were drawn before ${organiserFirst} could let you in.`,
  dismiss: "Dismiss",
  dismissLabel: (exchange: string) => `Dismiss ${exchange}`,
  // pending: no board shows a failed Dismiss.
  dismissFailed: "We couldn't dismiss that. Try again.",
  // Activity.
  activityDrawn: (exchange: string) => `Names are drawn for ${exchange}.`,
  activitySub: (time: string) => `${time} · See who you're buying for`,

  // Reveal (boards Exchange-Reveal-*).
  waiting: "Someone is waiting for your gift.",
  untying: "Untying the ribbon…",
  checkTitle: "Make sure no one's looking",
  checkBody: "Your person's name shows on the next screen. Check nobody can see your screen first.",
  checkPrivacy: "Only you will see who you got. The organiser can't see it either.",
  reveal: "Reveal who you got",
  notNowReveal: "Not now",
  revealError: "We couldn't open it just now. Nothing was revealed, so you can try again.",
  revealOffline: "You need a connection to reveal who you got.",
  buyingFor: "You're buying for",
  spend: "Spend",
  mostWanted: "Most wanted",
  mostWantedSub: (price: string | null) => (price ? `${price} · Most wanted` : "Most wanted"),
  mostWantedEmpty: (first: string) => `They haven't added anything yet. We'll show their list here as soon as ${first} adds to it.`,
  // pending: no board for a recipient with no wishlist.
  noList: (first: string) => `${first} hasn't added a wishlist yet.`,
  onlyYou: (first: string) => `Only you can see this. ${first} never will.`,
  hideAgain: "Hide again",
  // Board Exchange-Reveal-revealed: the primary button above Hide again.
  viewList: "View their wishlist",
  loadingRecipient: "Opening your person's name",
} as const;
