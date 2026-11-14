"use client";

import { useOnline } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { INVITE_COPY } from "../copy";

// S02 actions (GC-002). Join this exchange: signed out goes to Sign up with the invite carried as `next`
// (the join resumes after Verify, GC-003); signed in goes to the join confirmation. A member never sees
// this (the page sent them to the exchange). Offline disables both, as the board does.
export function InviteActions({ token, signedIn }: { token: string; signedIn: boolean }) {
  const online = useOnline();
  const next = encodeURIComponent(inviteJoinPath(token));
  return (
    <>
      <Button fullWidth disabled={!online} href={signedIn ? inviteJoinPath(token) : `/signup?next=${next}`}>
        {INVITE_COPY.join}
      </Button>
      {signedIn ? null : (
        <Button variant="text" fullWidth disabled={!online} href={`/login?next=${next}`}>
          {INVITE_COPY.haveAccount}
        </Button>
      )}
    </>
  );
}
