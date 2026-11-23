import type { ListState } from "@/features/draw/types";
import type { ItemPriority } from "@/features/wishlists/types";

// What the giver's screens may carry (GC-015). WHY these shapes and no more: the answer of open_recipient_list has no item
// id, wishlist id, list name or source, and neither does this file. `ref` is an opaque, per-giver reference that means
// nothing to anyone else (GC-015 RAIDS). `got` is the giver's OWN mark, and it exists only on the giver's view.

export type RecipientItem = {
  ref: string;
  name: string;
  priority: ItemPriority;
  note: string | null;
  priceKobo: number | null;
  /** A shop link (http or https), or null. */
  link: string | null;
  /** Changed since the giver last opened the list. */
  updated: boolean;
  /** The giver marked it as got. */
  got: boolean;
};

/** A marked item that is no longer on the person's list: only its name and a reference to unmark it. */
export type TakenOffItem = { ref: string; name: string };

export type RecipientList = {
  displayName: string;
  avatarPath: string | null;
  listState: ListState;
  items: RecipientItem[];
  takenOff: TakenOffItem[];
};
