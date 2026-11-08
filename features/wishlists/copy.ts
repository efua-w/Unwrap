// UI copy shared by more than one wishlist component. Sources: board copy read from the canvas and
// the owner's answers of 2026-11-05 (docs/tasks/slice-2.md), stories GC-018 to GC-021. Toasts and the
// delete title use straight single quotes (owner 2026-11-05). Lines not in a story or board are
// listed in docs/copy-pending.md.

export const quoted = (name: string) => `'${name}'`;

export const WISHLIST_COPY = {
  // GC-018 who-can-see labels (Q5: Private rows say "Only you").
  rowPrivate: "Only you",
  rowLink: "Anyone with the link",
  chipPrivate: "Only you can see this",
  chipLink: "Anyone with the link can see this",
  // GC-020 rollback (Content). Only where something really is put back (a failed Undo of an item
  // removal sends the row away again).
  rollback: "Couldn't save your change, so we put it back.",
  // Owner 2026-11-08 (R1-3): a failed bin remove or undo-delete puts nothing back, so no "put it back".
  saveFailed: "Couldn't save your change.",
  retry: "Retry",
  undo: "Undo",
  // copy-pending: reused from slice 1 for a server failure inside a sheet.
  failed: "Something went wrong on our side.",
  deletedToast: (name: string) => `Deleted ${quoted(name)}.`,
} as const;

export function itemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}
