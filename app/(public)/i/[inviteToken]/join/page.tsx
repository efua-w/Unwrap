import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InviteUnavailable } from "@/features/joining/components/InviteUnavailable";
import { JoinContent } from "@/features/joining/components/JoinContent";
import { JoinForm } from "@/features/joining/components/JoinForm";
import { INVITE_COPY } from "@/features/joining/copy";
import { getInvitePreview, getJoinDetails, getMyEmail } from "@/features/joining/queries";
import { unavailableKindForJoin } from "@/features/joining/status";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { requireProfile } from "@/lib/auth/session";
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

  // WHY: an active member goes to their exchange (GC-009 edge case); the id comes only from this answer.
  if (details?.viewer === "member" && details.exchangeId) redirect(`/exchanges/${details.exchangeId}`);

  const timeZone = await readViewerTimeZone();
  const kind = unavailableKindForJoin(details);
  if (!details || kind) {
    // The public preview holds the organiser, the exchange and the moment joining closed or it was
    // cancelled: enough for S13, and nothing about who is in.
    const preview = details ? await getInvitePreview(token) : null;
    return <InviteUnavailable kind={kind ?? "incorrect"} preview={preview} signedIn timeZone={timeZone} />;
  }

  const email = await getMyEmail();
  return (
    <JoinForm token={token} exchangeName={details.exchangeName}>
      <JoinContent details={details} viewerName={profile.displayName} viewerEmail={email} timeZone={timeZone} />
    </JoinForm>
  );
}
