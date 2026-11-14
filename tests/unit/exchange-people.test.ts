import { describe, expect, it } from "vitest";
import { yourListSubline } from "@/features/exchange-list/copy";
import { joinedToday, peopleIn, peopleSentence, peopleStackLabel } from "@/features/exchanges/people";
import type { PersonLine } from "@/features/exchanges/types";

const org: PersonLine = { name: "Ngozi Eze", isOrganiser: true, isMe: false };
const femi: PersonLine = { name: "Femi Adeyemi", isOrganiser: false, isMe: false };
const me: PersonLine = { name: "Amaka Obi", isOrganiser: false, isMe: true };
const meOrg: PersonLine = { name: "Amaka Obi", isOrganiser: true, isMe: true };

describe("People section (GC-013)", () => {
  it("names the organiser, then the others, then 'you'", () => {
    expect(peopleSentence([org, femi, me])).toBe("Ngozi Eze (organising), Femi Adeyemi and you.");
    expect(peopleSentence([org, me])).toBe("Ngozi Eze (organising) and you.");
  });
  it("puts an organising viewer first", () => {
    expect(peopleSentence([meOrg, femi])).toBe("You (organising) and Femi Adeyemi.");
  });
  it("labels the stack with a count", () => {
    expect(peopleStackLabel([org, me])).toBe("2 people: Ngozi Eze (organising) and you.");
  });
  it("counts only people taking part", () => {
    expect(peopleIn(true, 4)).toBe(4);
    expect(peopleIn(false, 4)).toBe(3);
    expect(peopleIn(false, 1)).toBe(0);
  });
});

describe("joinedToday", () => {
  it("compares the date in the viewer's zone", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    expect(joinedToday("2026-11-13T00:30:00Z", now, "Africa/Lagos")).toBe(true);
    // The same moments in Honolulu (UTC-10): joined on the 12th, now the 13th.
    expect(joinedToday("2026-11-13T00:30:00Z", now, "Pacific/Honolulu")).toBe(false);
    expect(joinedToday("2026-11-12T10:00:00Z", now, "Africa/Lagos")).toBe(false);
  });
});

describe("yourListSubline", () => {
  it("follows the boards for each source", () => {
    expect(yourListSubline({ source: "wishlist", name: "My Christmas wishlist", itemCount: 6 }, "participant")).toBe(
      "From 'My Christmas wishlist'. 6 items. You can change it until the draw.",
    );
    expect(yourListSubline({ source: "ideas", name: null, itemCount: 2 }, "organiser")).toBe(
      "Only for this exchange. 2 items. You can change them until the draw.",
    );
    expect(yourListSubline({ source: "none", name: null, itemCount: 0 }, "participant")).toBe(
      "Nothing yet. Your giver has nothing to go on.",
    );
    expect(yourListSubline({ source: "none", name: null, itemCount: 0 }, "organiser")).toBe(
      "Nothing yet. Add one so your giver has ideas.",
    );
  });
});
