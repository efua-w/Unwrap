import { isValidTimeZone } from "../dates/timezone";
import { nextYmd, parseYmd } from "../dates/format";
import { isBudgetPreset, type BudgetPreset } from "../money/budget";
import { normaliseSingleLine } from "./text";

// Form rules for Start exchange (GCO-001, GCO-002, GCO-003). The database (create_exchange and its
// CHECK constraints) is the source of truth; these give inline errors first and send only clean
// values. Pure: used by the form in the browser and again by the Server Action, which never trusts
// the browser's copy.

export const EXCHANGE_NAME_MAX = 40;
export const EXCHANGE_NOTE_MAX = 280;

export type DrawMode = "at_join_by" | "organiser_chooses";

export type ExchangeInput = {
  name: string;
  note: string | null;
  budget: BudgetPreset;
  /** "2026-12-04", a calendar date in the organiser's zone. */
  joinByDate: string;
  drawMode: DrawMode;
  /** "18:00". Used only when drawMode is at_join_by. */
  drawTime: string;
  /** "2026-12-12", a calendar date in the organiser's zone. No time: the gift day is a date only. */
  giftDay: string;
  /** The organiser's zone, from their browser. */
  timeZone: string;
  takingPart: boolean;
  approvalRequired: boolean;
};

export type FieldKey = "name" | "note" | "budget" | "joinBy" | "drawTime" | "giftDay";
export type ErrorCode = "missing" | "too-long" | "join-not-before-gift" | "join-past" | "gift-past";
export type ExchangeErrors = Partial<Record<FieldKey, ErrorCode>>;
export type Validation<T, E> = { ok: true; value: T } | { ok: false; errors: E };

export function isDrawMode(value: unknown): value is DrawMode {
  return value === "at_join_by" || value === "organiser_chooses";
}

export function isHm(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Step 1 (GCO-001). Name is required; note is optional and at most 280.
export function validateBasics(name: string, note: string): ExchangeErrors {
  const errors: ExchangeErrors = {};
  if (normaliseSingleLine(name, EXCHANGE_NAME_MAX).length === 0) errors.name = "missing";
  if (Array.from(note.trim()).length > EXCHANGE_NOTE_MAX) errors.note = "too-long";
  return errors;
}

type DatesInput = Pick<ExchangeInput, "joinByDate" | "drawMode" | "drawTime" | "giftDay"> & {
  budget: BudgetPreset | null;
};

// The wall-clock moment joining closes, as "2026-12-04T18:00". WHY the next midnight for "When I
// choose" (owner decision 2026-11-09, planner round 2): joining closes at the end of the join-by
// day, which is the start of the next one, exclusive. Null when the inputs cannot say.
export function joinByWall(input: Pick<DatesInput, "joinByDate" | "drawMode" | "drawTime">): string | null {
  if (!parseYmd(input.joinByDate)) return null;
  if (input.drawMode === "organiser_chooses") {
    const next = nextYmd(input.joinByDate);
    return next ? `${next}T00:00` : null;
  }
  return isHm(input.drawTime) ? `${input.joinByDate}T${input.drawTime}` : null;
}

// Step 2 (GCO-002), mirroring create_exchange so the person sees the line on the field to fix.
// `now` is the current wall-clock time in the organiser's zone (wallClockIn). Rules (owner decisions
// 2026-11-09): the gift day is a date that has not ended (today counts); the join-by DAY is strictly
// before the gift day in both draw modes; the join-by moment is in the future.
export function validateBudgetAndDates(input: DatesInput, now: { ymd: string; hm: string }): ExchangeErrors {
  const errors: ExchangeErrors = {};
  if (input.budget === null) errors.budget = "missing";
  if (!parseYmd(input.joinByDate)) errors.joinBy = "missing";
  if (!parseYmd(input.giftDay)) errors.giftDay = "missing";
  if (input.drawMode === "at_join_by" && !isHm(input.drawTime)) errors.drawTime = "missing";
  const nowWall = `${now.ymd}T${now.hm}`;

  // The order matches the database: the gift day is checked against today first.
  // WHY < and not <=: the gift day counts as passed at the END of that day (GCO-002).
  if (!errors.giftDay && input.giftDay < now.ymd) errors.giftDay = "gift-past";
  if (errors.joinBy || errors.drawTime) return errors;
  const joinBy = joinByWall(input);
  if (!joinBy) return errors;
  if (!errors.giftDay && input.joinByDate >= input.giftDay) {
    errors.joinBy = "join-not-before-gift";
  } else if (joinBy <= nowWall) {
    errors.joinBy = "join-past";
  }
  return errors;
}

// What a Server Action accepts: the right types and formats. Date order and "in the future" are
// the database's call (it has the clock), not repeated here.
export function parseExchangeInput(raw: unknown): Validation<ExchangeInput, ExchangeErrors> {
  const input = isRecord(raw) ? raw : {};
  const name = normaliseSingleLine(str(input.name), EXCHANGE_NAME_MAX);
  const noteText = str(input.note).trim();
  const errors: ExchangeErrors = {};
  if (name.length === 0) errors.name = "missing";
  if (Array.from(noteText).length > EXCHANGE_NOTE_MAX) errors.note = "too-long";
  if (!isBudgetPreset(input.budget)) errors.budget = "missing";
  const drawMode = isDrawMode(input.drawMode) ? input.drawMode : "at_join_by";
  if (!parseYmd(str(input.joinByDate))) errors.joinBy = "missing";
  if (!parseYmd(str(input.giftDay))) errors.giftDay = "missing";
  // WHY a default: "When I choose" ignores the draw time, so a missing one is not an error there.
  const drawTime = isHm(input.drawTime) ? input.drawTime : "18:00";
  if (drawMode === "at_join_by" && !isHm(input.drawTime)) errors.drawTime = "missing";
  const timeZone = str(input.timeZone);
  if (!isValidTimeZone(timeZone) && Object.keys(errors).length === 0) {
    // WHY not a field error: the person cannot fix a zone, so the caller treats this as a failure.
    return { ok: false, errors: {} };
  }
  if (Object.keys(errors).length > 0 || !isBudgetPreset(input.budget)) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      note: noteText === "" ? null : noteText,
      budget: input.budget,
      joinByDate: str(input.joinByDate),
      drawMode,
      drawTime,
      giftDay: str(input.giftDay),
      timeZone,
      takingPart: input.takingPart !== false,
      approvalRequired: input.approvalRequired === true,
    },
  };
}

function joinIsBeforeGift(plan: NonNullable<Parameters<typeof fieldFromHint>[1]>): boolean {
  if (!joinByWall(plan)) return false;
  return plan.joinByDate < plan.giftDay;
}

// The database refuses with SQLSTATE 22023 and the failing field as the hint (migrations
// 20261109104934_exchanges and 20261109152915_gift_day_date_only: name, note, budget, join_by, event,
// time_zone). Returns the form field
// to put the line on, or null when the person cannot fix it (the zone) or the hint is unknown.
export function fieldFromHint(
  hint: string | null | undefined,
  plan?: Pick<ExchangeInput, "joinByDate" | "drawMode" | "drawTime" | "giftDay">,
): { field: FieldKey; code: ErrorCode } | null {
  switch (hint) {
    case "name":
      return { field: "name", code: "missing" };
    case "note":
      return { field: "note", code: "too-long" };
    case "budget":
      return { field: "budget", code: "missing" };
    case "join_by":
      // WHY look at the plan: the database uses one hint for "in the past" and "not before the gift".
      // When the typed join-by is still before the gift, the clock is what refused it (R1-1).
      return { field: "joinBy", code: plan && joinIsBeforeGift(plan) ? "join-past" : "join-not-before-gift" };
    case "event":
      return { field: "giftDay", code: "gift-past" };
    default:
      return null;
  }
}
