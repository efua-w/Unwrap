import { describe, expect, it } from "vitest";
import { cardKey, dismissCard, isDismissed, resetCard, subscribeCards } from "@/features/draw/card-dismiss";
import type { KeyValueStore } from "@/features/draw/storage";

const A = "33333333-3333-4333-8333-333333333333";
const B = "44444444-4444-4444-8444-444444444444";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const broken: KeyValueStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("card dismissal (owner request 2026-11-23, mid-slice change to slice 10)", () => {
  it("keys by kind and subject, so another kind or another subject is a different card", () => {
    expect(cardKey("wishlist", A)).not.toBe(cardKey("reveal", A));
    expect(cardKey("reveal", A)).not.toBe(cardKey("reveal", B));
    expect(cardKey("reveal", A)).toBe(cardKey("reveal", A));
  });

  it("stores only a flag under the id, never a name", () => {
    const store = memoryStore();
    // WHY a subject no other test uses: the session memory is module state and outlives a test.
    dismissCard(store, cardKey("reveal", "flag-only"));
    expect([...store.data.entries()]).toEqual([[cardKey("reveal", "flag-only"), "1"]]);
  });

  it("hides the dismissed card and no other", () => {
    const store = memoryStore();
    dismissCard(store, cardKey("wishlist", A));
    expect(isDismissed(store, cardKey("wishlist", A))).toBe(true);
    expect(isDismissed(store, cardKey("wishlist", B))).toBe(false);
    expect(isDismissed(store, cardKey("reveal", A))).toBe(false);
  });

  it("shows the card when storage cannot be read, and still hides it for the session when it cannot be written", () => {
    expect(isDismissed(null, cardKey("reveal", "never-set"))).toBe(false);
    expect(isDismissed(broken, cardKey("reveal", "never-set"))).toBe(false);
    dismissCard(broken, cardKey("reveal", "session-only"));
    expect(isDismissed(broken, cardKey("reveal", "session-only"))).toBe(true);
    resetCard(broken, cardKey("reveal", "session-only"));
    expect(isDismissed(broken, cardKey("reveal", "session-only"))).toBe(false);
  });

  it("resets the flag when the card's condition is gone, so a later card for that subject shows", () => {
    const store = memoryStore();
    const key = cardKey("reveal", "reset-me");
    dismissCard(store, key);
    resetCard(store, key);
    expect(isDismissed(store, key)).toBe(false);
    expect(store.data.size).toBe(0);
  });

  it("tells subscribers when a card is dismissed or reset (both placements follow)", () => {
    const store = memoryStore();
    const key = cardKey("wishlist", "notify-me");
    let calls = 0;
    // WHY the window stub: subscribeCards also listens for other tabs' storage events.
    const events = new Set<() => void>();
    (globalThis as { window?: unknown }).window = {
      addEventListener: (_: string, fn: () => void) => events.add(fn),
      removeEventListener: (_: string, fn: () => void) => events.delete(fn),
    };
    const off = subscribeCards(() => (calls += 1));
    dismissCard(store, key);
    resetCard(store, key);
    resetCard(store, key);
    off();
    delete (globalThis as { window?: unknown }).window;
    expect(calls).toBe(2);
    expect(events.size).toBe(0);
  });
});
