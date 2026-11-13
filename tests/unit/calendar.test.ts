import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInMonth,
  endOfWeek,
  formatMonthYear,
  isBeforeMin,
  isMonthBeforeMin,
  formatYmdLongFull,
  localTodayYmd,
  monthGrid,
  parseYmdParts,
  startOfWeek,
  toYmd,
  weekdayHeaders,
} from "../../lib/dates/calendar.ts";
import { formatYmdDayYear } from "../../lib/dates/format.ts";

describe("calendar date maths (GCO-002 date picker)", () => {
  it("parses and formats YYYY-MM-DD, rejecting non-dates", () => {
    expect(parseYmdParts("2026-12-04")).toEqual({ year: 2026, month: 12, day: 4 });
    expect(parseYmdParts("2026-02-30")).toBeNull();
    expect(parseYmdParts("")).toBeNull();
    expect(toYmd({ year: 2026, month: 3, day: 9 })).toBe("2026-03-09");
  });

  it("knows leap Februaries", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("builds a Sunday-first grid for a month starting on a Sunday", () => {
    // 1 November 2026 is a Sunday: no empty cells before it.
    const weeks = monthGrid(2026, 11);
    expect(weeks[0]).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("builds a Sunday-first grid for a month starting on a Saturday", () => {
    // 1 August 2026 is a Saturday: six empty cells, then the 1st ends the first week.
    const weeks = monthGrid(2026, 8);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-08-01"]);
    expect(weeks[1]?.[0]).toBe("2026-08-02");
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("builds a leap February", () => {
    const days = monthGrid(2028, 2).flat().filter(Boolean);
    expect(days).toHaveLength(29);
    expect(days.at(-1)).toBe("2028-02-29");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-12-04", 7)).toBe("2026-12-11");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("adds months across the year and clamps the day", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2027-01-15", -1)).toBe("2026-12-15");
    expect(addMonths("2026-12-15", -12)).toBe("2025-12-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("finds the week start and end (Sunday to Saturday)", () => {
    expect(startOfWeek("2026-12-04")).toBe("2026-11-29"); // Friday -> Sunday
    expect(endOfWeek("2026-12-04")).toBe("2026-12-05"); // Saturday
    expect(startOfWeek("2026-11-29")).toBe("2026-11-29");
    expect(endOfWeek("2026-12-05")).toBe("2026-12-05");
  });

  it("names weekdays and days", () => {
    expect(weekdayHeaders().map((h) => h.short)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(weekdayHeaders()[0]?.long).toBe("Sunday");
    expect(formatMonthYear(2026, 12)).toBe("December 2026");
    expect(formatYmdLongFull("2026-12-04")).toBe("Friday 4 December 2026");
    expect(formatYmdDayYear("2026-12-04")).toBe("Fri 4 Dec 2026");
    expect(formatYmdDayYear("nope")).toBeNull();
  });

  it("compares days and months with the earliest allowed day", () => {
    expect(isBeforeMin("2026-11-10", "2026-11-11")).toBe(true);
    expect(isBeforeMin("2026-11-11", "2026-11-11")).toBe(false); // today stays pickable
    expect(isBeforeMin("2026-11-12", "2026-11-11")).toBe(false);
    expect(isBeforeMin("2020-01-01", undefined)).toBe(false);
    expect(isMonthBeforeMin(2026, 10, "2026-11-11")).toBe(true);
    expect(isMonthBeforeMin(2026, 11, "2026-11-11")).toBe(false);
    expect(isMonthBeforeMin(2026, 10, "2026-10-31")).toBe(false); // the 31st is still pickable
    expect(isMonthBeforeMin(2026, 1, undefined)).toBe(false);
  });

  it("takes today from the local fields", () => {
    expect(localTodayYmd(new Date(2026, 11, 4, 23, 30))).toBe("2026-12-04");
  });
});
