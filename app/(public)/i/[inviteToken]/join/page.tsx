import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AskToJoin } from "@/features/joining/components/AskToJoin";
import { InviteUnavailable } from "@/features/joining/components/InviteUnavailable";
import { JoinBySummary } from "@/features/joining/components/JoinBySummary";
import { JoinContent } from "@/features/joining/components/JoinContent";
import { JoinForm } from "@/features/joining/components/JoinForm";
import { RequestPending } from "@/features/joining/components/RequestPending";
import { INVITE_COPY, REQUEST_COPY, firstName, unavailableBody } from "@/features/joining/copy";
import { getInvitePreview, getJoinDetails, getMyEmail } from "@/features/joining/queries";
import { decideInviteView } from "@/features/joining/status";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { requireProfile } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates/format";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// GC-009 / S10 Join confirmation. Signed in only: a signed-out visit goes to Log in and comes back here.
export const dynamic = "force-dynamic";

// WHY generic metadata and robots off: same reasons as the invite preview (GC-002, plan AC-5).
export const metadata: Metadata = {
  title: INVITE_COPY.pageTitle,
  openGraph: { title: INVITE_COPY.pageTitle, type: "website" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function JoinPage({ params }: { params: Promise<{ inviteToken: string }> }) {
  const { inviteToken: token } = await params;
  // WHY allowNotOnboarded (owner decision Q1, 2026-11-13; GC-003, GC-005): an invitee arrives straight from
  // Verify without Profile setup. join_exchange marks them as set up; "Not now" goes Home, which then
  // shows Profile setup.
  const profile = await requireProfile(inviteJoinPath(encodeURIComponent(token)), { allowNotOnboarded: true });
  const details = await getJoinDetails(token);

  const timeZone = await readViewerTimeZone();
  if (!details) return <InviteUnavailable kind="incorrect" preview={null} signedIn timeZone={timeZone} />;

  const decision = decideInviteView({ status: details.status, viewer: details.viewer, canAsk: details.canAsk });
  const organiser = firstName(details.organiserName);

  switch (decision.view) {
    case "member":
      // WHY: an active member goes to their exchange (GC-009 edge case); the id comes only from this answer.
      if (details.exchangeId) redirect(`/exchanges/${details.exchangeId}`);
      return <InviteUnavailable kind="incorrect" preview={null} signedIn timeZone={timeZone} />;
    case "pending":
      return <RequestPending exchangeName={details.exchangeName} organiserFirstName={organiser} />;
    case "join": {
      const email = await getMyEmail();
      return (
        <JoinForm token={token} exchangeName={details.exchangeName}>
          <JoinContent details={details} viewerName={profile.displayName} viewerEmail={email} timeZone={timeZone} />
        </JoinForm>
      );
    }
    case "ask-confirm": {
      // GC-012: an approval exchange shows the same confirmation, and the action sends a request.
      const email = await getMyEmail();
      return (
        <AskToJoin
          token={token}
          variant="confirm"
          exchangeName={details.exchangeName}
          organiserFirstName={organiser}
          sentRows={<JoinBySummary details={details} timeZone={timeZone} />}
        >
          <JoinContent details={details} viewerName={profile.displayName} viewerEmail={email} timeZone={timeZone} />
        </AskToJoin>
      );
    }
    case "ask-closed": {
      // The public preview holds the moment joining closed; nothing about who is in.
      const preview = await getInvitePreview(token);
      const body = unavailableBody("closed", {
        who: details.organiserName,
        exchangeName: details.exchangeName,
        day: preview?.closedAt ? formatDay(new Date(preview.closedAt), timeZone) : null,
      });
      return (
        <AskToJoin token={token} variant="closed" exchangeName={details.exchangeName} organiserFirstName={organiser} body={body} />
      );
    }
    case "ask-removed":
      // GC-012 Q5: no names, no way to join directly, only a request.
      return (
        <AskToJoin
          token={token}
          variant="removed"
          exchangeName={details.exchangeName}
          organiserFirstName={organiser}
          body={REQUEST_COPY.removed(`'${details.exchangeName}'`)}
        />
      );
    case "unavailable": {
      // The public preview holds the organiser, the exchange and the moment joining closed or it was
      // cancelled: enough for S13, and nothing about who is in.
      const preview = await getInvitePreview(token);
      return <InviteUnavailable kind={decision.kind} preview={preview} signedIn timeZone={timeZone} />;
    }
  }
}
