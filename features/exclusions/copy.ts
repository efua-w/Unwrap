// UI copy for Exclusions (GCO-009, S33 and S35). Sources: story GCO-009, boards Org-Excl-* (Part 2 canvas) and the owner
// decisions of 2026-11-22 (docs/tasks/slice-9.md). Lines marked "pending" are not in the story or in
// docs/copy-pending.md as approved, and are listed there for approval.

export const EXCLUSIONS_COPY = {
  back: "Back",
  title: "Exclusions",
  // Board Org-Excl-empty-m: intro and privacy are one paragraph at the top of every state.
  intro: "Stop two people drawing each other, like couples or siblings. It works both ways, and only you can see these pairs.",
  addPair: "Add a pair",
  // Board Org-Excl-empty-m: plain text, not a title+body empty state.
  emptyText: "No pairs yet. Everyone can draw anyone except themselves.",
  listLabel: "Pairs",
  pairLine: (a: string, b: string) => `${a} and ${b}`,
  // Board Org-Excl-default-m: subtitle on each pair row.
  pairSub: "Neither will draw the other.",
  // Approved 2026-11-22 (owner): bin button name.
  removeLabel: (a: string, b: string) => `Remove ${a} and ${b}`,
  // Board Org-Excl-default-m (story GCO-009 content line).
  fair: "A fair draw is still possible with these pairs.",
  // Story GCO-009 edge case, owner Q4.
  tooFew: "Names need at least 3 people to draw.",
  // Story GCO-009: "…Remove Nneka and Obinna, or invite more people." with the Q3b sentences around it.
  relax: (a: string, b: string) =>
    `With these pairs, names can't be drawn fairly. Remove ${a} and ${b}, or invite more people. You can still save, and the draw checks again later.`,
  removeThatPair: "Remove that pair",
  // Approved 2026-11-22 (owner, Q3b).
  unfixable:
    "With these pairs, names can't be drawn fairly. Remove a few pairs, or invite more people. You can still save, and the draw checks again later.",
  save: "Save pairs",
  saved: "Pairs saved.",
  // Approved 2026-11-22 (owner).
  saveFailed: "We couldn't save the pairs. Nothing has changed, so you can try again.",
  // pending: someone left or was removed while the page was open.
  stale: "Someone in these pairs is no longer taking part. The list is up to date now, so check the pairs and save again.",
  // Board Org-Excl-locked-m: past tense.
  locked: "Names are drawn, so pairs can't change now.",
  // Approved 2026-11-22 (owner).
  loadError: (exchange: string) => `We couldn't load the pairs for ${exchange}.`,
  // pending: when the exchange itself could not be read, so there is no name to show.
  loadErrorUnnamed: "We couldn't load the pairs for this exchange.",
  // Board Org-Excl-pairfirst-m: the sheet title stays "Add a pair" for step 1; step 2 changes.
  sheetTitle: "Add a pair",
  firstBody: "Who’s the first person?",
  // Board Org-Excl-pairsecond-m: step 2 title and body.
  secondTitle: (first: string) => `Who shouldn’t ${first} draw?`,
  secondBody: (first: string) => `${first} won’t draw them, and they won’t draw ${first}.`,
  next: "Next",
  back2: "Back",
  add: "Add pair",
  cancel: "Cancel",
  // Board Org-Excl-locked-m: shown once names are drawn, no controls.
  lockedBody: "Names are drawn, so pairs can’t change now.",
  // Board Org-Excl-locked-m: subtitle on each pair in the locked view.
  lockedPairSub: "Neither drew the other.",
  lockedEmpty: "No pairs were set.",
} as const;

// Organiser tools row (GCO-006, GCO-009). Approved 2026-11-22 (owner): "{n} pairs" / "1 pair", and no line for none.
export function pairCountLabel(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n === 1 ? "1 pair" : `${n} pairs`;
}
