import { useSyncExternalStore } from "react";

// The current time, ticking every second, for the resend countdown. null on the server and on the
// first client render, so the clock never causes a hydration mismatch. useSyncExternalStore keeps
// the timer out of an effect that would call setState.
let current: number | null = null;

function subscribe(onChange: () => void): () => void {
  current = Date.now();
  const timer = window.setInterval(() => {
    current = Date.now();
    onChange();
  }, 1000);
  return () => window.clearInterval(timer);
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
