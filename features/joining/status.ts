import type { InviteStatus, JoinDetails, UnavailableKind } from "./types";

// join_exchange refuses with SQLSTATE 22023 and the reason as the hint (migration invite_and_join);
// P0002 is its one answer for a malformed, unknown or reset token.
export const REFUSED = "22023";
export const NOT_FOUND = "P0002";

export type JoinRefusal = "closed" | "cancelled" | "full" | "removed" | "approval";

const REFUSALS: readonly JoinRefusal[] = ["closed", "cancelled", "full", "removed", "approval"];

export function refusalFromHint(hint: string | null | undefined): JoinRefusal | null {
  return REFUSALS.find((r) => r === hint) ?? null;
}

// S13: what a refusal looks like on the page.
export function unavailableKindFromRefusal(refusal: JoinRefusal): UnavailableKind {
  return refusal;
}

// The invite page for a status: an open invite shows the preview, everything else is S13 (GC-012).
export function unavailableKindFromStatus(status: InviteStatus): UnavailableKind | null {
  return status === "open" ? null : status;
}

// The join page's decision (GC-009): a removed person is refused whatever the status says (slice 6
// turns this into a request), otherwise an unusable invite is S13, otherwise the confirmation.
export function unavailableKindForJoin(details: JoinDetails | null): UnavailableKind | null {
  if (!details) return "incorrect";
  if (details.viewer === "member") return null;
  if (details.viewer === "removed") return "removed";
  return unavailableKindFromStatus(details.status);
}
