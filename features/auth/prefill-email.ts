import { useSyncExternalStore } from "react";

// R1-9: "Create an account with this email" on Log in carries the address to Sign up. It goes
// through sessionStorage, not the URL, so the address never lands in history, logs or Referer.
// Storage can throw; losing the prefill is harmless.
const KEY = "uw_prefill_email";

export function writePrefillEmail(email: string): void {
  try {
    window.sessionStorage.setItem(KEY, email);
  } catch {
    // Ignore.
  }
}

export function clearPrefillEmail(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

function read(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

const subscribeNever = () => () => {};

// "" on the server and before hydration, then the saved address.
export function usePrefillEmail(): string {
  return useSyncExternalStore(subscribeNever, read, () => "");
}
