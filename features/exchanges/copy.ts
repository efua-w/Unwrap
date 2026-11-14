// UI copy for Start exchange, the exchange page and Exchanges (slice 4). Sources: boards S26 Org-Basics-*,
// S27 Org-Budget-*, S28 Org-Review-*, S47 Acc-NA-exchange, S14 Exchange-Detail-*, S08 Exchanges-*, and
// the owner decisions of 2026-11-09 (docs/tasks/slice-4.md). Lines marked "pending" are not on a
// board or in a story and are listed in docs/copy-pending.md for approval.

import type { RadioOption } from "@/components/ui/RadioGroup";
import type { ErrorCode, FieldKey } from "@/lib/validation/exchange";

export const EXCHANGE_COPY = {
  flow: {
    eyebrow: (step: 1 | 2 | 3) => `Start an exchange · Step ${step} of 3`,
    close: "Close",
    next: "Next",
    back: "Back",
    start: "Start exchange",
    basics: {
      title: "Name your exchange",
      intro: "You can change any of this later.",
      nameLabel: "Name",
      namePlaceholder: "For example, Office Secret Santa",
      nameHelper: "This is what people see in the invite.",
      noteLabel: "Note for everyone (optional)",
      notePlaceholder: "Where you're swapping, any house rules",
    },
    dates: {
      title: "Budget and dates",
      intro: "Fewer dates is easier for everyone. Names are drawn when joining closes, unless you choose otherwise.",
      budgetLegend: "Budget per gift",
      joinBy: "Join by",
      giftDay: "Gift day",
      drawLegend: "When are names drawn?",
      drawAuto: "When joining closes",
      drawManual: "When I choose",
      drawTime: "Draw time",
      drawTimeHelper: "Joining closes at this time on the join-by day.",
      summaryLabel: "Summary",
      zoneLine: (zone: string) => `Times are in your time zone (${zone}).`,
    },
    rules: {
      title: "Rules and review",
      partLegend: "Are you taking part?",
      joinLegend: "Who can join?",
      checkTitle: "Check everything",
      name: "Name",
      note: "Note",
      budget: "Budget",
      joinBy: "Join by",
      namesDrawn: "Names drawn",
      gifts: "Gifts exchanged",
      editDetails: "Edit details",
      editDates: "Edit budget and dates",
      nothingSent: "Nothing is sent until you tap Start exchange.",
      // pending: the Review line for "When I choose" (joining closes at the end of the join-by day).
      endOfDay: (day: string) => `End of ${day}`,
      // Owner decision 2026-11-09 (item 10): "When you're ready" in the Review for "When I choose".
      whenReady: "When you're ready",
    },
    // S28 Org-Review-error: inputs are kept, so Start exchange is the retry.
    failed: "We couldn't start the exchange. Everything you entered is still here, so you can try again.",
    discard: {
      title: "Discard this exchange?",
      body: "You've started filling it in. If you close now, nothing is saved and nobody is invited.",
      cta: "Discard",
      cancel: "Keep going",
    },
  },
  summary: {
    thatEvening: "that evening",
    // pending: for draw times before 5 pm, where "that evening" would be wrong.
    thatDay: "that day",
    // The gift day is a date only (owner decision 2026-11-09): no gift time in either sentence.
    automatic: (join: string, when: string, drawTime: string, gift: string) =>
      `People can join until ${join}. We draw names ${when} at ${drawTime}. Gifts are exchanged on ${gift}.`,
    // pending: derived from the automatic sentence for "When I choose" (docs/copy-pending.md).
    manual: (join: string, gift: string) =>
      `People can join until the end of ${join}. You draw names when you're ready. Gifts are exchanged on ${gift}.`,
  },
  detail: {
    back: "Back to Exchanges",
    onlyYou: "Only you so far.",
    spends: (budget: string) => `Everyone spends ${budget}`,
    inviteTitle: "Share the invite link",
    // Board Exchange-Detail-oclosed (owner request 2026-11-14). The board's second body sentence and its
    // "Edit exchange" action wait for the edit feature (copy-pending).
    closedMeta: "Joining has closed",
    closedTitle: "The join-by date has passed",
    closedBody: "The invite link no longer works, so this exchange can't be shared.",
    inviteBody: (day: string) => `People can join until ${day}. Names need at least 3 people to draw.`,
    inviteLinkLabel: "Invite link",
    nextTitle: "What happens next",
    stepJoin: "People join",
    stepJoinAnyone: (day: string) => `Anyone with the link can join until ${day}.`,
    // pending: the "I approve each person" wording of the first step.
    stepJoinApproval: (day: string) => `People ask to join and you approve each one, until ${day}.`,
    stepDraw: "Names are drawn",
    drawWhenReady: "When you're ready.",
    stepGifts: "Gifts are exchanged",
    // Owner follow-up 2026-11-09 (decision 3).
    zoneLine: (zone: string) => `Times are in your time zone (${zone}).`,
    yourPart: "Your part",
    justOrganising: "You're just organising.",
    people: "People",
    peopleCount: (n: number) => `People (${n})`,
    organisedBy: (name: string) => `Organised by ${name}`,
    namesDrawnOn: (day: string) => `Names are drawn on ${day}.`,
    // pending: the organiser-draws variants of the lines around it (no board).
    namesDrawnWhenReady: (first: string) => `Names are drawn when ${first} is ready.`,
    allSetTitle: "You're all set",
    allSetBody: (when: string) => `Names are drawn on ${when}. We'll tell you who you're buying for. Only you will see it.`,
    allSetBodyManual: "We'll tell you who you're buying for. Only you will see it.",
    datesTitle: "Dates",
    joinByLabel: "Join by",
    namesDrawnLabel: "Names drawn",
    giftsLabel: "Gifts exchanged",
    // Your part rows (boards Exchange-Detail-before/-nolist/-oattached/-oideas/-ostarted).
    yourListTitle: "Your list for this exchange",
    listNoneParticipant: "Nothing yet. Your giver has nothing to go on.",
    listNoneOrganiser: "Nothing yet. Add one so your giver has ideas.",
    buyingTitle: "Who you're buying for",
    buyingSub: (when: string) => `You'll find out on ${when}.`,
    buyingSubManual: "You'll find out when names are drawn.",
    fromOrganiser: (first: string) => `From ${first}`,
    // Organiser tools (boards Exchange-Detail-oattached, Org-Invite-*).
    toolsTitle: "Organiser tools",
    toolInvite: "Invite people",
    toolInviteSub: (day: string) => `People can join until ${day}.`,
    inviteSheetBody: (day: string) => `People can join until ${day}.`,
    done: "Done",
    resetLink: "Reset link…",
    resetTitle: "Reset the invite link?",
    resetBody:
      "The old link stops working straight away. Anyone who hasn't joined yet needs the new one. People already in aren't affected.",
    resetConfirm: "Reset link",
    resetKeep: "Keep link",
    resetToast: "Link reset. The old link no longer works.",
    // pending: failure and refusal of Reset link (no board).
    resetFailed: "We couldn't reset the link. Nothing has changed, so you can try again.",
    resetOffline: "You're offline. You can reset the link once you're back online.",
    resetClosed: "This exchange has ended, so its link can't be reset.",
    peopleOnlyYou: "Only you so far. People show here as they join.",
    // S47 Acc-NA-exchange.
    notAvailableTitle: "This exchange isn't available to you",
    notAvailableBody: "It may have been cancelled, or the link you followed is old. Nothing you added has been lost.",
    notAvailableCta: "Back to Home",
    // Owner decision 2026-11-09 (item 10).
    loadError: "We couldn't load this exchange. Nothing has changed.",
    loadingLabel: "Loading the exchange",
    // pending: the WhatsApp message for an invite (GCO-004 gives none).
    whatsAppMessage: (name: string, link: string) => `Join "${name}" on Unwrap: ${link}`,
  },
  list: {
    title: "Exchanges",
    tabsLabel: "Show exchanges",
    active: "Active",
    past: "Past",
    start: "Start an exchange",
    blockMeta: "Only you so far",
    blockHeadline: "Share the invite link",
    blockAction: "Share invite link",
    blockBody: (day: string, time: string) => `Share the invite link so people can join by ${day}. Names are drawn at ${time} that day.`,
    // pending: the Exchanges block body when the organiser draws names themselves.
    blockBodyManual: (day: string) => `Share the invite link so people can join by ${day}. You draw names when you're ready.`,
    rowOnlyYouTaking: "You created this. Only you so far.",
    rowOnlyYouOrganising: "You're just organising. Only you so far.",
    // Header line of the organiser's page once people have joined (owner Q14, 2026-11-13).
    rowPeople: (n: number) => `${n} people in.`,
    // Boards Exchanges-joined / Exchanges-active. "You joined today." is the board; the rest are pending
    // variants of it (docs/copy-pending.md).
    rowJoinedToday: (when: string) => `You joined today. ${when}`,
    rowJoined: (when: string) => `You're in. ${when}`,
    rowCreated: (n: number, when: string) => `You created this. ${n} ${n === 1 ? "person" : "people"} in. ${when}`,
    rowJustOrganisingPeople: (n: number, when: string) => `You're just organising. ${n} ${n === 1 ? "person" : "people"} in. ${when}`,
    rowNamesDrawn: (day: string) => `Names are drawn ${day}.`,
    rowNamesDrawnManualMember: "Names are drawn when the organiser is ready.",
    rowNamesDrawnManualOrganiser: "You draw names when you're ready.",
    pastEmpty: "Nothing here yet. Finished exchanges will move here.",
    inviteHelp: "Got an invite? Open the link you were sent and you'll land in that exchange.",
    // Owner decision 2026-11-09 (item 10), until slice 6 adds Activity.
    loadError: "We couldn't load your exchanges. Your wishlists still work.",
  },
} as const;

export const DRAW_MODE_OPTIONS = [
  { value: "at_join_by", label: EXCHANGE_COPY.flow.dates.drawAuto },
  { value: "organiser_chooses", label: EXCHANGE_COPY.flow.dates.drawManual },
] as const;

export const TAKING_PART_OPTIONS: readonly RadioOption<"yes" | "no">[] = [
  { value: "yes", label: "Yes, I'm in", hint: "You'll be drawn and buy a gift too." },
  { value: "no", label: "No, just organising", hint: "You run it, but nobody buys for you." },
];

export const WHO_CAN_JOIN_OPTIONS: readonly RadioOption<"anyone" | "approve">[] = [
  { value: "anyone", label: "Anyone with the link", hint: "People join straight away." },
  { value: "approve", label: "I approve each person", hint: "You decide before anyone gets in." },
];

// The line shown under a field, by the code the validators return. Lines for "missing" dates and
// times, and the note limit, are pending copy (no board).
export function errorLine(field: FieldKey, code: ErrorCode): string {
  switch (code) {
    case "join-not-before-gift":
      return "Join by has to be before the gift day.";
    case "join-past":
      return "Join by has to be in the future.";
    case "gift-past":
      return "The gift day has to be in the future.";
    case "too-long":
      return "The note can be at most 280 characters.";
    case "missing":
      switch (field) {
        case "name":
          return "Add a name so people know which exchange this is.";
        case "budget":
          return "Pick a budget so everyone spends about the same.";
        case "drawTime":
          return "Choose a time.";
        default:
          return "Choose a date.";
      }
  }
}
