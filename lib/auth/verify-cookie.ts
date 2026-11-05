import { cookies } from "next/headers";
import { parseVerifyJson, serializeVerifyState, VERIFY_COOKIE, VERIFY_STATE_MAX_AGE_S, type VerifyState } from "./verify-state";

// Server-side access to the verify-state cookie. Writing is only possible inside a Server Action.

export async function readVerifyCookie(): Promise<VerifyState | null> {
  const store = await cookies();
  return parseVerifyJson(store.get(VERIFY_COOKIE)?.value, Date.now());
}

export async function writeVerifyCookie(state: VerifyState): Promise<void> {
  const store = await cookies();
  store.set(VERIFY_COOKIE, serializeVerifyState(state), {
    httpOnly: true,
    sameSite: "lax",
    // WHY: Secure only in production. Chrome and Firefox accept it on localhost, but Safari and a
    // phone testing over a LAN address on plain http do not, which would break resume there.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VERIFY_STATE_MAX_AGE_S,
  });
}

export async function clearVerifyCookie(): Promise<void> {
  const store = await cookies();
  store.delete(VERIFY_COOKIE);
}
