import { useSyncExternalStore } from "react";
import { saveVerifyState } from "./actions";
import { parseVerifyJson, parseVerifyState, VERIFY_STORAGE_KEY, type VerifyFlow, type VerifyState } from "@/lib/auth/verify-state";

// The localStorage copy of the verify state (GC-003). WHY: WhatsApp's in-app browser can drop
// cookies and storage while the person is in their email app; having both gives two chances to
// reopen on Verify. Storage can throw (blocked, full, private mode), and must never break sign-in.

export function readStoredVerifyState(): VerifyState | null {
  try {
    return parseVerifyJson(window.localStorage.getItem(VERIFY_STORAGE_KEY), Date.now());
  } catch {
    return null;
  }
}

export function writeStoredVerifyState(state: VerifyState): void {
  try {
    window.localStorage.setItem(VERIFY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore: the cookie is the main copy.
  }
}

export function clearStoredVerifyState(): void {
  try {
    window.localStorage.removeItem(VERIFY_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

type Begin = { email: string; flow: VerifyFlow; firstName?: string; next?: string };

// Records that a code was just sent: cookie through the server, copy in storage. If the server
// call fails (offline, say) the storage copy alone still lets Verify reopen.
export async function rememberCodeSent(input: Begin): Promise<VerifyState | null> {
  const sentAt = Date.now();
  let saved: VerifyState | null = null;
  try {
    const result = await saveVerifyState({ ...input, sentAt });
    if (result.ok) saved = result.state;
  } catch {
    // fall through to the local copy
  }
  const state = saved ?? parseVerifyState({ v: 1, ...input, sentAt }, sentAt);
  if (state) writeStoredVerifyState(state);
  return state;
}

// WHY useSyncExternalStore: reading storage during render would differ between server and client.
// The server snapshot is null, and the client snapshot appears after hydration without a
// setState-in-effect. The parsed value is cached per raw string so the snapshot stays stable.
let lastRaw: string | null | undefined;
let lastParsed: VerifyState | null = null;

function getStoredSnapshot(): VerifyState | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(VERIFY_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseVerifyJson(raw, Date.now());
  }
  return lastParsed;
}

const subscribeNever = () => () => {};

export function useStoredVerifyState(): VerifyState | null {
  return useSyncExternalStore(subscribeNever, getStoredSnapshot, () => null);
}
