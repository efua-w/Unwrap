import type { TimelineStep } from "@/components/ui/Timeline";
import { JOIN_COPY, firstName } from "@/features/joining/copy";
import { itemCountLabel } from "@/features/wishlists/copy";
import type { NotificationSettings } from "@/features/account/notifications";
import { ACTIVITY_COPY } from "@/features/activity/copy";
import { formatDayTime, formatYmdDay } from "@/lib/dates/format";
import { ideaCountLabel, sourceSubline } from "./copy";
import type { ExchangeListContext, MyExchangeList } from "./types";

// GC-011 / S12 You're in. Boards: Joining-In-attached, -ideas, -skipped, -noreminders (m, d). "Share the invite link" is left
// out (owner decision Q7, 2026-11-13): the invite token stays organiser-only. The "How we'll tell you" section was left out until
// the emails existed (Q8); slice 12 adds it, and each promise shows only while that email type is on for the viewer (items 77, 88).
// Pure: the page passes the viewer's zone and settings.

export const JOINED_COPY = {
  title: "You're in",
  nothingElse: "There's nothing else to do until names are drawn.",
  next: "What happens next",
  stepDraw: "Names are drawn",
  drawNote: "We'll show you who you're buying for. Only you will see it.",
  stepGifts: "Gifts are exchanged",
  giftsNote: "Bring your gift on the day.",
  zoneLine: (zone: string) => `Times are in your time zone (${zone}).`,
  listHeading: "Your list for this exchange",
  noList: "No list yet",
  addWishlist: "Add a wishlist",
  editable: "You can change it until names are drawn.",
  goToExchange: "Go to exchange",
  close: "Close",
} as const;

// Boards Joining-In-attached, -skipped, -noreminders (slice 12). "the day before" is the board's wording.
export const HOW_COPY = {
  title: "How we'll tell you",
  namesDrawn: "An email when names are drawn.",
  joinBy: "A reminder the day before joining closes, if you still have no list.",
  event: "A reminder the day before gifts are exchanged.",
  allOff: "You've turned these emails off, so updates show in Activity only.",
  chooseEmails: ACTIVITY_COPY.chooseEmails,
  skippedSub: (day: string) => `Add one before ${day}. We'll email you the day before.`,
} as const;

/**
 * The "How we'll tell you" lines for this viewer, or null for no section. WHY each line follows its toggle (GC-011, GC-026): we
 * never promise an email the person turned off. WHY the join-by line only with no list: that reminder goes only to people with
 * no list. WHY null for unreadable settings: with no answer there is no promise to make.
 */
export function howWeTellYou(settings: NotificationSettings | null, listMissing: boolean): string[] | null {
  if (!settings) return null;
  const lines: string[] = [];
  if (settings.namesDrawn) lines.push(HOW_COPY.namesDrawn);
  if (settings.joinByReminder && listMissing) lines.push(HOW_COPY.joinBy);
  if (settings.eventReminder) lines.push(HOW_COPY.event);
  if (!settings.namesDrawn && !settings.joinByReminder && !settings.eventReminder) return [HOW_COPY.allOff];
  return lines.length > 0 ? lines : null;
}

export function joinedLine(exchangeName: string): string {
  return `You joined ${exchangeName}. ${JOINED_COPY.nothingElse}`;
}

// WHY draw-mode aware: an organiser-draws exchange has no draw time, so step 1 names who will draw.
export function joinedSteps(exchange: ExchangeListContext, timeZone: string): TimelineStep[] {
  const manual = exchange.drawMode === "organiser_chooses" || exchange.drawAt === null;
  const drawDetail = manual
    ? JOIN_COPY.drawWhenReady(exchange.organiserName ? firstName(exchange.organiserName) : "the organiser")
    : formatDayTime(new Date(exchange.drawAt as string), timeZone);
  return [
    { title: JOINED_COPY.stepDraw, detail: drawDetail, note: JOINED_COPY.drawNote },
    // WHY the stored date, no zone: the gift day is a date only (owner decision 2026-11-09, Q2).
    { title: JOINED_COPY.stepGifts, detail: formatYmdDay(exchange.giftDay) ?? "", note: JOINED_COPY.giftsNote },
  ];
}

export type ListStatus = {
  missing: boolean;
  title: string;
  sub: string;
  /** The line under the row, or null. */
  below: string | null;
};

// The list status row, by source (GC-011). A missing list says when to add one by, and adds the board's email sentence only when
// the join-by reminder is on. `joinDay` is the last day to join in the viewer's zone.
export function listStatus(list: MyExchangeList, joinDay: string, joinByReminder = false): ListStatus {
  const sub = sourceSubline(list.source, list.name);
  switch (list.source) {
    case "wishlist":
      return {
        missing: false,
        title: list.name ?? JOINED_COPY.listHeading,
        sub: sub ?? "",
        below: `${itemCountLabel(list.itemCount)}. ${JOINED_COPY.editable}`,
      };
    case "ideas":
      return { missing: false, title: ideaCountLabel(list.itemCount), sub: sub ?? "", below: JOINED_COPY.editable };
    case "kept":
      return {
        missing: false,
        title: list.name ?? JOINED_COPY.listHeading,
        sub: sub ?? "",
        below: `${itemCountLabel(list.itemCount)}. Your giver will see them after the draw.`,
      };
    case "none":
      // WHY the email sentence only with the toggle on (GC-011 edge case): it promises the join-by reminder.
      return {
        missing: true,
        title: JOINED_COPY.noList,
        sub: joinByReminder ? HOW_COPY.skippedSub(joinDay) : `Add one before ${joinDay}.`,
        below: null,
      };
  }
}
