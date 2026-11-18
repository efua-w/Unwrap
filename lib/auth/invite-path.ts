// GC-002, GC-003, GC-004: the only `next` values that carry an invite through sign-up, log-in and
// Verify. WHY strict and anchored: `next` is untrusted input, and it is the only thing that decides
// whether an invite banner shows and where Verify sends the person. Anything
// that is not exactly `/i/<32 hex>` or `/i/<32 hex>/join` is not an invite: no banner, normal flow.
const INVITE_NEXT = /^\/i\/([0-9a-f]{32})(\/join)?$/;

export function inviteTokenFromNext(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  return INVITE_NEXT.exec(next)?.[1] ?? null;
}

export function isInviteNext(next: string | null | undefined): boolean {
  return inviteTokenFromNext(next) !== null;
}

// The post-sign-in action page of an invite (join-one-screen): it joins the person, or sends their
// request, once. The invite itself is one screen at /i/<token>.
export function inviteJoinPath(token: string): string {
  return `/i/${token}/join`;
}
