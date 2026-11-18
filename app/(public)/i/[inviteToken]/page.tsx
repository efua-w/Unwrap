import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InviteUnavailable } from "@/features/joining/components/InviteUnavailable";
import { InvitePreviewView } from "@/features/joining/components/InvitePreviewView";
import { SignedInInvite } from "@/features/joining/components/SignedInInvite";
import { INVITE_COPY } from "@/features/joining/copy";
import { getInvitePreview, getJoinDetails } from "@/features/joining/queries";
import { decideInviteView } from "@/features/joining/status";
import { getMyProfile } from "@/lib/auth/session";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// GC-002, GC-009 / S10 Join exchange: the one screen before joining. Public: a signed-out visitor sees it,
// outside AppShell, with public data only (owner decision 1, 2026-11-18). A signed-in person sees the same
// screen with the people in and the organiser's note, and joins from it in one tap.
// WHY force-dynamic: the answer depends on the exchange's current state and on who is looking.
export const dynamic = "force-dynamic";

// WHY generic title and preview card, and robots off (GC-002, plan AC-5): the link can be forwarded to
// strangers, so nothing about the exchange or the inviter appears in a search result or a link preview.
// next.config.ts adds the same noindex and no-referrer as response headers.
export const metadata: Metadata = {
  title: INVITE_COPY.pageTitle,
  openGraph: { title: INVITE_COPY.pageTitle, type: "website" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// WHY loading.tsx (owner decision Q10, 2026-11-13): the page shows a skeleton while the link resolves
// (GC-002), so an unknown link answers 200 and then shows Invite unavailable ("incorrect"), never a 404.
export default async function InvitePage({ params }: { params: Promise<{ inviteToken: string }> }) {
  const { inviteToken: token } = await params;
  const preview = await getInvitePreview(token);
  const profile = await getMyProfile();
  const timeZone = await readViewerTimeZone();

  if (!preview) return <InviteUnavailable kind="incorrect" preview={null} signedIn={profile !== null} timeZone={timeZone} />;

  if (!profile) {
    // Signed out: the public preview only. Nothing here is read with the person's session.
    const decision = decideInviteView({ status: preview.status, viewer: null, canAsk: preview.canAsk });
    switch (decision.view) {
      case "unavailable":
        return <InviteUnavailable kind={decision.kind} preview={preview} signedIn={false} timeZone={timeZone} />;
      case "ask-closed":
        return <InviteUnavailable kind="closed" preview={preview} signedIn={false} timeZone={timeZone} askToken={token} />;
      default:
        // join and ask-confirm: an approval exchange shows the same screen (GC-012, plan AC-26).
        return <InvitePreviewView preview={preview} token={token} timeZone={timeZone} />;
    }
  }

  // Signed in: the join view decides. WHY an active member goes to their exchange (GC-002): only
  // get_join_details returns the exchange id, and only to an active member, so a stranger never learns it.
  const details = await getJoinDetails(token);
  if (!details) return <InviteUnavailable kind="incorrect" preview={null} signedIn timeZone={timeZone} />;
  if (details.viewer === "member" && details.exchangeId) redirect(`/exchanges/${details.exchangeId}`);
  const decision = decideInviteView({ status: details.status, viewer: details.viewer, canAsk: details.canAsk });
  if (decision.view === "unavailable") {
    return <InviteUnavailable kind={decision.kind} preview={preview} signedIn timeZone={timeZone} />;
  }
  if (decision.view === "member") return <InviteUnavailable kind="incorrect" preview={null} signedIn timeZone={timeZone} />;
  return (
    <SignedInInvite
      token={token}
      view={decision.view}
      details={details}
      closedAt={preview.closedAt}
      profile={profile}
      timeZone={timeZone}
    />
  );
}
