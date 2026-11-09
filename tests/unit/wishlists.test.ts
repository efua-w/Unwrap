import { describe, expect, it } from "vitest";
import { formatUpdated } from "../../lib/dates/format-updated.ts";
import { formatNaira, groupNairaInput, nairaInputFromKobo, NAIRA_MAX, parseNairaInput } from "../../lib/money/naira.ts";
import { clampCodePoints, normaliseSingleLine } from "../../lib/validation/text.ts";
import {
  isUuid,
  normaliseLink,
  normaliseNote,
  validateItemInput,
  validateWishlistInput,
} from "../../lib/validation/wishlist.ts";

describe("parseNairaInput (GC-021: whole naira, ₦1 to ₦1bn, stored as kobo)", () => {
  it("reads digits with or without thousands commas as kobo", () => {
    expect(parseNairaInput("8500")).toEqual({ ok: true, kobo: 850_000 });
    expect(parseNairaInput("8,500")).toEqual({ ok: true, kobo: 850_000 });
    expect(parseNairaInput(" ₦8,500 ")).toEqual({ ok: true, kobo: 850_000 });
    expect(parseNairaInput("007")).toEqual({ ok: true, kobo: 700 });
  });
  it("treats an empty field as no price", () => {
    expect(parseNairaInput("")).toEqual({ ok: true, kobo: null });
    expect(parseNairaInput("   ")).toEqual({ ok: true, kobo: null });
  });
  it("accepts ₦1 and exactly ₦1bn", () => {
    expect(parseNairaInput("1")).toEqual({ ok: true, kobo: 100 });
    expect(parseNairaInput(String(NAIRA_MAX))).toEqual({ ok: true, kobo: 100_000_000_000 });
    expect(parseNairaInput("1,000,000,000")).toEqual({ ok: true, kobo: 100_000_000_000 });
  });
  it("refuses kobo, decimals, signs, letters and ₦0 as not whole naira", () => {
    for (const bad of ["8500.50", "8500.", ".5", "-100", "+100", "1e3", "abc", "0", "0,000", ","]) {
      expect(parseNairaInput(bad), bad).toEqual({ ok: false, reason: "not-whole-naira" });
    }
  });
  it("refuses more than ₦1bn without losing precision on long input", () => {
    expect(parseNairaInput("1000000001")).toEqual({ ok: false, reason: "too-large" });
    expect(parseNairaInput("9".repeat(40))).toEqual({ ok: false, reason: "too-large" });
  });
  it("always returns an integer number of kobo", () => {
    const result = parseNairaInput("123456789");
    expect(result.ok && Number.isSafeInteger(result.kobo)).toBe(true);
  });
});

describe("formatNaira and nairaInputFromKobo", () => {
  it("shows exact ₦ amounts with thousands commas", () => {
    expect(formatNaira(850_000)).toBe("₦8,500");
    expect(formatNaira(100)).toBe("₦1");
    expect(formatNaira(100_000_000_000)).toBe("₦1,000,000,000");
    expect(formatNaira(1_400_000)).toBe("₦14,000");
  });
  it("gives grouped digits back for editing", () => {
    expect(nairaInputFromKobo(850_000)).toBe("8,500");
    expect(nairaInputFromKobo(null)).toBe("");
  });
});

describe("groupNairaInput", () => {
  it("adds a comma every three digits from the right as you type", () => {
    expect(groupNairaInput("300000")).toBe("300,000");
    expect(groupNairaInput("1000000000")).toBe("1,000,000,000");
    expect(groupNairaInput("3000,00")).toBe("300,000");
    expect(groupNairaInput("850")).toBe("850");
    expect(groupNairaInput("")).toBe("");
  });
  it("leaves anything that is not whole naira as typed", () => {
    expect(groupNairaInput("8500.50")).toBe("8500.50");
    expect(groupNairaInput("-500")).toBe("-500");
  });
  it("round-trips through the parser", () => {
    const parsed = parseNairaInput(groupNairaInput("300000"));
    expect(parsed).toEqual({ ok: true, kobo: 30_000_000 });
  });
});

describe("clampCodePoints and normaliseSingleLine", () => {
  it("counts code points like Postgres char_length and keeps graphemes whole", () => {
    expect(Array.from(clampCodePoints("🎁".repeat(70), 60))).toHaveLength(60);
    const family = "👨‍👩‍👧";
    expect(clampCodePoints(`${"a".repeat(58)}${family}`, 60)).toBe("a".repeat(58));
  });
  it("trims and collapses inner whitespace", () => {
    expect(normaliseSingleLine("  Birthday   list ", 60)).toBe("Birthday list");
    expect(normaliseSingleLine("   ", 60)).toBe("");
  });
});

describe("validateWishlistInput (GC-019)", () => {
  it("needs a name and starts Private", () => {
    expect(validateWishlistInput({ name: "  " })).toEqual({ ok: false, errors: { name: "missing" } });
    expect(validateWishlistInput({ name: "Birthday list" })).toEqual({
      ok: true,
      value: { name: "Birthday list", visibility: "private" },
    });
  });
  it("accepts exactly two visibility values", () => {
    expect(validateWishlistInput({ name: "x", visibility: "link" })).toMatchObject({ value: { visibility: "link" } });
    expect(validateWishlistInput({ name: "x", visibility: "public" })).toMatchObject({ value: { visibility: "private" } });
  });
  it("caps the name at 60 code points", () => {
    const result = validateWishlistInput({ name: "a".repeat(80) });
    expect(result.ok && result.value.name.length).toBe(60);
  });
  it("treats anything that is not an object as empty", () => {
    expect(validateWishlistInput(null)).toEqual({ ok: false, errors: { name: "missing" } });
  });
});

describe("normaliseLink (GC-021: stored only, https:// added)", () => {
  it("adds https:// to a link without a scheme", () => {
    expect(normaliseLink("jumia.com.ng/tote")).toEqual({ ok: true, link: "https://jumia.com.ng/tote" });
    expect(normaliseLink("shop.example:8080/x")).toEqual({ ok: true, link: "https://shop.example:8080/x" });
  });
  it("keeps http and https links as typed", () => {
    expect(normaliseLink(" https://www.jumia.com.ng/x ")).toEqual({ ok: true, link: "https://www.jumia.com.ng/x" });
    expect(normaliseLink("HTTP://shop.example")).toEqual({ ok: true, link: "HTTP://shop.example" });
  });
  it("is optional", () => {
    expect(normaliseLink("")).toEqual({ ok: true, link: null });
  });
  it("refuses other schemes, spaces and very long links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://shop.example", "mailto:a@b.c", "https://a b", "https://"]) {
      expect(normaliseLink(bad), bad).toEqual({ ok: false });
    }
    expect(normaliseLink(`https://shop.example/${"a".repeat(2048)}`)).toEqual({ ok: false });
  });
});

describe("normaliseNote", () => {
  it("keeps line breaks, trims the ends and stores a blank note as null", () => {
    expect(normaliseNote("  Size M.\nBlue tones.  ")).toBe("Size M.\nBlue tones.");
    expect(normaliseNote(" \n ")).toBeNull();
  });
  it("caps at 280 code points", () => {
    expect(Array.from(normaliseNote("a".repeat(300)) ?? "")).toHaveLength(280);
  });
});

describe("validateItemInput (GC-021)", () => {
  it("returns clean values with Nice to have as the default priority", () => {
    expect(validateItemInput({ name: " Ankara tote bag ", price: "8,500", link: "", note: "" })).toEqual({
      ok: true,
      value: { name: "Ankara tote bag", link: null, priceKobo: 850_000, priority: "nice_to_have", note: null },
    });
  });
  it("keeps a chosen priority", () => {
    expect(validateItemInput({ name: "x", priority: "most_wanted" })).toMatchObject({ value: { priority: "most_wanted" } });
  });
  it("reports every field error at once", () => {
    expect(validateItemInput({ name: "", price: "85.50", link: "ftp://x" })).toEqual({
      ok: false,
      errors: { name: "missing", price: "not-whole-naira", link: "invalid" },
    });
    expect(validateItemInput({ name: "x", price: "2000000000" })).toEqual({ ok: false, errors: { price: "too-large" } });
  });
});

describe("isUuid", () => {
  it("accepts only uuid text", () => {
    expect(isUuid("c0000000-0000-4000-8000-000000001001")).toBe(true);
    expect(isUuid("1")).toBe(false);
    expect(isUuid("c0000000-0000-4000-8000-000000001001' or 1=1")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe("formatUpdated (GC-018, owner rule 2026-11-05)", () => {
  const lagos = "Africa/Lagos";
  const now = new Date("2026-11-05T10:00:00Z"); // Thursday 5 November, 11:00 in Lagos

  it("says today, yesterday and N days ago up to 6", () => {
    expect(formatUpdated(new Date("2026-11-05T00:30:00Z"), now, lagos)).toBe("today");
    expect(formatUpdated(new Date("2026-11-04T09:00:00Z"), now, lagos)).toBe("yesterday");
    expect(formatUpdated(new Date("2026-11-03T09:00:00Z"), now, lagos)).toBe("2 days ago");
    expect(formatUpdated(new Date("2026-10-30T09:00:00Z"), now, lagos)).toBe("6 days ago");
  });
  it("shows the date after 6 days, with the year only when it is not this year", () => {
    expect(formatUpdated(new Date("2026-10-29T09:00:00Z"), now, lagos)).toBe("Thu 29 Oct");
    expect(formatUpdated(new Date("2026-09-09T09:00:00Z"), now, lagos)).toBe("Wed 9 Sep");
    expect(formatUpdated(new Date("2025-09-09T09:00:00Z"), now, lagos)).toBe("Tue 9 Sep 2025");
  });
  it("counts calendar days in the viewer's zone", () => {
    // 23:30 UTC on the 4th is already the 5th in Lagos (UTC+1), but still the 4th in London.
    const late = new Date("2026-11-04T23:30:00Z");
    expect(formatUpdated(late, now, lagos)).toBe("today");
    expect(formatUpdated(late, now, "Europe/London")).toBe("yesterday");
  });
  it("never shows a future date", () => {
    expect(formatUpdated(new Date("2026-11-06T10:00:00Z"), now, lagos)).toBe("today");
  });
});
