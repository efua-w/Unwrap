"use server";

import { redirect } from "next/navigation";
import { accountStatusFrom, type AccountStatus } from "@/lib/auth/account-status";
import { normaliseDisplayName } from "@/lib/auth/display-name";
import { isPlausibleEmail, normaliseEmail } from "@/lib/auth/email";
import { clearVerifyCookie, writeVerifyCookie } from "@/lib/auth/verify-cookie";
import { sanitizeNext } from "@/lib/auth/next-path";
import { destinationAfterVerify, parseVerifyState, type VerifyState } from "@/lib/auth/verify-state";
import { isValidTimeZone } from "@/lib/dates/timezone";
import { findAuthUsersByEmail } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Server Actions for the entry flow. The email-code calls themselves run in the browser (owner
// decision 2026-11-04); these save what the browser cannot (an httpOnly cookie) and write the
// person's own rows. None of them take a user id: it always comes from the validated session.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Sign up (GC-003, open item 36, owner decision 2026-11-04): does this address have a confirmed
// account? Only a confirmed one gets "Account exists"; an abandoned, unconfirmed sign-up carries on
// as a sign-up. The answer is one of three words, never the user record. Account enumeration is
// accepted by the owner (R1-4); this adds no rate limit of its own (open item 29 covers CAPTCHA).
export async function checkAccountStatus(input: unknown): Promise<AccountStatus> {
  if (typeof input !== "string") return "unknown";
  const email = normaliseEmail(input);
  // WHY the backslash: it is the LIKE escape in the Auth server's filter, so the match could miss.
  if (!isPlausibleEmail(email) || email.includes("\\")) return "unknown";
  const found = await findAuthUsersByEmail(email);
  if (!found) return "unknown";
  return accountStatusFrom(email, found.users, found.total);
}

// Remembers which email a code was sent to, so Verify can reopen after the person leaves for their
// email app (GC-003). Returns the clean state so the browser can keep its own backup copy.
export async function saveVerifyState(input: unknown): Promise<{ ok: true; state: VerifyState } | { ok: false }> {
  if (!isRecord(input)) return { ok: false };
  const now = Date.now();
  const sentAt = typeof input.sentAt === "number" && Number.isFinite(input.sentAt) ? Math.min(input.sentAt, now) : now;
  const firstName = typeof input.firstName === "string" ? normaliseDisplayName(input.firstName) : "";
  const candidate: Record<string, unknown> = {
    v: 1,
    email: typeof input.email === "string" ? normaliseEmail(input.email) : "",
    flow: input.flow,
    sentAt,
  };
  if (firstName) candidate.firstName = firstName;
  if (typeof input.next === "string") candidate.next = input.next;

  const state = parseVerifyState(candidate, now);
  if (!state) return { ok: false };
  await writeVerifyCookie(state);
  return { ok: true, state };
}

// GC-003/GC-004: every sign-in records the browser's time zone, so emails and dates use the
// person's own zone (product rules). An unknown name is ignored here, and the database refuses it
// too. A failure never blocks sign-in.
async function recordTimeZone(timeZone: unknown): Promise<void> {
  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("user_settings").update({ timezone: timeZone }).eq("user_id", data.user.id);
}

// The last step of Verify: record the zone, drop the saved verify state, and go to the right page.
// WHY one action that redirects: clearing the cookie in a separate action re-rendered /verify (now
// signed in, so it redirected to Home) and raced the browser's own navigation, which could land
// on Home instead of Profile setup. One response, one navigation.
export async function finishSignIn(input: unknown): Promise<void> {
  const raw = isRecord(input) ? input : {};
  await recordTimeZone(raw.timeZone);
  await clearVerifyCookie();
  const flow = raw.flow === "login" ? "login" : "signup";
  const next = typeof raw.next === "string" ? sanitizeNext(raw.next) : undefined;
  redirect(destinationAfterVerify({ flow, next }, raw.firstConfirmation === true));
}

// "Change email": same single-response rule. Clears the saved state and goes back to the form.
export async function changeEmail(flow: unknown): Promise<void> {
  await clearVerifyCookie();
  redirect(flow === "login" ? "/login" : "/signup");
}

export type SaveNameResult = { ok: true } | { ok: false; reason: "name-missing" | "signed-out" | "failed" };

// GC-005: Profile setup saves the display name. Names are trimmed and truncated safely.
export async function saveDisplayName(input: unknown): Promise<SaveNameResult> {
  const name = normaliseDisplayName(typeof input === "string" ? input : "");
  if (name.length === 0) return { ok: false, reason: "name-missing" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, reason: "signed-out" };

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", data.user.id)
    .select("id");
  if (error || !rows || rows.length !== 1) return { ok: false, reason: "failed" };
  return { ok: true };
}

// GC-024: Log out ends this device's session only (scope "local"), then lands on Landing.
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  await clearVerifyCookie();
  redirect("/");
}
