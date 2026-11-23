import { deviceStore, type DeviceHidden, type KeyValueStore } from "./storage";

// "Dismiss" on an ActionCard is per device (owner request 2026-11-23, mid-slice change to slice 10). WHY the key is the card's
// kind plus its subject: the card comes back when the subject changes. A wishlist prompt is about one exchange; a reveal
// prompt is about one assignment, so a replaced assignment (a re-draw, slice 14) is a new card.
// WHY the value is only a flag, and the subject is an id the person already sees: no name and no pair is ever stored.

const PREFIX = "unwrap:card-dismissed:";

export type CardKind = "wishlist" | "reveal";

export function cardKey(kind: CardKind, subjectId: string): string {
  return `${PREFIX}${kind}:${subjectId}`;
}

// WHY a memory copy: storage can be blocked (private browsing), and a Dismiss that does nothing looks broken. The card then
// stays hidden for this page session only, and the next load shows it again.
const session = new Set<string>();

// WHY unlike the reveal flag: a card that cannot remember shows again. Hiding it by mistake would lose a prompt the person
// needs, while showing it by mistake costs one tap.
export function isDismissed(store: KeyValueStore | null, key: string): boolean {
  if (session.has(key)) return true;
  if (!store) return false;
  try {
    return store.getItem(key) === "1";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}

export function dismissCard(store: KeyValueStore | null, key: string): void {
  session.add(key);
  try {
    store?.setItem(key, "1");
  } catch {
    // Nothing to do: the card shows again on the next load, which is the safe side.
  }
  notify();
}

// WHY: called where the card's condition no longer holds (the list was added, the name was revealed), so a stale flag never
// hides a later card for the same subject.
export function resetCard(store: KeyValueStore | null, key: string): void {
  const had = session.delete(key);
  let stored = false;
  try {
    stored = store?.getItem(key) === "1";
    if (stored) store?.removeItem(key);
  } catch {
    // The flag stays; the card is only hidden while the flag and the condition both hold.
  }
  if (had || stored) notify();
}

export function subscribeCards(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function cardState(key: string): DeviceHidden {
  return isDismissed(deviceStore(), key) ? "hidden" : "shown";
}
