import { describe, expect, it } from "vitest";
import { afterListIntro, LIST_COPY, removeTitle, wishlistRemovedToast } from "@/features/exchange-list/copy";
import { GIFT_COPY } from "@/features/gifting/copy";
import { parseRecipientList, rowBadge, spendWords } from "@/features/gifting/format";
import { budgetFit, budgetRangePhrase, type BudgetPreset } from "@/lib/money/budget";

const item = (over: Record<string, unknown> = {}) => ({
  ref: "0123456789abcdef0123456789abcdef",
  name: "Noise-cancelling earbuds",
  priority: "most_wanted",
  note: "Anything that fits small ears.",
  price_kobo: 2_200_000,
  link: "https://shop.example/earbuds",
  updated: true,
  got: false,
  ...over,
});

const answer = (over: Record<string, unknown> = {}) => ({
  display_name: "Kemi Bello",
  avatar_path: null,
  list_state: "items",
  items: [item()],
  taken_off: [{ ref: "fedcba9876543210fedcba9876543210", name: "Silk pillowcase" }],
  ...over,
});

describe("parseRecipientList (GC-015, AC-4)", () => {
  it("reads the person, the items and the taken-off items", () => {
    expect(parseRecipientList(answer())).toEqual({
      displayName: "Kemi Bello",
      avatarPath: null,
      listState: "items",
      items: [
        {
          ref: "0123456789abcdef0123456789abcdef",
          name: "Noise-cancelling earbuds",
          priority: "most_wanted",
          note: "Anything that fits small ears.",
          priceKobo: 2_200_000,
          link: "https://shop.example/earbuds",
          updated: true,
          got: false,
        },
      ],
      takenOff: [{ ref: "fedcba9876543210fedcba9876543210", name: "Silk pillowcase" }],
    });
  });

  it("keeps an item with no note, price or link", () => {
    const parsed = parseRecipientList(answer({ items: [item({ note: null, price_kobo: null, link: null, priority: "nice_to_have" })] }));
    expect(parsed?.items[0]).toMatchObject({ note: null, priceKobo: null, link: null, priority: "nice_to_have" });
  });

  it("refuses the whole answer on an extra key at any level", () => {
    expect(parseRecipientList({ ...answer(), list_name: "My Christmas wishlist" })).toBeNull();
    expect(parseRecipientList(answer({ items: [item({ id: "11111111-1111-4111-8111-111111111111" })] }))).toBeNull();
    expect(parseRecipientList(answer({ taken_off: [{ ref: "a".repeat(32), name: "X", wishlist_id: "w" }] }))).toBeNull();
  });

  it("refuses a missing key", () => {
    const noTaken: Record<string, unknown> = answer();
    delete noTaken.taken_off;
    expect(parseRecipientList(noTaken)).toBeNull();
    const noGot: Record<string, unknown> = item();
    delete noGot.got;
    expect(parseRecipientList(answer({ items: [noGot] }))).toBeNull();
  });

  it("refuses a bad list state, priority, price, flag or blank name", () => {
    expect(parseRecipientList(answer({ list_state: "all" }))).toBeNull();
    expect(parseRecipientList(answer({ items: [item({ priority: "urgent" })] }))).toBeNull();
    expect(parseRecipientList(answer({ items: [item({ price_kobo: 1.5 })] }))).toBeNull();
    expect(parseRecipientList(answer({ items: [item({ price_kobo: -1 })] }))).toBeNull();
    expect(parseRecipientList(answer({ items: [item({ got: "no" })] }))).toBeNull();
    expect(parseRecipientList(answer({ items: [item({ name: "  " })] }))).toBeNull();
    expect(parseRecipientList(answer({ display_name: "" }))).toBeNull();
    expect(parseRecipientList(answer({ items: "none" }))).toBeNull();
    expect(parseRecipientList(null)).toBeNull();
    expect(parseRecipientList([answer()])).toBeNull();
  });

  it("drops a link that is not http or https, so it can never become a script, and keeps the list", () => {
    for (const link of ["javascript:alert(1)", "data:text/html,x", "not a url", "https://[x"]) {
      const parsed = parseRecipientList(answer({ items: [item({ link }), item({ ref: "r2" })] }));
      expect(parsed?.items).toHaveLength(2);
      expect(parsed?.items[0]?.link).toBeNull();
    }
    expect(parseRecipientList(answer({ items: [item({ link: "http://shop.example" })] }))?.items[0]?.link).toBe("http://shop.example");
    expect(parseRecipientList(answer({ items: [item({ link: 5 })] }))).toBeNull();
  });
});

describe("budgetFit (GC-015, integer kobo)", () => {
  const cases: Array<[BudgetPreset, number | null, "within" | "over" | "under" | null]> = [
    ["10k_20k", null, null],
    ["10k_20k", 999_999, "under"],
    ["10k_20k", 1_000_000, "within"],
    ["10k_20k", 2_000_000, "within"],
    ["10k_20k", 2_000_100, "over"],
    ["50k_plus", 4_999_900, "under"],
    ["50k_plus", 5_000_000, "within"],
    ["50k_plus", 100_000_000_000, "within"],
    ["5k_10k", 500_000, "within"],
    ["5k_10k", 1_000_001, "over"],
  ];
  it.each(cases)("%s with %s kobo is %s", (preset, kobo, fit) => {
    expect(budgetFit(preset, kobo)).toBe(fit);
  });

  it("writes the range after 'the', with the top preset as 'and above'", () => {
    expect(budgetRangePhrase("10k_20k")).toBe("₦10,000 to ₦20,000");
    expect(budgetRangePhrase("50k_plus")).toBe("₦50,000 and above");
  });
});

describe("rowBadge: one badge per row (owner decision 2026-11-23)", () => {
  it("puts You got this before Over budget before Updated", () => {
    expect(rowBadge({ got: true, updated: true }, "over")).toBe("got");
    expect(rowBadge({ got: false, updated: true }, "over")).toBe("over");
    expect(rowBadge({ got: false, updated: true }, "within")).toBe("updated");
    expect(rowBadge({ got: false, updated: false }, "under")).toBeNull();
    expect(rowBadge({ got: false, updated: false }, null)).toBeNull();
  });
});

describe("copy (AC-10)", () => {
  it("uses the board and story strings exactly", () => {
    expect(GIFT_COPY.emptyTitle).toBe("They haven't added anything yet");
    expect(GIFT_COPY.noLink).toBe("No shop link. The name and note are all there is.");
    expect(GIFT_COPY.marked("Noise-cancelling earbuds")).toBe("Marked “Noise-cancelling earbuds” as got. Only you can see this.");
    expect(GIFT_COPY.hint("Kemi")).toBe("Only you can see what you mark. Kemi never will.");
    expect(GIFT_COPY.budgetNote("within", "₦15,000 to ₦25,000")).toBe("Within the ₦15,000 to ₦25,000 budget.");
    expect(GIFT_COPY.budgetNote("over", "₦15,000 to ₦25,000")).toBe("Over the ₦15,000 to ₦25,000 budget.");
    expect(GIFT_COPY.budgetNote("under", "₦15,000 to ₦25,000")).toBe("Under the ₦15,000 to ₦25,000 budget.");
    expect(GIFT_COPY.intro("Kemi Bello", "₦15,000 to ₦25,000", "Sat 19 Dec")).toBe(
      "You're buying for Kemi Bello. Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec.",
    );
    expect(GIFT_COPY.takenOff("Kemi", "Noise-cancelling earbuds")).toBe(
      "Kemi took “Noise-cancelling earbuds” off the list after you marked it. You can still unmark it.",
    );
    expect(GIFT_COPY.cardTitle("Kemi")).toBe("You're buying for Kemi.");
    expect(GIFT_COPY.cardSub("₦15,000 to ₦25,000", "Sat 19 Dec")).toBe("Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec.");
    expect(GIFT_COPY.loadError("Kemi")).toBe("We couldn't load Kemi's wishlist. Nothing you marked is lost.");
    expect(GIFT_COPY.noListBody).toBe("The budget is your best guide for now.");
  });

  it("never names the person in the neutral lines the server renders", () => {
    expect(GIFT_COPY.loadingTitle).not.toMatch(/Kemi/);
    expect(GIFT_COPY.loadErrorNeutral).not.toMatch(/Kemi/);
  });

  it("lowercases 'Above' after Spend for the top preset only", () => {
    expect(spendWords("Above ₦50,000")).toBe("above ₦50,000");
    expect(spendWords("₦15,000 to ₦25,000")).toBe("₦15,000 to ₦25,000");
  });

  it("has the after-the-draw list lines (GC-010)", () => {
    expect(LIST_COPY.afterChooseIntro).toBe("Your giver will see the list you pick as soon as you attach it.");
    expect(LIST_COPY.afterToastAttached).toBe("Wishlist attached. Your giver can see it now.");
    expect(LIST_COPY.afterPrivacy).toBe("Only your giver can see it. Nobody else in the exchange can.");
    expect(LIST_COPY.removeBody).toBe(
      "Your giver won't see it any more. The list stays in your Wishlists, and you can attach it again later.",
    );
    expect(removeTitle("Church choir Kris Kringle")).toBe("Remove your wishlist from Church choir Kris Kringle?");
    expect(wishlistRemovedToast("Church choir Kris Kringle")).toBe("Wishlist removed from Church choir Kris Kringle.");
    expect(afterListIntro(6)).toBe("6 items. Only your giver can see them.");
    expect(afterListIntro(1)).toBe("1 item. Only your giver can see it.");
  });
});
