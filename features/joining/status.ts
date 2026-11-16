import type { InviteStatus, JoinViewer, UnavailableKind } from "./types";

// join_exchange and request_to_join refuse with SQLSTATE 22023 and the reason as the hint (migrations
// invite_and_join, join_requests); P0002 is the one answer for a malformed, unknown or reset token.
export const REFUSED = "22023";
export const NOT_FOUND = "P0002";
export const SIGNED_OUT = "42501";

export type JoinRefusal = "closed" | "cancelled" | "full" | "removed" | "approval";

const REFUSALS: readonly JoinRefusal[] = ["closed", "cancelled", "full", "removed", "approval"];

export function refusalFromHint(hint: string | null | undefined): JoinRefusal | null {
  return REFUSALS.find((r) => r === hint) ?? null;
}

// GC-012 request_to_join's refusal hints. WHY every one is answered by re-reading the page: the page's
// decision (decideInviteView) always comes from the database, so the matching state shows by itself:
// member goes to the exchange, can_join shows Join, and the rest show S13 (or the closed Ask).
export type RequestRefusal = "member" | "cancelled" | "closed" | "full" | "can_join";

const REQUEST_REFUSALS: readonly RequestRefusal[] = ["member", "cancelled", "closed", "full", "can_join"];

export function requestRefusalFromHint(hint: string | null | undefined): RequestRefusal | null {
  return REQUEST_REFUSALS.find((r) => r === hint) ?? null;
}

// GC-002, GC-009, GC-012: what an invite page shows, decided from the status, who is looking and whether
// a request is allowed. `viewer` is null on the signed-out preview, where nothing is known about the
// person.
//   join          open invite: Join (S02 / S10)
//   ask-confirm   approval exchange: the normal screen with Ask to join (S10 board Joining-Confirm-approval)
//   ask-closed    joining closed and a request is allowed: S13 plus Ask to join
//   ask-removed   a removed person who may ask again (owner decision Q5): S13-style, Ask to join
//   pending       the viewer already asked ("You've already asked")
//   member        an active member (the page redirects)
//   unavailable   S13 with its kind
export type InviteView =
  | { view: "join" | "ask-confirm" | "ask-closed" | "ask-removed" | "pending" | "member" }
  | { view: "unavailable"; kind: UnavailableKind };

export function decideInviteView(input: { status: InviteStatus; viewer: JoinViewer | null; canAsk: boolean }): InviteView {
  const { status, viewer, canAsk } = input;
  if (viewer === "member") return { view: "member" };
  // WHY first: a pending request wins over can_ask, so a second Ask is never offered (GC-012 AC-6).
  if (viewer === "requested") return { view: "pending" };
  if (status === "cancelled" || status === "full") return { view: "unavailable", kind: status };
  if (viewer === "removed") {
    // WHY: a removed person never joins directly, only asks, and only while asking is allowed.
    return canAsk ? { view: "ask-removed" } : { view: "unavailable", kind: status === "closed" ? "closed" : "incorrect" };
  }
  if (status === "open") return { view: "join" };
  if (status === "approval") return canAsk ? { view: "ask-confirm" } : { view: "unavailable", kind: "incorrect" };
  return canAsk ? { view: "ask-closed" } : { view: "unavailable", kind: "closed" };
}
