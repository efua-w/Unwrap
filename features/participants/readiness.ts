import type { NudgeTarget, ReadinessRow } from "./types";

// Pure readiness arithmetic for the exchange page card and Nudge (GCO-006, GCO-008).
export type ReadinessSummary = {
  /** Everyone taking part, the organiser included when they take part. */
  total: number;
  /** Names of those with a wishlist in, for the face row. */
  inNames: string[];
  /** How many of them have a wishlist in. */
  inCount: number;
  /** Other people with no wishlist yet. The organiser's own list is "Your part", never nudged. */
  missing: ReadinessRow[];
  /** The missing people a nudge would reach: not nudged in the last 12 hours. */
  targets: NudgeTarget[];
};

export function summariseReadiness(rows: readonly ReadinessRow[]): ReadinessSummary {
  const missing = rows.filter((r) => !r.isMe && !r.hasWishlist);
  return {
    total: rows.length,
    inNames: rows.filter((r) => r.hasWishlist).map((r) => r.name),
    inCount: rows.filter((r) => r.hasWishlist).length,
    missing,
    targets: missing.filter((r) => !r.nudgedRecently).map((r) => ({ memberId: r.memberId, name: r.name })),
  };
}
