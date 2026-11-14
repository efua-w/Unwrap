import type { TimelineStep } from "@/components/ui/Timeline";
import { JOIN_COPY, firstName } from "@/features/joining/copy";
import { itemCountLabel } from "@/features/wishlists/copy";
import { formatDayTime, formatYmdDay } from "@/lib/dates/format";
import { ideaCountLabel, sourceSubline } from "./copy";
import type { ExchangeListContext, MyExchangeList } from "./types";

// GC-011 / S12 You're in. Boards: Joining-In-attached, -ideas, -skipped, -noreminders (m, d). The
// "How we'll tell you" section and "Share the invite link" are left out (owner decisions Q7, Q8,
// 2026-11-13): no reminder or email promise until slices 7 and 12 build them, and the invite token
// stays organiser-only. Pure: the page passes the viewer's zone.

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

// The list status row, by source (GC-011). A missing list says when to add one by; the board's email
// sentence is left out (Q8). `joinDay` is the last day to join in the viewer's zone.
export function listStatus(list: MyExchangeList, joinDay: string): ListStatus {
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
      return { missing: true, title: JOINED_COPY.noList, sub: `Add one before ${joinDay}.`, below: null };
  }
}
