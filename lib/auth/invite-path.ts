// GC-002, GC-003, GC-004: the only `next` values that carry an invite through sign-up, log-in and
// Verify. WHY strict and anchored: `next` is untrusted input, and it is the only thing that decides
// whether an invite banner shows and whether Verify skips Profile setup (owner decision Q1). Anything
// that is not exactly `/i/<32 hex>` or `/i/<32 hex>/join` is not an invite: no banner, normal flow.
const INVITE_NEXT = /^\/i\/([0-9a-f]{32})(\/join)?$/;

export function inviteTokenFromNext(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  return INVITE_NEXT.exec(next)?.[1] ?? null;
}

export function isInviteNext(next: string | null | undefined): boolean {
  return inviteTokenFromNext(next) !== null;
}

// The page a person lands on after Verify when an invite is pending: the join confirmation (GC-009),
// whichever of the two invite paths `next` held.
export function inviteJoinPath(token: string): string {
  return `/i/${token}/join`;
}
