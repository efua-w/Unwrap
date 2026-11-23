import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DRAW_COPY } from "@/features/draw/copy";
import { drawnBody, parseAssignment, parseMostWanted, parseRecipient, parseSummary, peopleStillNeeded } from "@/features/draw/format";
import { clearHidden, hiddenKey, isHidden, setHidden, type KeyValueStore } from "@/features/draw/storage";
import { drawnListSubline } from "@/features/exchange-list/copy";

const A = "33333333-3333-4333-8333-333333333333";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const recipientRow = (over: Record<string, unknown> = {}) => ({
  display_name: "Kemi Bello",
  avatar_path: null,
  list_state: "items",
  most_wanted: [{ ref: "abc", name: "Noise-cancelling earbuds", price_kobo: 2_200_000 }],
  ...over,
});

describe("parseRecipient (GC-014, AC-5, AC-6)", () => {
  it("reads the person and their Most wanted items, dropping the link reference", () => {
    const r = parseRecipient(recipientRow());
    expect(r).toEqual({
      displayName: "Kemi Bello",
      avatarPath: null,
      listState: "items",
      mostWanted: [{ name: "Noise-cancelling earbuds", priceKobo: 2_200_000 }],
    });
    expect(JSON.stringify(r)).not.toContain("abc");
  });

  it("refuses an answer with an extra key such as a list name or an id", () => {
    expect(parseRecipient(recipientRow({ list_name: "Wishes" }))).toBeNull();
    expect(parseRecipient(recipientRow({ receiver_member_id: A }))).toBeNull();
  });

  it("refuses a missing key, a bad list state and a blank name", () => {
    const partial: Record<string, unknown> = recipientRow();
    delete partial.most_wanted;
    expect(parseRecipient(partial)).toBeNull();
    expect(parseRecipient(recipientRow({ list_state: "other" }))).toBeNull();
    expect(parseRecipient(recipientRow({ display_name: "  " }))).toBeNull();
  });

  it("refuses an item with extra keys or a bad price", () => {
    expect(parseMostWanted([{ ref: "a", name: "X", price_kobo: 1, link: "https://x" }])).toBeNull();
    expect(parseMostWanted([{ ref: "a", name: "X", price_kobo: 1.5 }])).toBeNull();
    expect(parseMostWanted([{ ref: "a", name: "X", price_kobo: -1 }])).toBeNull();
    expect(parseMostWanted("nope")).toBeNull();
  });

  it("keeps an item with no price", () => {
    expect(parseMostWanted([{ ref: "a", name: "Candle", price_kobo: null }])).toEqual([{ name: "Candle", priceKobo: null }]);
  });
});

describe("parseAssignment and parseSummary", () => {
  it("reads exactly the id and the flag", () => {
    expect(parseAssignment({ assignment_id: A, revealed: false })).toEqual({ assignmentId: A, revealed: false });
    expect(parseAssignment({ assignment_id: A, revealed: false, receiver_member_id: A })).toBeNull();
    expect(parseAssignment({ assignment_id: "x", revealed: false })).toBeNull();
    expect(parseAssignment({ assignment_id: A, revealed: "no" })).toBeNull();
  });

  it("reads the organiser's count and time and caps told at the people", () => {
    const row = { people_count: 8, drawn_at: "2026-11-27T17:00:00+00:00", emails_queued: 8 };
    expect(parseSummary(row)).toEqual({ peopleCount: 8, drawnAt: "2026-11-27T17:00:00+00:00", told: 8 });
    expect(parseSummary({ ...row, emails_queued: 12 })?.told).toBe(8);
  });

  it("refuses an extra key, such as a giver", () => {
    expect(parseSummary({ people_count: 8, drawn_at: "2026-11-27T17:00:00+00:00", emails_queued: 8, giver: A })).toBeNull();
    expect(parseSummary({ people_count: 0, drawn_at: "2026-11-27T17:00:00+00:00", emails_queued: 0 })).toBeNull();
    expect(parseSummary({ people_count: 8, drawn_at: "soon", emails_queued: 8 })).toBeNull();
  });
});

describe("how many more people the draw needs (GCO-011)", () => {
  it("is 3 minus the people, never negative", () => {
    expect([0, 1, 2, 3, 8].map(peopleStillNeeded)).toEqual([3, 2, 1, 0, 0]);
  });
});

describe("Hide again, per device (GC-014)", () => {
  it("keys the flag by the assignment id and stores only a flag", () => {
    const store = memoryStore();
    expect(isHidden(store, A)).toBe(false);
    setHidden(store, A);
    expect(isHidden(store, A)).toBe(true);
    expect([...store.data.entries()]).toEqual([[hiddenKey(A), "1"]]);
    clearHidden(store, A);
    expect(isHidden(store, A)).toBe(false);
  });

  it("does not carry over to another assignment", () => {
    const store = memoryStore();
    setHidden(store, A);
    expect(isHidden(store, "44444444-4444-4444-8444-444444444444")).toBe(false);
  });

  it("says hidden when the browser refuses storage, so a name is never shown unasked", () => {
    expect(isHidden(null, A)).toBe(true);
    const blocked = () => {
      throw new Error("blocked");
    };
    const broken: KeyValueStore = { getItem: blocked, setItem: blocked, removeItem: blocked };
    expect(isHidden(broken, A)).toBe(true);
    expect(() => setHidden(broken, A)).not.toThrow();
    expect(() => clearHidden(broken, A)).not.toThrow();
  });
});

describe("draw copy (boards Org-Draw-*, Org-Drawn-*)", () => {
  it("words the sheet body from the board", () => {
    expect(DRAW_COPY.bodyMissing(8, 5, ["Emeka", "Tolu", "Ada"])).toBe(
      "8 people are taking part and 5 wishlists are in. Emeka, Tolu and Ada haven't added one, so their givers will have less to go on. This can't be undone.",
    );
    expect(DRAW_COPY.bodyMissing(4, 3, ["Seun"])).toBe(
      "4 people are taking part and 3 wishlists are in. Seun hasn't added one, so their giver will have less to go on. This can't be undone.",
    );
  });

  it("words the exclusions note and the too-few bodies from the boards", () => {
    expect(DRAW_COPY.noteOnePair("Nneka", "Obinna")).toBe("Exclusions: Nneka and Obinna won't draw each other.");
    expect(DRAW_COPY.fewNobody("Book club gift swap", "Fri 4 Dec")).toBe(
      "Names need at least 3 people to draw. Nobody has joined Book club gift swap yet. Share the invite link and people can join until Fri 4 Dec.",
    );
    expect(DRAW_COPY.fewWithYou(["Ifeoma"], 1, "Fri 27 Nov")).toBe(
      "Names need at least 3 people to draw. You and Ifeoma are in, so 1 more person needs to join. People can join until Fri 27 Nov.",
    );
    expect(DRAW_COPY.exclBody(6, 8)).toBe(
      "With 6 exclusion pairs among 8 people, there's no way to give everyone a person. Remove a pair or invite more people, then try again.",
    );
  });

  it("counts people told as '{told} of {n}' (owner Q3)", () => {
    expect(DRAW_COPY.toldValue(8, 8)).toBe("8 of 8 people, by email");
    expect(DRAW_COPY.toldValue(6, 8)).toBe("6 of 8 people, by email");
    expect(DRAW_COPY.drawnSentence(8, 8)).toContain("all 8 people were told by email");
    expect(DRAW_COPY.drawnSentence(6, 8)).toContain("6 of 8 people were told by email");
  });

  it("uses the board's page body only when everyone was emailed", () => {
    const s = { peopleCount: 8, drawnAt: "2026-11-27T17:00:00+00:00" };
    expect(drawnBody({ ...s, told: 8 })).toBe(DRAW_COPY.drawnBody);
    expect(drawnBody({ ...s, told: 5 })).toBe(DRAW_COPY.drawnBodyPartial);
  });
});

describe("the list row after the draw (boards Exchange-Detail-drawn)", () => {
  it("says who sees the list", () => {
    expect(drawnListSubline({ source: "wishlist", name: "My Christmas wishlist", itemCount: 6 })).toBe(
      "From 'My Christmas wishlist'. 6 items. Only your giver can see them.",
    );
    expect(drawnListSubline({ source: "ideas", name: null, itemCount: 1 })).toBe("Only for this exchange. 1 item. Only your giver can see it.");
    expect(drawnListSubline({ source: "none", name: null, itemCount: 0 })).toBe("Nothing yet. Your giver has nothing to go on.");
  });
});

// AC-12: the recipient's name is never in server-rendered HTML. WHY a source check: the only code that may reach the
// person is a Server Action called from a client component after the giver asks, so no server component or query may
// mention it. A render-time read added here later fails this test.
describe("the recipient is read only by Server Actions (AC-12)", () => {
  const serverSide = [
    "app/(app)/exchanges/[id]/reveal/page.tsx",
    "app/(app)/exchanges/[id]/drawn/page.tsx",
    "app/(app)/exchanges/[id]/page.tsx",
    "app/(app)/exchanges/page.tsx",
    "features/draw/components/RevealContent.tsx",
    "features/draw/components/DrawnContent.tsx",
    "features/draw/queries.ts",
    "features/exchanges/components/ExchangeDrawn.tsx",
  ];

  it.each(serverSide)("%s never asks for the recipient", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/get_my_recipient|loadRecipient|revealRecipient|readRecipient|parseRecipient/);
  });

  it("the actions that read the person are Server Actions", () => {
    const source = readFileSync("features/draw/actions.ts", "utf8");
    expect(source.startsWith('"use server"')).toBe(true);
    expect(source).toContain("get_my_recipient");
  });

  it("the clients that show the person are client components", () => {
    for (const file of ["features/draw/components/RevealFlow.tsx", "features/draw/components/RecipientRow.tsx"]) {
      expect(readFileSync(file, "utf8").startsWith('"use client"')).toBe(true);
    }
  });
});
