import { describe, expect, it } from "vitest";
import { askedLabel, waitingNames } from "@/features/participants/format";
import { PARTICIPANTS_COPY, REQUEST_BLOCK_COPY } from "@/features/participants/copy";

describe("askedLabel (GCO-007)", () => {
  const now = new Date("2026-11-15T14:00:00Z");

  it("says 'today at' for the same day in the viewer's zone", () => {
    expect(askedLabel("2026-11-15T07:12:00Z", now, "Africa/Lagos")).toBe("Asked today at 8:12 am");
  });

  it("gives the day and time for an earlier day", () => {
    expect(askedLabel("2026-10-29T08:12:00Z", now, "Africa/Lagos")).toBe("Asked Thu 29 Oct, 9:12 am");
  });

  it("uses the viewer's zone for 'today', not UTC", () => {
    // 22:30 UTC on the 14th is 11:30 am on the 15th in Auckland, but 11:30 pm on the 14th in Lagos.
    // "Now" is 10:00 on the 15th in Lagos and 22:00 on the 15th in Auckland.
    const early = new Date("2026-11-15T09:00:00Z");
    expect(askedLabel("2026-11-14T22:30:00Z", early, "Pacific/Auckland")).toBe("Asked today at 11:30 am");
    expect(askedLabel("2026-11-14T22:30:00Z", early, "Africa/Lagos")).toBe("Asked Sat 14 Nov, 11:30 pm");
  });
});

describe("waitingNames (GCO-006)", () => {
  it("joins first names with 'and'", () => {
    expect(waitingNames(["Chidi Okafor", "Bisi Lawal"])).toBe("Chidi and Bisi");
    expect(waitingNames(["Chidi Okafor", "Bisi Lawal", "Femi Adeyemi"])).toBe("Chidi, Bisi and Femi");
  });

  it("counts the rest past three", () => {
    expect(waitingNames(["A One", "B Two", "C Three", "D Four"])).toBe("A, B, C and 1 other");
    expect(waitingNames(["A One", "B Two", "C Three", "D Four", "E Five"])).toBe("A, B, C and 2 others");
  });
});

describe("copy lines", () => {
  it("matches the board and story wording", () => {
    expect(REQUEST_BLOCK_COPY.one("Chidi Okafor")).toBe("Chidi Okafor wants to join.");
    expect(REQUEST_BLOCK_COPY.many(3)).toBe("3 people want to join.");
    expect(REQUEST_BLOCK_COPY.reviewMany(3)).toBe("Review 3 requests");
    expect(REQUEST_BLOCK_COPY.oneBody("Chidi", "Fri 27 Nov")).toBe("Approve or decline Chidi's request. People can join until Fri 27 Nov.");
    expect(PARTICIPANTS_COPY.subtitle("Office", 1)).toBe("Office · 1 person taking part");
    expect(PARTICIPANTS_COPY.subtitle("Office", 4)).toBe("Office · 4 people taking part");
  });
});
