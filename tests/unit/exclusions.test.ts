import { describe, expect, it } from "vitest";
import { pairCountLabel } from "@/features/exclusions/copy";
import {
  addPair,
  canAddPair,
  firstPickPeople,
  hasPair,
  isDirty,
  pairKey,
  partnersFor,
  removePair,
  toArrays,
  verdictFor,
} from "@/features/exclusions/draft";
import type { DraftPair, PairablePerson, PairCheck } from "@/features/exclusions/types";

const person = (id: string, name: string, email: string | null = `${id}@example.com`): PairablePerson => ({ memberId: id, name, email });
const nneka = person("a", "Nneka Obi");
const obinna = person("b", "Obinna Eze");
const chidi = person("c", "Chidi Okoro");
const people = [nneka, obinna, chidi];

describe("pairKey and hasPair (GCO-009)", () => {
  it("treats (A, B) and (B, A) as one pair", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });

  it("finds a pair written either way round", () => {
    const draft = addPair([], nneka, obinna);
    expect(hasPair(draft, "a", "b")).toBe(true);
    expect(hasPair(draft, "b", "a")).toBe(true);
    expect(hasPair(draft, "a", "c")).toBe(false);
  });
});

describe("addPair and removePair", () => {
  it("adds the pair last, with first names only", () => {
    const draft = addPair(addPair([], nneka, obinna), chidi, nneka);
    expect(draft).toEqual([
      { firstId: "a", firstName: "Nneka", secondId: "b", secondName: "Obinna" },
      { firstId: "c", firstName: "Chidi", secondId: "a", secondName: "Nneka" },
    ]);
  });

  it("ignores a duplicate in either order and a person paired with themselves", () => {
    const draft = addPair([], nneka, obinna);
    expect(addPair(draft, obinna, nneka)).toEqual(draft);
    expect(addPair(draft, nneka, obinna)).toEqual(draft);
    expect(addPair([], nneka, nneka)).toEqual([]);
  });

  it("does not change the list it was given", () => {
    const draft: DraftPair[] = [];
    addPair(draft, nneka, obinna);
    expect(draft).toEqual([]);
  });

  it("removes a pair whichever way round it is named, leaving the rest in order", () => {
    const draft = addPair(addPair([], nneka, obinna), chidi, nneka);
    expect(removePair(draft, "b", "a")).toEqual([draft[1]]);
    expect(removePair(draft, "a", "c")).toEqual([draft[0]]);
    expect(removePair(draft, "b", "c")).toEqual(draft);
  });
});

describe("the pickers (owner Q7)", () => {
  it("offers everyone in step one when nothing is paired", () => {
    expect(firstPickPeople(people, [])).toEqual(people);
  });

  it("leaves the first person and existing partners out of step two", () => {
    const draft = addPair([], nneka, obinna);
    expect(partnersFor(nneka, people, draft)).toEqual([chidi]);
    expect(partnersFor(chidi, people, draft)).toEqual([nneka, obinna]);
  });

  it("leaves a person paired with everyone out of step one", () => {
    const draft = addPair(addPair([], nneka, obinna), nneka, chidi);
    expect(firstPickPeople(people, draft)).toEqual([obinna, chidi]);
  });

  it("disables Add a pair when nobody can be paired any more, or fewer than two people are in", () => {
    const full = addPair(addPair(addPair([], nneka, obinna), nneka, chidi), obinna, chidi);
    expect(canAddPair(people, full)).toBe(false);
    expect(canAddPair(people, [])).toBe(true);
    expect(canAddPair([nneka], [])).toBe(false);
    expect(canAddPair([], [])).toBe(false);
  });
});

describe("isDirty and toArrays", () => {
  it("is clean for the same pairs in another order or written the other way round", () => {
    const saved = addPair(addPair([], nneka, obinna), chidi, nneka);
    const draft = addPair(addPair([], nneka, chidi), obinna, nneka);
    expect(isDirty(draft, saved)).toBe(false);
  });

  it("is dirty after an add or a remove", () => {
    const saved = addPair([], nneka, obinna);
    expect(isDirty(addPair(saved, nneka, chidi), saved)).toBe(true);
    expect(isDirty(removePair(saved, "a", "b"), saved)).toBe(true);
    expect(isDirty([], [])).toBe(false);
  });

  it("gives the two same-length arrays in draft order", () => {
    const draft = addPair(addPair([], nneka, obinna), chidi, nneka);
    expect(toArrays(draft)).toEqual({ first: ["a", "c"], second: ["b", "a"] });
    expect(toArrays([])).toEqual({ first: [], second: [] });
  });
});

describe("verdictFor (owner Q3a, Q3b, Q4)", () => {
  const draft = addPair(addPair([], nneka, obinna), chidi, nneka);
  const fair: PairCheck = { peopleCount: 4, feasible: true, relax: null };

  it("says nothing without an answer", () => {
    expect(verdictFor(null, draft)).toEqual({ kind: "unknown" });
  });

  it("replaces every other line with 'at least 3 people' under 3 people", () => {
    expect(verdictFor({ peopleCount: 2, feasible: false, relax: null }, draft)).toEqual({ kind: "few" });
    expect(verdictFor({ peopleCount: 2, feasible: false, relax: null }, [])).toEqual({ kind: "few" });
  });

  it("says nothing for no pairs, and 'fair' for a possible draw", () => {
    expect(verdictFor(fair, [])).toEqual({ kind: "none" });
    expect(verdictFor(fair, draft)).toEqual({ kind: "fair" });
  });

  it("names the pair the database says to relax, as the draft holds it, even when it was written the other way round", () => {
    const check: PairCheck = { peopleCount: 3, feasible: false, relax: { firstId: "a", secondId: "c" } };
    expect(verdictFor(check, draft)).toEqual({ kind: "relax", pair: draft[1] });
  });

  it("is unfixable when no single pair fixes it, or when the named pair is not in the draft", () => {
    expect(verdictFor({ peopleCount: 3, feasible: false, relax: null }, draft)).toEqual({ kind: "unfixable" });
    expect(verdictFor({ peopleCount: 3, feasible: false, relax: { firstId: "x", secondId: "y" } }, draft)).toEqual({ kind: "unfixable" });
  });
});

describe("pairCountLabel (GCO-006, GCO-009)", () => {
  it("has no line for none, singular for one, plural otherwise", () => {
    expect(pairCountLabel(0)).toBeUndefined();
    expect(pairCountLabel(1)).toBe("1 pair");
    expect(pairCountLabel(2)).toBe("2 pairs");
    expect(pairCountLabel(12)).toBe("12 pairs");
  });
});
