import { describe, expect, it } from "vitest";
import { firstName, sharedIntro } from "../../features/shared-wishlist/copy.ts";
import { parsePublicWishlist } from "../../features/shared-wishlist/parse.ts";
import { buildWhatsAppMessage, itemSub, whatsAppHref } from "../../features/wishlists/copy.ts";
import { isUuid, isVisibility } from "../../lib/validation/wishlist.ts";

const item = { name: "Gold hoops", link: "https://shop.example/h", price_kobo: 2_500_000, priority: "most_wanted", note: null };

describe("parsePublicWishlist (GC-023: only the fields the function returns)", () => {
  it("reads the payload into exactly the public fields", () => {
    expect(parsePublicWishlist({ name: "Birthday", owner_display_name: "Amaka Obi", items: [item] })).toEqual({
      name: "Birthday",
      ownerDisplayName: "Amaka Obi",
      items: [{ name: "Gold hoops", link: "https://shop.example/h", priceKobo: 2_500_000, priority: "most_wanted", note: null }],
    });
  });
  it("copies only named fields, so an extra key never reaches a component", () => {
    const parsed = parsePublicWishlist({
      name: "B",
      owner_display_name: "A",
      owner_id: "secret",
      items: [{ ...item, id: "x", reserved_by: "someone" }],
    });
    expect(Object.keys(parsed ?? {}).sort()).toEqual(["items", "name", "ownerDisplayName"]);
    expect(Object.keys(parsed?.items[0] ?? {}).sort()).toEqual(["link", "name", "note", "priceKobo", "priority"]);
  });
  it("accepts an empty list", () => {
    expect(parsePublicWishlist({ name: "B", owner_display_name: "A", items: [] })?.items).toEqual([]);
  });
  it("treats null and anything malformed as unavailable", () => {
    for (const bad of [null, undefined, "x", 3, [], {}, { name: "B", owner_display_name: "A" }, { name: 1, owner_display_name: "A", items: [] }]) {
      expect(parsePublicWishlist(bad)).toBeNull();
    }
    expect(parsePublicWishlist({ name: "B", owner_display_name: "A", items: [{ ...item, priority: "urgent" }] })).toBeNull();
    expect(parsePublicWishlist({ name: "B", owner_display_name: "A", items: [{ ...item, price_kobo: "5" }] })).toBeNull();
  });
  it("drops a link that is not http(s), so it can never become a javascript: href", () => {
    for (const link of ["javascript:alert(1)", "data:text/html,x", "ftp://x.y", "https://a b"]) {
      const parsed = parsePublicWishlist({ name: "B", owner_display_name: "A", items: [{ ...item, link }] });
      expect(parsed?.items[0]?.link).toBeNull();
    }
  });
});

describe("sharedIntro (owner answers 2026-11-08)", () => {
  it("uses number words for 2 to 10 and the first name only", () => {
    expect(sharedIntro(4, "Amaka Obi")).toBe("Four things Amaka would love. Tap one to see where to get it.");
    expect(sharedIntro(2, "Amaka")).toBe("Two things Amaka would love. Tap one to see where to get it.");
    expect(sharedIntro(10, "Amaka")).toBe("Ten things Amaka would love. Tap one to see where to get it.");
  });
  it("uses digits above ten", () => {
    expect(sharedIntro(11, "Amaka")).toBe("11 things Amaka would love. Tap one to see where to get it.");
  });
  it("has a singular line for one", () => {
    expect(sharedIntro(1, "Amaka Obi")).toBe("One thing Amaka would love. Tap it to see where to get it.");
  });
  it("has no line for none (the empty state replaces it)", () => {
    expect(sharedIntro(0, "Amaka")).toBeNull();
  });
  it("firstName takes the first word and tolerates extra spaces", () => {
    expect(firstName("  Amaka   Obi ")).toBe("Amaka");
    expect(firstName("Amaka")).toBe("Amaka");
  });
});

describe("WhatsApp message (GC-022)", () => {
  it("matches the story text", () => {
    expect(buildWhatsAppMessage("Birthday list", "https://x.test/w/abc")).toBe(
      'Here\'s my wishlist, "Birthday list", on Unwrap. Take a look: https://x.test/w/abc',
    );
  });
  it("is URL-encoded into a wa.me link", () => {
    const href = whatsAppHref("Mum & Dad", "https://x.test/w/abc");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1] ?? "")).toBe(buildWhatsAppMessage("Mum & Dad", "https://x.test/w/abc"));
  });
});

describe("itemSub (shared by the owner and public rows)", () => {
  it("reads like the board", () => {
    expect(itemSub({ priceKobo: 850_000, priority: "most_wanted", note: "Any colour but brown." })).toBe(
      "₦8,500 · Most wanted. Any colour but brown.",
    );
    expect(itemSub({ priceKobo: null, priority: "nice_to_have", note: null })).toBe("Nice to have");
  });
});

describe("setWishlistVisibility and setDefaultVisibility input checks", () => {
  it("accepts only the two enum values, with no default", () => {
    expect(isVisibility("private")).toBe(true);
    expect(isVisibility("link")).toBe(true);
    for (const bad of ["public", "", "LINK", null, undefined, 1, {}]) expect(isVisibility(bad)).toBe(false);
  });
  it("needs a real uuid for the list id", () => {
    expect(isUuid("b0000000-0000-4000-8000-000000000011")).toBe(true);
    for (const bad of ["", "abc", null, undefined, "b0000000-0000-4000-8000-00000000001"]) expect(isUuid(bad)).toBe(false);
  });
});
