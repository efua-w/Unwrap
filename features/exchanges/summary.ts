import { formatHm, formatYmdDay, hourOfHm } from "@/lib/dates/format";
import type { ExchangeInput } from "@/lib/validation/exchange";
import { EXCHANGE_COPY } from "./copy";

type SummaryInput = Pick<ExchangeInput, "joinByDate" | "drawMode" | "drawTime" | "giftDay">;

// "Here's how it runs: ..." under Budget and dates (GCO-002), in the organiser's own zone: the
// values are the wall-clock dates and times they typed. Null until every date the sentence needs is
// a real one, so a half-filled form shows no half-true sentence.
// WHY "that evening" only from 5 pm: the board's example draws at 6:00 pm. A 9:00 am draw would
// not be "that evening", so earlier times say "that day" (copy-pending).
export function runSummary(input: SummaryInput): string | null {
  const join = formatYmdDay(input.joinByDate);
  const gift = formatYmdDay(input.giftDay);
  if (!join || !gift) return null;
  const copy = EXCHANGE_COPY.summary;
  if (input.drawMode === "organiser_chooses") return copy.manual(join, gift);
  const drawTime = formatHm(input.drawTime);
  const hour = hourOfHm(input.drawTime);
  if (!drawTime || hour === null) return null;
  return copy.automatic(join, hour >= 17 ? copy.thatEvening : copy.thatDay, drawTime, gift);
}
