import { describe, expect, it } from "vitest";
import { errorLine } from "../../features/exchanges/copy.ts";
import { runSummary } from "../../features/exchanges/summary.ts";
import { blockBody, drawWhen, lastJoinDay, timelineSteps } from "../../features/exchanges/timeline.ts";
import type { Schedule } from "../../features/exchanges/types.ts";
import {
  formatDay,
  formatDayTime,
  formatHm,
  formatTime,
  formatYmdDay,
  nextYmd,
  parseYmd,
  wallClockIn,
  zoneShortName,
} from "../../lib/dates/format.ts";
import { BUDGET_PRESETS, budgetLabel, isBudgetPreset } from "../../lib/money/budget.ts";
import {
  fieldFromHint,
  joinByWall,
  parseExchangeInput,
  validateBasics,
  validateBudgetAndDates,
} from "../../lib/validation/exchange.ts";

const LAGOS = "Africa/Lagos";

describe("day and time labels (GCO-002, GC-013)", () => {
  // 17:00 UTC is 6:00 pm in Lagos (UTC+1, no DST).
  const sixPm = new Date("2026-12-04T17:00:00Z");

  it("formats the day without a comma or a year, in the given zone", () => {
    expect(formatDay(sixPm, LAGOS)).toBe("Fri 4 Dec");
    expect(formatDay(new Date("2026-09-09T12:00:00Z"), LAGOS)).toBe("Wed 9 Sep");
  });

  it("formats the time in lower case with a plain space", () => {
    expect(formatTime(sixPm, LAGOS)).toBe("6:00 pm");
    expect(formatTime(new Date("2026-12-03T23:00:00Z"), LAGOS)).toBe("12:00 am");
    expect(formatTime(new Date("2026-12-04T11:05:00Z"), LAGOS)).toBe("12:05 pm");
    expect(formatDayTime(sixPm, LAGOS)).toBe("Fri 4 Dec, 6:00 pm");
  });

  it("shows the same instant on a different day in another zone", () => {
    const lateLagos = new Date("2026-12-04T23:30:00Z"); // 12:30 am Sat in Lagos, 11:30 pm Fri in London
    expect(formatDay(lateLagos, LAGOS)).toBe("Sat 5 Dec");
    expect(formatDay(lateLagos, "Europe/London")).toBe("Fri 4 Dec");
  });

  it("names the zone WAT for Lagos and falls back to GMT offsets", () => {
    expect(zoneShortName(sixPm, LAGOS)).toBe("WAT");
    expect(zoneShortName(sixPm, "Europe/London")).toBe("GMT");
  });

  it("reads typed dates and times and refuses impossible ones", () => {
    expect(formatYmdDay("2026-12-04")).toBe("Fri 4 Dec");
    expect(formatYmdDay("2026-02-30")).toBeNull();
    expect(parseYmd("26-12-04")).toBeNull();
    expect(formatHm("18:00")).toBe("6:00 pm");
    expect(formatHm("00:30")).toBe("12:30 am");
    expect(formatHm("24:00")).toBeNull();
    expect(formatHm("")).toBeNull();
  });

  it("gives the next calendar day across month and year ends", () => {
    expect(nextYmd("2026-12-31")).toBe("2027-01-01");
    expect(nextYmd("2026-02-28")).toBe("2026-03-01");
    expect(nextYmd("nope")).toBeNull();
  });

  it("reads the wall clock in a zone", () => {
    expect(wallClockIn(new Date("2026-12-04T23:30:00Z"), LAGOS)).toEqual({ ymd: "2026-12-05", hm: "00:30" });
    expect(wallClockIn(new Date("2026-12-04T23:30:00Z"), "Europe/London")).toEqual({ ymd: "2026-12-04", hm: "23:30" });
  });
});

describe("budget presets (GCO-002, decided 2026-11-03)", () => {
  it("labels the four presets with 'to' and 'Above'", () => {
    expect(BUDGET_PRESETS.map(budgetLabel)).toEqual([
      "₦5,000 to ₦10,000",
      "₦10,000 to ₦20,000",
      "₦20,000 to ₦50,000",
      "Above ₦50,000",
    ]);
  });
  it("accepts only the preset keys", () => {
    expect(isBudgetPreset("10k_20k")).toBe(true);
    expect(isBudgetPreset("15k_25k")).toBe(false);
    expect(isBudgetPreset(undefined)).toBe(false);
  });
});

describe("timeline sentences (GCO-004, GC-013)", () => {
  // Joining closes at 6:00 pm Lagos on Fri 4 Dec; gifts Sat 12 Dec 3:00 pm Lagos.
  const automatic: Schedule = {
    joinByAt: "2026-12-04T17:00:00Z",
    drawMode: "at_join_by",
    drawAt: "2026-12-04T17:00:00Z",
    eventAt: "2026-12-12T14:00:00Z",
    approvalRequired: false,
  };
  // "When I choose": joining closes at the next Lagos midnight, exclusive (Sat 5 Dec 00:00 = Fri 23:00Z).
  const manual: Schedule = {
    joinByAt: "2026-12-04T23:00:00Z",
    drawMode: "organiser_chooses",
    drawAt: null,
    eventAt: "2026-12-12T14:00:00Z",
    approvalRequired: false,
  };

  it("writes the three steps for an automatic draw", () => {
    expect(timelineSteps(automatic, LAGOS)).toEqual([
      { title: "People join", detail: "Anyone with the link can join until Fri 4 Dec." },
      { title: "Names are drawn", detail: "Fri 4 Dec at 6:00 pm." },
      { title: "Gifts are exchanged", detail: "Sat 12 Dec at 3:00 pm." },
    ]);
  });

  it("writes the steps for a manual draw: the last joining day is the day BEFORE the closing midnight", () => {
    const steps = timelineSteps(manual, LAGOS);
    expect(steps[0]?.detail).toBe("Anyone with the link can join until Fri 4 Dec.");
    expect(steps[1]?.detail).toBe("When you're ready.");
    expect(steps[2]?.detail).toBe("Sat 12 Dec at 3:00 pm.");
  });

  it("counts the last joining day in the viewer's zone at the day boundary", () => {
    // Closing instant Sat 5 Dec 00:00 Lagos: the last moment is Fri 23:59:59.999 in Lagos, and the
    // same instant is Fri 22:59 in London and Sat 12:59 in Auckland.
    expect(lastJoinDay(manual, LAGOS)).toBe("Fri 4 Dec");
    expect(lastJoinDay(manual, "Europe/London")).toBe("Fri 4 Dec");
    expect(lastJoinDay(manual, "Pacific/Auckland")).toBe("Sat 5 Dec");
  });

  it("does not shift an automatic closing moment", () => {
    expect(lastJoinDay(automatic, LAGOS)).toBe("Fri 4 Dec");
    // 6:00 pm Lagos is 5:00 pm in London and 6:00 am next day in Auckland.
    expect(lastJoinDay(automatic, "Pacific/Auckland")).toBe("Sat 5 Dec");
  });

  it("handles a daylight-saving change day (25 hours long) in a viewer's zone", () => {
    // London clocks went back on Sun 25 Oct 2026. Midnight at the end of that day is 00:00 GMT on the
    // 26th = 2026-10-26T00:00Z; the last moment belongs to Sun 25 Oct, not Mon 26 Oct.
    const dst: Schedule = { ...manual, joinByAt: "2026-10-26T00:00:00Z" };
    expect(lastJoinDay(dst, "Europe/London")).toBe("Sun 25 Oct");
    // And the end of Sat 24 Oct in London (BST) is 2026-10-24T23:00Z.
    expect(lastJoinDay({ ...manual, joinByAt: "2026-10-24T23:00:00Z" }, "Europe/London")).toBe("Sat 24 Oct");
  });

  it("words the approval variant and the draw line", () => {
    expect(timelineSteps({ ...automatic, approvalRequired: true }, LAGOS)[0]?.detail).toBe(
      "People ask to join and you approve each one, until Fri 4 Dec.",
    );
    expect(drawWhen(automatic, LAGOS)).toBe("Fri 4 Dec at 6:00 pm.");
    expect(drawWhen(manual, LAGOS)).toBe("When you're ready.");
  });

  it("writes the Exchanges block body for both modes", () => {
    expect(blockBody(automatic, LAGOS)).toBe(
      "Share the invite link so people can join by Fri 4 Dec. Names are drawn at 6:00 pm that day.",
    );
    expect(blockBody(manual, LAGOS)).toBe(
      "Share the invite link so people can join by Fri 4 Dec. You draw names when you're ready.",
    );
  });
});

describe("the 'how it runs' summary (GCO-002)", () => {
  const base = { joinByDate: "2026-12-04", drawMode: "at_join_by", drawTime: "18:00", eventDate: "2026-12-12", eventTime: "15:00" } as const;

  it("matches the board for an evening draw", () => {
    expect(runSummary(base)).toBe(
      "Here's how it runs: people can join until Fri 4 Dec. We draw names that evening at 6:00 pm. Gifts are exchanged on Sat 12 Dec at 3:00 pm.",
    );
  });
  it("says 'that day' for a draw before 5 pm", () => {
    expect(runSummary({ ...base, drawTime: "09:00" })).toContain("We draw names that day at 9:00 am.");
    expect(runSummary({ ...base, drawTime: "17:00" })).toContain("that evening at 5:00 pm");
  });
  it("matches the board for 'When I choose'", () => {
    expect(runSummary({ ...base, drawMode: "organiser_chooses" })).toBe(
      "Here's how it runs: people can join until the end of Fri 4 Dec. You draw names when you're ready. Gifts are exchanged on Sat 12 Dec at 3:00 pm.",
    );
  });
  it("shows nothing until the dates are real", () => {
    expect(runSummary({ ...base, joinByDate: "" })).toBeNull();
    expect(runSummary({ ...base, eventTime: "" })).toBeNull();
    expect(runSummary({ ...base, drawTime: "" })).toBeNull();
    // The draw time does not matter when the organiser draws.
    expect(runSummary({ ...base, drawMode: "organiser_chooses", drawTime: "" })).not.toBeNull();
  });
});

describe("step validation (GCO-001, GCO-002)", () => {
  const now = { ymd: "2026-11-09", hm: "12:00" };
  const good = {
    budget: "5k_10k",
    joinByDate: "2026-12-04",
    drawMode: "at_join_by",
    drawTime: "18:00",
    eventDate: "2026-12-12",
    eventTime: "15:00",
  } as const;

  it("requires a name and caps the note at 280 code points", () => {
    expect(validateBasics("  ", "")).toEqual({ name: "missing" });
    expect(validateBasics("Book club", "x".repeat(280))).toEqual({});
    expect(validateBasics("Book club", "x".repeat(281))).toEqual({ note: "too-long" });
    // An emoji is one code point, as in the database.
    expect(validateBasics("Book club", "🎁".repeat(280))).toEqual({});
  });

  it("accepts a valid plan", () => {
    expect(validateBudgetAndDates(good, now)).toEqual({});
  });

  it("flags missing budget, dates and times on their fields", () => {
    expect(validateBudgetAndDates({ ...good, budget: null, joinByDate: "", eventDate: "", eventTime: "", drawTime: "" }, now)).toEqual({
      budget: "missing",
      joinBy: "missing",
      eventDate: "missing",
      eventTime: "missing",
      drawTime: "missing",
    });
  });

  it("puts a past gift moment on the gift day", () => {
    expect(validateBudgetAndDates({ ...good, eventDate: "2026-11-09", eventTime: "11:59" }, now).eventDate).toBe("gift-past");
  });

  it("puts a past join-by on Join by, and join-by after the gift on Join by", () => {
    expect(validateBudgetAndDates({ ...good, joinByDate: "2026-11-09", drawTime: "11:00" }, now).joinBy).toBe("join-past");
    expect(validateBudgetAndDates({ ...good, joinByDate: "2026-12-12", drawTime: "15:00" }, now).joinBy).toBe("join-not-before-gift");
    expect(validateBudgetAndDates({ ...good, joinByDate: "2026-12-19" }, now).joinBy).toBe("join-not-before-gift");
  });

  it("allows join-by on the gift day when it is earlier in the day (automatic draw)", () => {
    expect(validateBudgetAndDates({ ...good, joinByDate: "2026-12-12", drawTime: "09:00" }, now)).toEqual({});
  });

  it("needs the join-by DAY before the gift DAY when the organiser draws", () => {
    const manual = { ...good, drawMode: "organiser_chooses" } as const;
    expect(validateBudgetAndDates({ ...manual, joinByDate: "2026-12-12" }, now).joinBy).toBe("join-not-before-gift");
    expect(validateBudgetAndDates({ ...manual, joinByDate: "2026-12-11" }, now)).toEqual({});
    // Joining closes at the end of today, which is still in the future.
    expect(validateBudgetAndDates({ ...manual, joinByDate: "2026-11-09" }, now)).toEqual({});
    expect(validateBudgetAndDates({ ...manual, joinByDate: "2026-11-08" }, now).joinBy).toBe("join-past");
  });

  it("finds the wall-clock moment joining closes", () => {
    expect(joinByWall({ joinByDate: "2026-12-04", drawMode: "at_join_by", drawTime: "18:00" })).toBe("2026-12-04T18:00");
    expect(joinByWall({ joinByDate: "2026-12-31", drawMode: "organiser_chooses", drawTime: "" })).toBe("2027-01-01T00:00");
    expect(joinByWall({ joinByDate: "", drawMode: "at_join_by", drawTime: "18:00" })).toBeNull();
  });
});

describe("the Server Action's input check and the refusal hints (GCO-001..003)", () => {
  const raw = {
    name: "  Book   club ",
    note: "  ",
    budget: "10k_20k",
    joinByDate: "2026-12-04",
    drawMode: "organiser_chooses",
    drawTime: "",
    eventDate: "2026-12-12",
    eventTime: "15:00",
    timeZone: LAGOS,
    takingPart: false,
    approvalRequired: true,
  };

  it("cleans a valid input and never carries a user id", () => {
    const parsed = parseExchangeInput({ ...raw, userId: "someone-else" });
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "Book club",
        note: null,
        budget: "10k_20k",
        joinByDate: "2026-12-04",
        drawMode: "organiser_chooses",
        drawTime: "18:00",
        eventDate: "2026-12-12",
        eventTime: "15:00",
        timeZone: LAGOS,
        takingPart: false,
        approvalRequired: true,
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("someone-else");
  });

  it("refuses junk with field codes, and a bad zone without one", () => {
    expect(parseExchangeInput(null)).toMatchObject({ ok: false });
    const bad = parseExchangeInput({ ...raw, name: "", budget: "free", joinByDate: "x", eventTime: "25:00" });
    expect(bad).toEqual({
      ok: false,
      errors: { name: "missing", budget: "missing", joinBy: "missing", eventTime: "missing" },
    });
    expect(parseExchangeInput({ ...raw, timeZone: "Mars/Olympus" })).toEqual({ ok: false, errors: {} });
  });

  it("defaults to taking part when the flag is not false", () => {
    const parsed = parseExchangeInput({ ...raw, takingPart: undefined, approvalRequired: undefined });
    expect(parsed.ok && parsed.value.takingPart).toBe(true);
    expect(parsed.ok && parsed.value.approvalRequired).toBe(false);
  });

  it("maps each 22023 hint to the field the line goes under", () => {
    expect(fieldFromHint("name")).toEqual({ field: "name", code: "missing" });
    expect(fieldFromHint("note")).toEqual({ field: "note", code: "too-long" });
    expect(fieldFromHint("budget")).toEqual({ field: "budget", code: "missing" });
    expect(fieldFromHint("join_by")).toEqual({ field: "joinBy", code: "join-not-before-gift" });
    // R1-1: with the plan, a join-by still before the gift was refused for being in the past.
    const plan = { joinByDate: "2026-12-04", drawMode: "at_join_by", drawTime: "18:00", eventDate: "2026-12-12", eventTime: "15:00" } as const;
    expect(fieldFromHint("join_by", plan)).toEqual({ field: "joinBy", code: "join-past" });
    expect(fieldFromHint("join_by", { ...plan, joinByDate: "2026-12-12", drawTime: "16:00" })).toEqual({ field: "joinBy", code: "join-not-before-gift" });
    expect(fieldFromHint("join_by", { ...plan, drawMode: "organiser_chooses", joinByDate: "2026-12-12" })).toEqual({ field: "joinBy", code: "join-not-before-gift" });
    expect(fieldFromHint("join_by", { ...plan, drawMode: "organiser_chooses" })).toEqual({ field: "joinBy", code: "join-past" });
    expect(fieldFromHint("event")).toEqual({ field: "eventDate", code: "gift-past" });
    // The person cannot fix a zone, and an unknown hint says nothing: both become "Couldn't start".
    expect(fieldFromHint("time_zone")).toBeNull();
    expect(fieldFromHint("surprise")).toBeNull();
    expect(fieldFromHint(null)).toBeNull();
  });

  it("uses the approved lines for the field errors", () => {
    expect(errorLine("name", "missing")).toBe("Add a name so people know which exchange this is.");
    expect(errorLine("budget", "missing")).toBe("Pick a budget so everyone spends about the same.");
    expect(errorLine("joinBy", "join-not-before-gift")).toBe("Join by has to be before the gift day.");
    expect(errorLine("joinBy", "join-past")).toBe("Join by has to be in the future.");
    expect(errorLine("eventDate", "gift-past")).toBe("The gift day has to be in the future.");
  });
});
