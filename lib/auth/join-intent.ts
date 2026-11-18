// GC-003, GC-004, GC-009 (join-one-screen, owner approval R-2, 2026-11-18): a person who signs up or logs in
// FROM an invite is joined (or their request is sent) automatically when they come back. WHY a cookie and
// not the URL: /i/<token>/join is a link anyone can be sent, and a crafted link must never join a person
// or email an organiser for them. The intent is written only by finishSignIn after a real sign-in that
// started from this invite, is httpOnly, SameSite=Strict (a link from another site does not carry it),
// is scoped to this one invite's path, and ends after 30 minutes.
// WHY it is not cleared by the join and request actions: a Server Action that changes a cookie makes Next
// re-render the current page, and the action page would then redirect away from the person's own result.
// Both actions are safe to repeat (join is idempotent, a second request is refused as pending), and the
// action page only acts while the invite is still joinable.

export const JOIN_INTENT_COOKIE = "uw_join_intent";
export const JOIN_INTENT_MAX_AGE_S = 30 * 60;

export function joinIntentPath(token: string): string {
  return `/i/${token}`;
}

// The value is the token itself, so a cookie can only ever authorise the invite it was written for.
export function joinIntentMatches(value: string | undefined, token: string): boolean {
  return typeof value === "string" && value.length > 0 && value === token;
}
