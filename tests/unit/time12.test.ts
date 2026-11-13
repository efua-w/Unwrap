import { describe, expect, it } from "vitest";
import { formatTime12Text, from24Hm, TIME_OPTIONS, to24Hm } from "../../lib/dates/time12.ts";

describe("12-hour time helpers (GCO-002 Draw time)", () => {
  it("converts 12-hour parts to 24-hour HH:MM", () => {
    expect(to24Hm({ hour: 12, minute: 0, period: "AM" })).toBe("00:00");
    expect(to24Hm({ hour: 12, minute: 0, period: "PM" })).toBe("12:00");
    expect(to24Hm({ hour: 6, minute: 0, period: "PM" })).toBe("18:00");
    expect(to24Hm({ hour: 6, minute: 5, period: "AM" })).toBe("06:05");
    expect(to24Hm({ hour: 11, minute: 59, period: "PM" })).toBe("23:59");
  });

  it("converts 24-hour HH:MM to 12-hour parts", () => {
    expect(from24Hm("00:00")).toEqual({ hour: 12, minute: 0, period: "AM" });
    expect(from24Hm("12:00")).toEqual({ hour: 12, minute: 0, period: "PM" });
    expect(from24Hm("18:00")).toEqual({ hour: 6, minute: 0, period: "PM" });
    expect(from24Hm("23:59")).toEqual({ hour: 11, minute: 59, period: "PM" });
    expect(from24Hm("09:30")).toEqual({ hour: 9, minute: 30, period: "AM" });
  });

  it("rejects anything that is not a real 24-hour time", () => {
    for (const bad of ["", "24:00", "12:60", "6:00", "ab:cd", "18:00:00"]) expect(from24Hm(bad)).toBeNull();
  });

  it("normalises to h:mm", () => {
    expect(formatTime12Text(6, 0)).toBe("6:00");
    expect(formatTime12Text(12, 5)).toBe("12:05");
  });

  it("lists 24 half-hour options, 12:00 first and 11:30 last", () => {
    expect(TIME_OPTIONS).toHaveLength(24);
    expect(TIME_OPTIONS.map((o) => o.label).slice(0, 4)).toEqual(["12:00", "12:30", "1:00", "1:30"]);
    expect(TIME_OPTIONS[23]?.label).toBe("11:30");
    expect(new Set(TIME_OPTIONS.map((o) => o.label)).size).toBe(24);
  });

  it("every option converts to a distinct 24-hour time in each half of the day", () => {
    const am = TIME_OPTIONS.map((o) => to24Hm({ ...o, period: "AM" }));
    const pm = TIME_OPTIONS.map((o) => to24Hm({ ...o, period: "PM" }));
    expect(am[0]).toBe("00:00");
    expect(am[23]).toBe("11:30");
    expect(pm[0]).toBe("12:00");
    expect(pm[6]).toBe("15:00");
    expect(pm[23]).toBe("23:30");
    expect(new Set([...am, ...pm]).size).toBe(48);
  });
});
