import { firstName } from "@/features/joining/copy";
import type { DraftPair, PairablePerson, PairCheck } from "./types";

// Pure helpers for the Exclusions draft (GCO-009). WHY apart from the view: they hold the rules about what a pair
// may be and which line the check earns, so a unit test can pin them without a browser or a database.

// People needed before names can be drawn (GCO-007, GCO-009).
export const MIN_PEOPLE = 3;

// WHY sorted: (A, B) and (B, A) are one pair, however it was written (the database's unique index agrees).
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function keyOf(pair: DraftPair): string {
  return pairKey(pair.firstId, pair.secondId);
}

export function hasPair(draft: readonly DraftPair[], a: string, b: string): boolean {
  const key = pairKey(a, b);
  return draft.some((p) => keyOf(p) === key);
}

// Appends a pair, so the last one is the most recently added (owner decision Q3a). A person with themselves, or a
// pair already there in either order, changes nothing.
export function addPair(draft: readonly DraftPair[], first: PairablePerson, second: PairablePerson): DraftPair[] {
  if (first.memberId === second.memberId || hasPair(draft, first.memberId, second.memberId)) return [...draft];
  return [
    ...draft,
    { firstId: first.memberId, firstName: firstName(first.name), secondId: second.memberId, secondName: firstName(second.name) },
  ];
}

export function removePair(draft: readonly DraftPair[], a: string, b: string): DraftPair[] {
  const key = pairKey(a, b);
  return draft.filter((p) => keyOf(p) !== key);
}

// The people a second pick may name: everyone but the first person and those already paired with them.
export function partnersFor(first: PairablePerson, people: readonly PairablePerson[], draft: readonly DraftPair[]): PairablePerson[] {
  return people.filter((p) => p.memberId !== first.memberId && !hasPair(draft, first.memberId, p.memberId));
}

// Owner decision Q7: a person already paired with everyone else is left out of the first pick.
export function firstPickPeople(people: readonly PairablePerson[], draft: readonly DraftPair[]): PairablePerson[] {
  return people.filter((p) => partnersFor(p, people, draft).length > 0);
}

// Owner decision Q7: "Add a pair" needs two people who could still be paired, which is the case whenever the first
// pick list is not empty (a person with a free partner has that partner free too).
export function canAddPair(people: readonly PairablePerson[], draft: readonly DraftPair[]): boolean {
  return firstPickPeople(people, draft).length > 0;
}

// True when the draft differs from what is saved, ignoring order and which way round a pair was written.
export function isDirty(draft: readonly DraftPair[], saved: readonly DraftPair[]): boolean {
  if (draft.length !== saved.length) return true;
  const savedKeys = new Set(saved.map(keyOf));
  return draft.some((p) => !savedKeys.has(keyOf(p)));
}

// The two same-length arrays of member ids the database functions take, in draft order.
export function toArrays(draft: readonly DraftPair[]): { first: string[]; second: string[] } {
  return { first: draft.map((p) => p.firstId), second: draft.map((p) => p.secondId) };
}

/**
 * Which line the check earns (the order is the owner's):
 *   few      fewer than 3 people: "Names need at least 3 people to draw." replaces every other line (Q4)
 *   none     no pairs and nothing to say
 *   fair     "A fair draw is still possible with these pairs."
 *   relax    no fair draw, and one named pair would fix it (Q3a); `pair` is that pair as the draft holds it
 *   unfixable  no fair draw and no single pair fixes it (Q3b)
 *   unknown  no answer yet (checking, or the check failed): no line
 */
export type Verdict =
  | { kind: "few" | "none" | "fair" | "unfixable" | "unknown" }
  | { kind: "relax"; pair: DraftPair };

export function verdictFor(check: PairCheck | null, draft: readonly DraftPair[]): Verdict {
  if (!check) return { kind: "unknown" };
  if (check.peopleCount < MIN_PEOPLE) return { kind: "few" };
  if (draft.length === 0) return { kind: "none" };
  if (check.feasible) return { kind: "fair" };
  if (!check.relax) return { kind: "unfixable" };
  const key = pairKey(check.relax.firstId, check.relax.secondId);
  const pair = draft.find((p) => keyOf(p) === key);
  // WHY unfixable when the pair is not in the draft: the answer is about an older draft, so name nobody.
  return pair ? { kind: "relax", pair } : { kind: "unfixable" };
}
