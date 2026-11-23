// What the Exclusions screens may carry (GCO-009). WHY member ids and first names only: the organiser's pair
// functions return nothing else, and a component cannot be handed what the type has no field for. These types have
// no field for an assignment or a reservation; a pair says who must NOT draw each other, which reveals no draw.
// The address belongs to PairablePerson alone, read from Participants' own function (owner decision Q1a, 2026-11-22),
// and never travels with a saved pair.

/** One pair, as the organiser wrote it (first, then second). Names are first names. */
export type DraftPair = { firstId: string; firstName: string; secondId: string; secondName: string };

/** A person the picker offers. `email` is null on the organiser's own row. */
export type PairablePerson = { memberId: string; name: string; email: string | null };

/** What the database says about a draft (check_exclusions). `relax` is the pair whose removal alone fixes the draw. */
export type PairCheck = {
  peopleCount: number;
  feasible: boolean;
  relax: { firstId: string; secondId: string } | null;
};

/**
 * The pair count for the Organiser tools row, or null when it could not be read (the row then has no subtitle).
 * `onlyPair` holds the two first names when there is exactly one pair, for the Draw names sheet's note (GCO-011).
 */
export type ExclusionsEntry = { count: number | null; onlyPair: { first: string; second: string } | null };
