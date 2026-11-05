import { isPlausibleEmail } from "./email";
import { DISPLAY_NAME_MAX } from "./display-name";
import { DEFAULT_NEXT_PATH, sanitizeNext } from "./next-path";

// GC-003: Verify code keeps its state (email, invite context, cooldown) when the person leaves for
// their email app and comes back, including inside WhatsApp's in-app browser, which can clear
// storage. The state lives mainly in a short-lived httpOnly cookie, with localStorage as a backup.
// It carries no secret: the code itself is never stored.

export const VERIFY_COOKIE = "uw_verify";
export const VERIFY_STORAGE_KEY = "uw_verify";
export const VERIFY_STATE_MAX_AGE_S = 30 * 60;
// WHY 60 s: the minimum interval between codes per user (owner decision 2026-11-04), shown as "You can resend in 0:59".
export const RESEND_COOLDOWN_MS = 60_000;
const CLOCK_SKEW_MS = 5 * 60_000;

export type VerifyFlow = "signup" | "login";

export type VerifyState = {
  v: 1;
  email: string;
  flow: VerifyFlow;
  /** Sign-up only; resending a sign-up code sends it again with the account's name. */
  firstName?: string;
  /** A sanitised same-site path to open after verifying. */
  next?: string;
  /** When the latest code was sent, in ms since the epoch. */
  sentAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// WHY strict: the cookie and the storage entry are both client-controlled. Anything that is not
// exactly the shape we wrote, or is stale, is treated as "no state" and the person starts again.
export function parseVerifyState(raw: unknown, now: number): VerifyState | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const { email, flow, firstName, next, sentAt } = raw;
  if (typeof email !== "string" || email !== email.trim().toLowerCase() || !isPlausibleEmail(email)) return null;
  if (flow !== "signup" && flow !== "login") return null;
  if (typeof sentAt !== "number" || !Number.isFinite(sentAt)) return null;
  if (sentAt > now + CLOCK_SKEW_MS || now - sentAt > VERIFY_STATE_MAX_AGE_S * 1000) return null;

  const state: VerifyState = { v: 1, email, flow, sentAt };
  if (firstName !== undefined) {
    if (typeof firstName !== "string" || firstName.length === 0 || Array.from(firstName).length > DISPLAY_NAME_MAX) {
      return null;
    }
    state.firstName = firstName;
  }
  if (next !== undefined) {
    if (typeof next !== "string" || sanitizeNext(next) !== next) return null;
    state.next = next;
  }
  return state;
}

export function parseVerifyJson(text: string | null | undefined, now: number): VerifyState | null {
  if (!text) return null;
  try {
    return parseVerifyState(JSON.parse(text) as unknown, now);
  } catch {
    return null;
  }
}

export function cooldownRemainingMs(sentAt: number, now: number): number {
  return Math.max(0, sentAt + RESEND_COOLDOWN_MS - now);
}

// "0:59" style. The first second shows 0:59 rather than 1:00, as the design does.
export function formatCountdown(remainingMs: number): string {
  const seconds = Math.min(59, Math.max(0, Math.ceil(remainingMs / 1000)));
  return `0:${String(seconds).padStart(2, "0")}`;
}

export function serializeVerifyState(state: VerifyState): string {
  return JSON.stringify(state);
}

// Where to go after a good code. WHY the verified user decides, not only the flow: an abandoned
// sign-up leaves an unconfirmed account, and a later Sign up or Log in for that address looks like
// a log-in to Supabase. Its first confirmation must still reach Profile setup (GC-005). A new
// account (signup flow, or a first confirmation) goes to Profile setup, keeping any deep link for
// after it; a returning person goes to the page they wanted, or Home (GC-004).
export function destinationAfterVerify(
  state: { flow: VerifyFlow; next?: string },
  firstConfirmation: boolean,
): string {
  if (state.flow === "signup" || firstConfirmation) {
    return state.next ? `/welcome?next=${encodeURIComponent(state.next)}` : "/welcome";
  }
  return state.next ?? DEFAULT_NEXT_PATH;
}

// True when this verification is the one that confirmed the address. Supabase sets
// email_confirmed_at and last_sign_in_at in the same step on a first confirmation (a few ms
// apart, measured 5 ms on the dev project), while an account confirmed earlier (including by an
// admin) has a confirmation time well before this sign-in (measured 3.5 s after a 3 s wait).
const FIRST_CONFIRMATION_WINDOW_MS = 1000;

export function isFirstConfirmation(user: { email_confirmed_at?: string | null; last_sign_in_at?: string | null }): boolean {
  if (!user.email_confirmed_at || !user.last_sign_in_at) return false;
  const confirmed = Date.parse(user.email_confirmed_at);
  const signedIn = Date.parse(user.last_sign_in_at);
  if (!Number.isFinite(confirmed) || !Number.isFinite(signedIn)) return false;
  return Math.abs(signedIn - confirmed) <= FIRST_CONFIRMATION_WINDOW_MS;
}
