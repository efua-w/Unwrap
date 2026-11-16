"use client";

import { useOnline } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { INVITE_COPY, REQUEST_COPY } from "../copy";

// S02 actions (GC-002). Join this exchange: signed out goes to Sign up with the invite carried as `next`
// (the join resumes after Verify, GC-003); signed in goes to the join confirmation. A member never sees
// this (the page sent them to the exchange). Offline disables both, as the board does.
// `ask` (GC-012, joining closed): the same two routes, labelled Ask to join; the join page then sends the
// request, so a signed-out visitor goes through Sign up or Log in first.
export function InviteActions({ token, signedIn, ask = false }: { token: string; signedIn: boolean; ask?: boolean }) {
  const online = useOnline();
  const next = encodeURIComponent(inviteJoinPath(token));
  return (
    <>
      <Button fullWidth disabled={!online} href={signedIn ? inviteJoinPath(token) : `/signup?next=${next}`}>
        {ask ? REQUEST_COPY.ask : INVITE_COPY.join}
      </Button>
      {signedIn ? null : (
        <Button variant="text" fullWidth disabled={!online} href={`/login?next=${next}`}>
          {INVITE_COPY.haveAccount}
        </Button>
      )}
    </>
  );
}
