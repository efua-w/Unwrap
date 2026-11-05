// Sign up (GC-003, open item 36): whether an address already has a confirmed account. Sign up only
// needs that one bit: no account and an unconfirmed (abandoned) one both continue as a sign-up.
// WHY two answers, not three: returning "none" separately from "unconfirmed" would tell anyone who
// calls the action more than Sign up itself needs. "unknown" means the server could not check
// (no key, network, an ambiguous answer), and Sign up falls back to its browser-only check.
export type AccountStatus = "confirmed" | "not-confirmed" | "unknown";

type Match = { email: string | null; emailConfirmedAt: string | null };

// `users` is a substring match from Supabase Auth, at most one page of it; `total` is the size of
// the whole match, when known. `email` is already normalised (trimmed, lower case).
export function accountStatusFrom(email: string, users: Match[], total: number | null): AccountStatus {
  const exact = users.find((u) => u.email?.toLowerCase() === email);
  if (exact) return exact.emailConfirmedAt ? "confirmed" : "not-confirmed";
  // WHY: an address can only be called new when the whole match was seen. A partial page could
  // hide the exact address behind longer ones that contain it.
  if (total !== null && total <= users.length) return "not-confirmed";
  return "unknown";
}
