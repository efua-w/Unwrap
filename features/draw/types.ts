// What the draw and reveal screens may carry (GCO-011, GCO-012, GC-014). WHY these shapes and no more: the organiser's
// view of the draw is a count and a moment, and a giver's view is their own person. There is no field for a pair, a
// giver id or a receiver id anywhere in this file, so a component cannot be handed one.

/** The organiser's read of the draw (get_draw_summary): never a person and never a pair. */
export type DrawSummary = {
  /** People the draw covered. */
  peopleCount: number;
  /** The first moment of the current draw (ISO). */
  drawnAt: string;
  /** Names are drawn emails still queued or sent for this round: "{told} of {n} people, by email" (Q3). */
  told: number;
};

/** The caller's own current assignment: its id and whether the reveal tap happened. No name. */
export type MyAssignment = { assignmentId: string; revealed: boolean };

/**
 * One Most wanted item as the giver sees it on Reveal: name and price, plus the opaque reference that opens the item
 * sheet on the recipient's list (slice 11, GC-015). The reference means nothing to anyone but this giver.
 */
export type MostWantedItem = { ref: string; name: string; priceKobo: number | null };

/** none: nothing attached. empty: a list with no live items. items: at least one live item. */
export type ListState = "none" | "empty" | "items";

/** The person the caller gives to. The only place a recipient's name exists, and only the giver reads it. */
export type Recipient = {
  displayName: string;
  avatarPath: string | null;
  listState: ListState;
  mostWanted: MostWantedItem[];
};
