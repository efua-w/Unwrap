import { cookies } from "next/headers";
import { JOIN_INTENT_COOKIE, JOIN_INTENT_MAX_AGE_S, joinIntentMatches, joinIntentPath } from "./join-intent";

// Server-side access to the join-intent cookie (see join-intent.ts). Writing is only possible inside a
// Server Action; reading works in a page.

export async function hasJoinIntent(token: string): Promise<boolean> {
  const store = await cookies();
  return joinIntentMatches(store.get(JOIN_INTENT_COOKIE)?.value, token);
}

export async function writeJoinIntent(token: string): Promise<void> {
  const store = await cookies();
  store.set(JOIN_INTENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    // WHY: Secure only in production, as the verify cookie (Safari and a phone on a LAN address over http).
    secure: process.env.NODE_ENV === "production",
    path: joinIntentPath(token),
    maxAge: JOIN_INTENT_MAX_AGE_S,
  });
}
