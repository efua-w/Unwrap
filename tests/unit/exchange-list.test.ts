import { describe, expect, it } from "vitest";
import {
  addedToast,
  attachFailed,
  budgetGuide,
  currentRow,
  ideaCountLabel,
  ideasHeading,
  listGone,
  priceHelper,
  removedToast,
  sourceSubline,
} from "../../features/exchange-list/copy.ts";
import { JOINED_COPY, joinedLine, joinedSteps, listStatus } from "../../features/exchange-list/joined.ts";
import { parseMyExchangeList } from "../../features/exchange-list/parse.ts";
import type { ExchangeListContext } from "../../features/exchange-list/types.ts";

const ID = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("parseMyExchangeList (GC-010, GC-011)", () => {
  const ok = { source: "wishlist", wishlist_id: ID, name: "My Christmas wishlist", item_count: 6 };

  it("reads each source", () => {
    expect(parseMyExchangeList(ok)).toEqual({ source: "wishlist", wishlistId: ID, name: "My Christmas wishlist", itemCount: 6 });
    expect(parseMyExchangeList({ source: "none", wishlist_id: null, name: null, item_count: 0 })).toEqual({
      source: "none",
      wishlistId: null,
      name: null,
      itemCount: 0,
    });
    expect(parseMyExchangeList({ ...ok, source: "ideas", name: null, item_count: 2 })?.source).toBe("ideas");
    expect(parseMyExchangeList({ ...ok, source: "kept" })?.source).toBe("kept");
  });

  it("refuses anything but the exact four keys", () => {
    expect(parseMyExchangeList({ ...ok, owner_id: ID })).toBeNull();
    expect(parseMyExchangeList({ source: ok.source, wishlist_id: ok.wishlist_id, item_count: ok.item_count })).toBeNull();
  });

  it("refuses wrong types and unknown sources", () => {
    expect(parseMyExchangeList(null)).toBeNull();
    expect(parseMyExchangeList([ok])).toBeNull();
    expect(parseMyExchangeList({ ...ok, source: "reserved" })).toBeNull();
    expect(parseMyExchangeList({ ...ok, wishlist_id: "nope" })).toBeNull();
    expect(parseMyExchangeList({ ...ok, name: 4 })).toBeNull();
    expect(parseMyExchangeList({ ...ok, item_count: -1 })).toBeNull();
    expect(parseMyExchangeList({ ...ok, item_count: 1.5 })).toBeNull();
    expect(parseMyExchangeList({ ...ok, item_count: "6" })).toBeNull();
  });
});

describe("source sublines (GC-010 Context D)", () => {
  it("names each source", () => {
    expect(sourceSubline("wishlist", "My Christmas wishlist")).toBe("From 'My Christmas wishlist'. Changes when you edit that list.");
    expect(sourceSubline("ideas", null)).toBe("Only for this exchange.");
    expect(sourceSubline("kept", "Old list")).toBe("Kept from a list you deleted. It can't be changed now.");
    expect(sourceSubline("none", null)).toBeNull();
    expect(sourceSubline("wishlist", null)).toBeNull();
  });
});

describe("list copy", () => {
  it("writes the budget guide for each audience", () => {
    expect(budgetGuide("participant", "5k_10k")).toBe(
      "Pick one of your wishlists, or add a few ideas just for this exchange. Gifts here cost ₦5,000 to ₦10,000, so ideas in that range help most.",
    );
    expect(budgetGuide("organiser", "10k_20k")).toBe(
      "Pick one of your wishlists, or add a few ideas just for this exchange. Everyone spends ₦10,000 to ₦20,000, so ideas in that range help most.",
    );
  });

  it("reads the top budget as more than, not Above", () => {
    expect(budgetGuide("participant", "50k_plus")).toContain("Gifts here cost more than ₦50,000,");
    expect(priceHelper("50k_plus")).toBe("Your budget here is more than ₦50,000.");
    expect(priceHelper("10k_20k")).toBe("Your budget here is ₦10,000 to ₦20,000.");
  });

  it("puts names in single quotes", () => {
    expect(addedToast("Ankara tote bag")).toBe("Added 'Ankara tote bag'.");
    expect(removedToast("Ankara tote bag")).toBe("Removed 'Ankara tote bag'.");
    expect(attachFailed("My Christmas wishlist")).toBe(
      "We couldn't attach 'My Christmas wishlist'. Nothing has changed, so you can try again.",
    );
    expect(listGone("Birthday list")).toBe("'Birthday list' was just deleted, so we refreshed your wishlists.");
  });

  it("counts ideas", () => {
    expect(ideasHeading(2)).toBe("Your list for this exchange (2)");
    expect(ideaCountLabel(1)).toBe("1 idea");
    expect(ideaCountLabel(2)).toBe("2 ideas");
  });

  it("writes the current row", () => {
    expect(currentRow({ source: "wishlist", name: "My Christmas wishlist", itemCount: 6 }, "Sat 31 Oct")).toEqual({
      title: "My Christmas wishlist",
      sub: "6 items · updated Sat 31 Oct",
    });
    expect(currentRow({ source: "wishlist", name: "A", itemCount: 1 }, null)?.sub).toBe("1 item");
    expect(currentRow({ source: "kept", name: "Old", itemCount: 3 }, null)?.sub).toBe(
      "Kept from a list you deleted. It can't be changed now.",
    );
    expect(currentRow({ source: "ideas", name: null, itemCount: 2 }, null)).toBeNull();
    expect(currentRow({ source: "none", name: null, itemCount: 0 }, null)).toBeNull();
  });
});

const exchange: ExchangeListContext = {
  id: ID,
  name: "Church choir Kris Kringle",
  tint: "mint",
  budget: "5k_10k",
  joinByAt: "2026-11-27T17:00:00+00:00",
  drawMode: "at_join_by",
  drawAt: "2026-11-27T17:00:00+00:00",
  giftDay: "2026-12-20",
  approvalRequired: false,
  isOrganiser: false,
  takingPart: true,
  organiserName: null,
};

describe("You're in (GC-011)", () => {
  it("says there is nothing else to do", () => {
    expect(joinedLine("Church choir Kris Kringle")).toBe(
      "You joined Church choir Kris Kringle. There's nothing else to do until names are drawn.",
    );
    expect(JOINED_COPY.nothingElse).toBe("There's nothing else to do until names are drawn.");
  });

  it("shows the draw moment in the viewer's zone and the gift day as stored", () => {
    const [draw, gifts] = joinedSteps(exchange, "Africa/Lagos");
    expect(draw?.title).toBe("Names are drawn");
    expect(draw?.detail).toBe("Fri 27 Nov, 6:00 pm");
    expect(gifts?.detail).toBe("Sun 20 Dec");
    // Another zone moves the draw, never the gift day.
    const [elsewhere, giftsElsewhere] = joinedSteps(exchange, "America/New_York");
    expect(elsewhere?.detail).toBe("Fri 27 Nov, 12:00 pm");
    expect(giftsElsewhere?.detail).toBe("Sun 20 Dec");
  });

  it("names who draws when the organiser draws", () => {
    const manual = { ...exchange, drawMode: "organiser_chooses" as const, drawAt: null, organiserName: "Ngozi Eze" };
    expect(joinedSteps(manual, "Africa/Lagos")[0]?.detail).toBe("When Ngozi is ready");
    expect(joinedSteps({ ...manual, organiserName: null }, "Africa/Lagos")[0]?.detail).toBe("When the organiser is ready");
  });

  it("makes no reminder or email promise", () => {
    const steps = joinedSteps(exchange, "Africa/Lagos");
    const missing = listStatus({ source: "none", wishlistId: null, name: null, itemCount: 0 }, "Fri 27 Nov");
    expect(JSON.stringify([steps, JOINED_COPY, missing])).not.toMatch(/email|remind|share/i);
  });

  it("describes the list status by source", () => {
    expect(listStatus({ source: "wishlist", wishlistId: ID, name: "My Christmas wishlist", itemCount: 6 }, "Fri 27 Nov")).toEqual({
      missing: false,
      title: "My Christmas wishlist",
      sub: "From 'My Christmas wishlist'. Changes when you edit that list.",
      below: "6 items. You can change it until names are drawn.",
    });
    expect(listStatus({ source: "ideas", wishlistId: ID, name: null, itemCount: 2 }, "Fri 27 Nov")).toEqual({
      missing: false,
      title: "2 ideas",
      sub: "Only for this exchange.",
      below: "You can change it until names are drawn.",
    });
    expect(listStatus({ source: "kept", wishlistId: ID, name: "Old", itemCount: 3 }, "Fri 27 Nov").below).toBe(
      "3 items. Your giver will see them after the draw.",
    );
    expect(listStatus({ source: "none", wishlistId: null, name: null, itemCount: 0 }, "Fri 27 Nov")).toEqual({
      missing: true,
      title: "No list yet",
      sub: "Add one before Fri 27 Nov.",
      below: null,
    });
  });
});
