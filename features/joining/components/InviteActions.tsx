"use client";

import { useOnline } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { INVITE_COPY, REQUEST_COPY } from "../copy";

// Signed-out actions of the one invite screen (GC-002, GC-003). Join exchange goes to Sign up with the
// post-sign-in action page carried as `next`: after Verify (and the name step for a new account) that page
// joins the person once (join-one-screen). A signed-in person never sees this: the page shows their own
// Join exchange or Ask to join in place. Offline disables both, as the board does.
// `ask` (GC-012, joining closed): the same two routes, labelled Ask to join.
export function InviteActions({ token, ask = false }: { token: string; ask?: boolean }) {
  const online = useOnline();
  const next = encodeURIComponent(inviteJoinPath(token));
  return (
    <>
      <Button fullWidth disabled={!online} href={`/signup?next=${next}`}>
        {ask ? REQUEST_COPY.ask : INVITE_COPY.join}
      </Button>
      <Button variant="text" fullWidth disabled={!online} href={`/login?next=${next}`}>
        {INVITE_COPY.haveAccount}
      </Button>
    </>
  );
}
