import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignedInInvite } from "@/features/joining/components/SignedInInvite";
import { INVITE_COPY } from "@/features/joining/copy";
import { getJoinDetails } from "@/features/joining/queries";
import { decideInviteView } from "@/features/joining/status";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { hasJoinIntent } from "@/lib/auth/join-intent-cookie";
import { requireProfile } from "@/lib/auth/session";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// GC-003, GC-004, GC-005, GC-009 / S10: the post-sign-in action page of an invite (join-one-screen, owner
// approval R-1, 2026-11-18). The invite is one screen at /i/<token>; this page only exists so that a person
// who signed up or logged in FROM it is joined once, or has their request sent once, without another tap.
//   signed out         -> Log in, and back here
//   not set up yet     -> Profile setup (the name step), and back here
//   no join intent     -> /i/<token>: a pasted or crafted link to this page does nothing automatic (R-2)
//   intent, open/approval exchange -> the same screen with the one automatic attempt
//   anything else the invite now is (closed, full, cancelled, removed, pending, member) -> /i/<token>,
//   which shows the existing unavailable or ask screen. Nothing automatic happens then.
export const dynamic = "force-dynamic";

// WHY generic metadata and robots off: same reasons as the invite page (GC-002, plan AC-5).
export const metadata: Metadata = {
  title: INVITE_COPY.pageTitle,
  openGraph: { title: INVITE_COPY.pageTitle, type: "website" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function JoinPage({ params }: { params: Promise<{ inviteToken: string }> }) {
  const { inviteToken: token } = await params;
  // WHY without allowNotOnboarded: a new account goes through the name step first (owner decision 2).
  const profile = await requireProfile(inviteJoinPath(token));
  const invitePath = `/i/${token}`;
  if (!(await hasJoinIntent(token))) redirect(invitePath);

  const details = await getJoinDetails(token);
  if (!details) redirect(invitePath);
  if (details.viewer === "member" && details.exchangeId) redirect(`/exchanges/${details.exchangeId}`);
  const decision = decideInviteView({ status: details.status, viewer: details.viewer, canAsk: details.canAsk });
  if (decision.view !== "join" && decision.view !== "ask-confirm") redirect(invitePath);

  const timeZone = await readViewerTimeZone();
  return (
    <SignedInInvite
      token={token}
      view={decision.view}
      details={details}
      profile={profile}
      timeZone={timeZone}
      autoStart
    />
  );
}
