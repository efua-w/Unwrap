// UI copy for Participants (S30, S31), the request blocks (GCO-006) and the invite sheet's approval lines.
// Sources: boards Org-People-*, Org-Remove-*, Exchange-Detail-obefore, Org-Invite-default (Part 2 folder wins)
// and the owner decisions of 2026-11-14 (docs/tasks/slice-6.md, Q13, Q14, Q16). Lines marked "pending" are
// not on a board or in a story and are listed in docs/copy-pending.md for approval.

export const PARTICIPANTS_COPY = {
  back: "Back",
  title: "Participants",
  subtitle: (exchange: string, n: number) => `${exchange} · ${n} ${n === 1 ? "person" : "people"} taking part`,
  subtitleAlone: (exchange: string) => `${exchange} · Only you so far`,
  wantsTitle: (n: number) => `Wants to join (${n})`,
  askedToday: (time: string) => `Today at ${time}`,
  // pending: the board only shows today; an earlier day reads "{day}, {time}".
  askedOn: (day: string, time: string) => `${day}, ${time}`,
  approve: "Approve",
  decline: "Decline",
  // Boards Org-People-*: the people split by wishlist (owner 2026-11-16). No Nudge until a later slice.
  needTitle: (n: number) => `Still need a wishlist (${n})`,
  readyTitle: (n: number) => `Ready (${n})`,
  hasWishlist: "Wishlist added",
  noWishlist: "No wishlist yet",
  // Board fewapproved: shown until the page is reloaded.
  joinedJustNow: "Joined just now",
  sep: " · ",
  you: "(you)",
  remove: "Remove…",
  privacy: "Nobody can see who drew whom, not even you.",
  inviteMore: "Invite more people",
  aloneTitle: "Nobody has joined yet",
  aloneBody: (day: string) => `Names need at least 3 people to draw. Share the invite link so people can join by ${day}.`,
  // pending: the alone card once joining has closed (no link to share).
  aloneBodyClosed: "Names need at least 3 people to draw.",
  aloneAction: "Invite people",
  // Boards Org-People-few and -fewreq. The 1-person line is on the boards; the plural title and body are pending.
  fewTitle: (n: number) => (n === 1 ? "1 more person needed" : `${n} more people needed`),
  fewBody: (day: string) => `Names need at least 3 people to draw. People can join until ${day}.`,
  fewBodyClosed: "Names need at least 3 people to draw.",
  fewReqBody: (first: string, day: string) => `Approve ${first} and you'll have the 3 people needed to draw. People can join until ${day}.`,
  fewReqBodyClosed: (first: string) => `Approve ${first}.`,
  // S31 Org-Remove-before / -busy / -done. The board's email sentence is back with E12 (slice 7, owner Q8/Q14).
  removeTitle: (first: string, exchange: string) => `Remove ${first} from ${exchange}?`,
  // Board Org-Remove-before, exact. WHY the address (organiser only, GCO-007): the organiser already reads it on
  // this page, and it says where the removal email goes. pending: the variant for a person with no address.
  removeBody: (first: string, email: string | null) =>
    `${first} gets a short email ${email ? `at ${email} ` : ""}saying they're no longer in it. It doesn't give a reason or say who removed them. Their wishlist stays theirs.`,
  removeConfirm: (first: string) => `Remove ${first}`,
  removeKeep: "Keep",
  removeOffline: "You're offline. You can remove someone once you're back online.",
  removedToast: (first: string, exchange: string) => `${first} was removed from ${exchange}.`,
  // Board Org-People approve toast; "They've been emailed." is back with E09 (slice 7, owner Q8).
  approvedToast: (first: string) => `${first} is in. They've been emailed.`,
  loadError: (exchange: string) => `We couldn't load the people in ${exchange}. Nothing has changed.`,
  // pending: the error board's subtitle when the count could not be read: the exchange's name alone.
  errorSubtitle: (exchange: string) => exchange,
  // pending: when the exchange itself could not be read, so there is no name to show.
  loadErrorUnnamed: "We couldn't load the people in this exchange. Nothing has changed.",
  // pending: failures and refusals of Approve, Decline and Remove (no board).
  failed: "We couldn't do that. Nothing has changed, so you can try again.",
  stale: "That has already been dealt with. The list is up to date now.",
  full: (exchange: string) => `${exchange} is full, so nobody else can be let in.`,
  ended: "Joining has ended for this exchange, so this can't be changed.",
  // Owner Q15 and board Acc-NA-removed.
  removedTitle: (exchange: string) => `You're no longer in ${exchange}`,
  removedBody: "Your wishlist is still yours to use.",
  removedAction: "Back to Home",
} as const;

// Request blocks (board Exchange-Detail-obefore; owner Q16 drafted the variants after join-by and for several).
export const REQUEST_BLOCK_COPY = {
  meta: "Needs you now",
  one: (name: string) => `${name} wants to join.`,
  oneBody: (first: string, day: string) => `Approve or decline ${first}'s request. People can join until ${day}.`,
  // pending: once the join-by day has passed, the "until" sentence would be wrong.
  oneBodyClosed: (first: string, day: string) => `Approve or decline ${first}'s request. Joining closed on ${day}.`,
  many: (n: number) => `${n} people want to join.`,
  // pending: body of the several-requests block (the story gives "{A, B and C} are waiting for you to approve or decline them. …").
  manyBody: (names: string, day: string) => `${names} are waiting for you to approve or decline them. People can join until ${day}.`,
  manyBodyClosed: (names: string, day: string) => `${names} are waiting for you to approve or decline them. Joining closed on ${day}.`,
  reviewOne: "Review request",
  reviewMany: (n: number) => `Review ${n} requests`,
} as const;

// Invite people sheet on an approval exchange (board Org-Invite-default).
export const INVITE_APPROVAL_COPY = {
  approval: "You approve each person before they're in.",
  waitingOne: (first: string) => `${first} is waiting for you to let them in.`,
  // pending: the waiting note for several people.
  waitingMany: (n: number) => `${n} people are waiting for you to let them in.`,
} as const;
