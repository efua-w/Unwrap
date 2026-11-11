import type { TimelineStep } from "@/components/ui/Timeline";
import { formatDay, formatTime, formatYmdDay } from "@/lib/dates/format";
import { EXCHANGE_COPY } from "./copy";
import type { Schedule } from "./types";

// Sentences about when things happen (GCO-002, GCO-004, GC-013), always in the viewer's own zone
// (product rules). Pure: the page passes the zone from the cookie.

// The last day people can join, as the viewer sees it. WHY minus one millisecond for "When I
// choose": joining closes at the next local midnight, exclusive, so the instant itself belongs to the
// day AFTER the last joining day. Taking one millisecond off lands on the right day in any zone,
// including DST change days, which are not 24 hours long.
export function lastJoinDay(schedule: Schedule, timeZone: string): string {
  const closes = new Date(schedule.joinByAt);
  const lastMoment = schedule.drawMode === "organiser_chooses" ? new Date(closes.getTime() - 1) : closes;
  return formatDay(lastMoment, timeZone);
}

// "Fri 4 Dec at 6:00 pm", or the organiser-chooses wording.
export function drawWhen(schedule: Schedule, timeZone: string): string {
  if (schedule.drawMode === "organiser_chooses" || schedule.drawAt === null) return EXCHANGE_COPY.detail.drawWhenReady;
  const at = new Date(schedule.drawAt);
  return `${formatDay(at, timeZone)} at ${formatTime(at, timeZone)}.`;
}

export function timelineSteps(schedule: Schedule, timeZone: string): TimelineStep[] {
  const copy = EXCHANGE_COPY.detail;
  return [
    {
      title: copy.stepJoin,
      detail: schedule.approvalRequired
        ? copy.stepJoinApproval(lastJoinDay(schedule, timeZone))
        : copy.stepJoinAnyone(lastJoinDay(schedule, timeZone)),
    },
    { title: copy.stepDraw, detail: drawWhen(schedule, timeZone) },
    // WHY the stored date as is, no zone: the gift day is a date only and every viewer sees the same
    // day (owner decision 2026-11-09, Q2).
    { title: copy.stepGifts, detail: `${formatYmdDay(schedule.giftDay) ?? ""}.` },
  ];
}

// The Exchanges block body: "Share the invite link so people can join by Fri 4 Dec. Names are drawn
// at 6:00 pm that day." For "When I choose" the second sentence is the organiser-chooses wording.
export function blockBody(schedule: Schedule, timeZone: string): string {
  const day = lastJoinDay(schedule, timeZone);
  if (schedule.drawMode === "organiser_chooses" || schedule.drawAt === null) return EXCHANGE_COPY.list.blockBodyManual(day);
  return EXCHANGE_COPY.list.blockBody(day, formatTime(new Date(schedule.drawAt), timeZone));
}
