// GC-023 / S25 copy. Boards: Wishlist-Shared-default, -empty, -unavailable, -loading. The intro rules
// are the owner's answers of 2026-11-08 (docs/tasks/slice-3.md).

const NUMBER_WORDS = ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"] as const;

// WHY the first word only: the intro and empty state talk about the person ("Amaka"); the full name
// sits beside the avatar.
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

// "Four things Amaka would love. Tap one to see where to get it." Number words for 2 to 10, digits
// above, and a singular line for one. No line for none (the empty state replaces it).
export function sharedIntro(count: number, displayName: string): string | null {
  const name = firstName(displayName);
  if (count <= 0) return null;
  if (count === 1) return `One thing ${name} would love. Tap it to see where to get it.`;
  const amount = count <= 10 ? NUMBER_WORDS[count] : String(count);
  return `${amount} things ${name} would love. Tap one to see where to get it.`;
}

export const SHARED_COPY = {
  whatIsUnwrap: "What is Unwrap?",
  makeYourOwn: "Make a wishlist of your own",
  order: "Recently changed first",
  emptyTitle: (displayName: string) => `${firstName(displayName)} hasn't added anything yet.`,
  emptyBody: (displayName: string) =>
    `Check back closer to the date. We'll show items here as soon as ${firstName(displayName)} adds them.`,
  unavailableTitle: "This wishlist isn't available",
  unavailableBody: "Its owner may have made it private. Ask them to send you the link again.",
  loading: "Loading the wishlist",
  // WHY generic (owner 2026-11-08): the title and preview card say nothing about the list or its owner.
  pageTitle: "A wishlist on Unwrap",
} as const;
