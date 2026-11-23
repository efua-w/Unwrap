// "Hide again" is per device (GC-014, owner decision: localStorage keyed by assignment id). WHY the assignment id and not
// the exchange id: a replaced assignment (a re-draw, slice 14) has a new id, so a hide never carries over to a new person.
// WHY the value is only a flag: the name itself is never stored on the device.

const PREFIX = "unwrap:reveal-hidden:";

export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** What a snapshot of the device flag says: "pending" until the browser is read (server render, hydration). */
export type DeviceHidden = "pending" | "hidden" | "shown";

export function hiddenKey(assignmentId: string): string {
  return `${PREFIX}${assignmentId}`;
}

// WHY every call is guarded: private browsing and blocked storage throw. The safe answer is "hidden", so a device that
// cannot remember never shows a name it was not asked to show.
export function isHidden(store: KeyValueStore | null, assignmentId: string): boolean {
  if (!store) return true;
  try {
    return store.getItem(hiddenKey(assignmentId)) === "1";
  } catch {
    return true;
  }
}

// WHY listeners: the flag lives outside React, and the Reveal screen and the exchange page's row must both follow it
// (useDeviceHidden subscribes). The browser's own "storage" event covers other tabs.
const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}

export function setHidden(store: KeyValueStore | null, assignmentId: string): void {
  try {
    store?.setItem(hiddenKey(assignmentId), "1");
  } catch {
    // Nothing to do: the next load shows the privacy check, which is the safe side.
  }
  notify();
}

export function clearHidden(store: KeyValueStore | null, assignmentId: string): void {
  try {
    store?.removeItem(hiddenKey(assignmentId));
  } catch {
    // The flag stays; the next load shows the privacy check again, which is the safe side.
  }
  notify();
}

export function subscribeHidden(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The browser's localStorage, or null when the browser refuses it. */
export function deviceStore(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
