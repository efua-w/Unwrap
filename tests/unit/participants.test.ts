import { describe, expect, it } from "vitest";
import { askedLabel, memberSubline, requestSubline, waitingNames } from "@/features/participants/format";
import { toJoinRequestRow, toJoinRequestRowWithEmail, toParticipantLine } from "@/features/participants/map";
import { NUDGE_COPY, PARTICIPANTS_COPY, REQUEST_BLOCK_COPY } from "@/features/participants/copy";
import { summariseReadiness } from "@/features/participants/readiness";
import type { ReadinessRow } from "@/features/participants/types";

describe("askedLabel (GCO-007)", () => {
  const now = new Date("2026-11-15T14:00:00Z");

  it("says 'today at' for the same day in the viewer's zone", () => {
    expect(askedLabel("2026-11-15T07:12:00Z", now, "Africa/Lagos")).toBe("Today at 8:12 am");
  });

  it("gives the day and time for an earlier day", () => {
    expect(askedLabel("2026-10-29T08:12:00Z", now, "Africa/Lagos")).toBe("Thu 29 Oct, 9:12 am");
  });

  it("uses the viewer's zone for 'today', not UTC", () => {
    // 22:30 UTC on the 14th is 11:30 am on the 15th in Auckland, but 11:30 pm on the 14th in Lagos.
    // "Now" is 10:00 on the 15th in Lagos and 22:00 on the 15th in Auckland.
    const early = new Date("2026-11-15T09:00:00Z");
    expect(askedLabel("2026-11-14T22:30:00Z", early, "Pacific/Auckland")).toBe("Today at 11:30 am");
    expect(askedLabel("2026-11-14T22:30:00Z", early, "Africa/Lagos")).toBe("Sat 14 Nov, 11:30 pm");
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

describe("sub lines (GCO-007, owner decisions 2026-11-16)", () => {
  it("joins the address and the time on a request row", () => {
    expect(requestSubline("chidi.okeke@gmail.com", "Today at 8:12 am")).toBe("chidi.okeke@gmail.com · Today at 8:12 am");
  });

  it("joins the address and the wishlist status on a member row", () => {
    expect(memberSubline({ email: "ifeoma.nwosu@gmail.com", hasWishlist: true })).toBe("ifeoma.nwosu@gmail.com · Wishlist added");
    expect(memberSubline({ email: "ada.eze@outlook.com", hasWishlist: false })).toBe("ada.eze@outlook.com · No wishlist yet");
  });

  it("shows the status alone on the organiser's own row (no address)", () => {
    expect(memberSubline({ email: null, hasWishlist: true })).toBe("Wishlist added");
    expect(memberSubline({ email: null, hasWishlist: false })).toBe("No wishlist yet");
  });

  it("puts 'Joined just now' between the address and the status", () => {
    expect(memberSubline({ email: "chidi.okeke@gmail.com", hasWishlist: false, justJoined: true })).toBe(
      "chidi.okeke@gmail.com · Joined just now · No wishlist yet",
    );
  });
});

describe("row mappers (GCO-007)", () => {
  const request = { request_id: "r1", display_name: "Chidi Okeke", email: "chidi.okeke@gmail.com", requested_at: "2026-11-15T07:12:00Z" };

  it("drops the address from the names-only request row", () => {
    const row = toJoinRequestRow(request);
    expect(row).toEqual({ requestId: "r1", name: "Chidi Okeke", requestedAt: "2026-11-15T07:12:00Z" });
    expect(JSON.stringify(row)).not.toContain("@");
  });

  it("keeps the address on the Participants request row", () => {
    expect(toJoinRequestRowWithEmail(request).email).toBe("chidi.okeke@gmail.com");
  });

  it("maps the organiser's own row with a null address and the wishlist flag", () => {
    const own = toParticipantLine({
      member_id: "m1",
      display_name: "Amaka Obi",
      email: null as unknown as string,
      has_wishlist: true,
      is_me: true,
      is_organiser: true,
      taking_part: true,
    });
    expect(own).toEqual({ memberId: "m1", name: "Amaka Obi", email: null, hasWishlist: true, isMe: true, isOrganiser: true });
  });

  it("maps a member's address and drops taking_part", () => {
    const member = toParticipantLine({
      member_id: "m2",
      display_name: "Ifeoma Nwosu",
      email: "ifeoma.nwosu@gmail.com",
      has_wishlist: false,
      is_me: false,
      is_organiser: false,
      taking_part: true,
    });
    expect(member.email).toBe("ifeoma.nwosu@gmail.com");
    expect(member.hasWishlist).toBe(false);
    expect("takingPart" in member).toBe(false);
  });
});

describe("summariseReadiness (GCO-006, GCO-008)", () => {
  const row = (name: string, over: Partial<ReadinessRow> = {}): ReadinessRow => ({
    memberId: `m-${name}`,
    name,
    isMe: false,
    hasWishlist: false,
    nudgedRecently: false,
    ...over,
  });

  it("counts everyone taking part, the organiser included, and who has a list in", () => {
    const rows = [row("Amaka Obi", { isMe: true, hasWishlist: true }), row("Ifeoma Nwosu", { hasWishlist: true }), row("Emeka Okafor"), row("Tolu Adeyemi")];
    const summary = summariseReadiness(rows);
    expect(summary.total).toBe(4);
    expect(summary.inCount).toBe(2);
    expect(summary.missing.map((m) => m.name)).toEqual(["Emeka Okafor", "Tolu Adeyemi"]);
  });

  it("never offers the organiser's own missing list to a nudge", () => {
    const summary = summariseReadiness([row("Amaka Obi", { isMe: true }), row("Emeka Okafor", { hasWishlist: true })]);
    expect(summary.missing).toEqual([]);
    expect(summary.targets).toEqual([]);
  });

  it("keeps recently nudged people in missing but out of the targets", () => {
    const summary = summariseReadiness([row("Emeka Okafor", { nudgedRecently: true }), row("Tolu Adeyemi")]);
    expect(summary.missing).toHaveLength(2);
    expect(summary.targets).toEqual([{ memberId: "m-Tolu Adeyemi", name: "Tolu Adeyemi" }]);
  });

  it("gives targets only a member id and a name", () => {
    const [target] = summariseReadiness([row("Emeka Okafor")]).targets;
    expect(Object.keys(target ?? {}).sort()).toEqual(["memberId", "name"]);
  });
});

describe("Nudge copy (boards Org-Nudge-*, Exchange-Detail-obefore and -ojust; owner decisions 2026-11-18)", () => {
  it("matches the readiness block", () => {
    expect(NUDGE_COPY.cardMeta("Fri 27 Nov")).toBe("Needs you by Fri 27 Nov");
    expect(NUDGE_COPY.cardTitle(5, 8)).toBe("5 of 8 wishlists are in");
    expect(NUDGE_COPY.cardBodyMany("Emeka, Tolu and Ada")).toBe("Emeka, Tolu and Ada haven't added theirs.");
    expect(NUDGE_COPY.cardBodyOne("Seun")).toBe("Seun hasn't added theirs yet.");
    expect(NUDGE_COPY.cardAction(3, "Emeka")).toBe("Nudge 3 people…");
    expect(NUDGE_COPY.cardAction(1, "Seun")).toBe("Nudge Seun…");
  });

  it("matches the page header", () => {
    expect(`${NUDGE_COPY.headerWishlists(5, 8)} ${NUDGE_COPY.headerDrawOn("Fri 27 Nov")}`).toBe("5 of 8 wishlists are in. Names are drawn Fri 27 Nov.");
    expect(`${NUDGE_COPY.headerPeople(4)} ${NUDGE_COPY.headerDrawOn("Fri 4 Dec")}`).toBe("4 people are in. Names are drawn Fri 4 Dec.");
  });

  it("matches the sheet", () => {
    expect(NUDGE_COPY.title(3, "")).toBe("Nudge 3 people?");
    expect(NUDGE_COPY.title(1, "Seun")).toBe("Nudge Seun?");
    expect(NUDGE_COPY.preview("Amaka", "Family Christmas 2026", "Fri 27 Nov")).toBe(
      "“Amaka is waiting on your wishlist for Family Christmas 2026. Names are drawn Fri 27 Nov.”",
    );
    expect(NUDGE_COPY.privacy).toBe("Anyone nudged in the last 12 hours is skipped.");
    expect(NUDGE_COPY.recentTitle).toBe("Everyone was nudged recently");
    expect(NUDGE_COPY.recentBody).toBe("Everyone here was nudged in the last 12 hours. Give them a little time.");
    expect(NUDGE_COPY.bodyOffline).toBe("You're offline. You can send this once you're back online. They'll get this by email:");
    expect(NUDGE_COPY.sentToast("Emeka, Tolu and Ada")).toBe("Nudge sent to Emeka, Tolu and Ada.");
    expect(NUDGE_COPY.nudgeAll(3)).toBe("Nudge all 3…");
  });

  it("says the same thing the email says for a manual draw (owner decision 2)", () => {
    expect(NUDGE_COPY.preview("Amaka", "Book club", null)).toContain("Names are drawn when Amaka is ready.");
  });

  it("uses the approved failure and rate-limit lines", () => {
    expect(NUDGE_COPY.failed).toBe("We couldn't send the nudge. Nothing was sent, so you can try again.");
    expect(NUDGE_COPY.rateLimited).toBe("You've sent a lot of nudges in the last hour. Try again later.");
  });
});
