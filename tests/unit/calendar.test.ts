import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInMonth,
  endOfWeek,
  formatMonthYear,
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

  it("builds a Monday-first grid for a month starting on a Sunday", () => {
    // 1 November 2026 is a Sunday: six empty cells' worth of lead, so it ends the first week.
    const weeks = monthGrid(2026, 11);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[1]?.[0]).toBe("2026-11-02");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("builds a Monday-first grid for a month starting on a Monday", () => {
    // 1 June 2026 is a Monday: no empty cells before it.
    const weeks = monthGrid(2026, 6);
    expect(weeks[0]?.[0]).toBe("2026-06-01");
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
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

  it("finds the week start and end (Monday to Sunday)", () => {
    expect(startOfWeek("2026-12-04")).toBe("2026-11-30"); // Friday -> Monday
    expect(endOfWeek("2026-12-04")).toBe("2026-12-06");
    expect(startOfWeek("2026-11-30")).toBe("2026-11-30");
    expect(endOfWeek("2026-12-06")).toBe("2026-12-06");
  });

  it("names weekdays and days", () => {
    expect(weekdayHeaders().map((h) => h.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekdayHeaders()[0]?.long).toBe("Monday");
    expect(formatMonthYear(2026, 12)).toBe("December 2026");
    expect(formatYmdLongFull("2026-12-04")).toBe("Friday 4 December 2026");
    expect(formatYmdDayYear("2026-12-04")).toBe("Fri 4 Dec 2026");
    expect(formatYmdDayYear("nope")).toBeNull();
  });

  it("takes today from the local fields", () => {
    expect(localTodayYmd(new Date(2026, 11, 4, 23, 30))).toBe("2026-12-04");
  });
});
