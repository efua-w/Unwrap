import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvitePreviewView } from "@/features/joining/components/InvitePreviewView";
import { InviteUnavailable } from "@/features/joining/components/InviteUnavailable";
import { INVITE_COPY } from "@/features/joining/copy";
import { getInvitePreview, getJoinDetails } from "@/features/joining/queries";
import { unavailableKindFromStatus } from "@/features/joining/status";
import { getMyProfile } from "@/lib/auth/session";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// GC-002 / S02 Invite preview. Public: a signed-out visitor sees it, outside AppShell.
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

  // WHY only for a signed-in person on a link that resolves: an active member goes to their exchange
  // (GC-002). Only get_join_details returns the exchange id, and only to an active member, so a
  // stranger never learns it. Best effort: if it cannot be read, the preview still shows.
  if (profile && preview) {
    const details = await getJoinDetails(token).catch(() => null);
    if (details?.viewer === "member" && details.exchangeId) redirect(`/exchanges/${details.exchangeId}`);
  }

  const kind = preview ? unavailableKindFromStatus(preview.status) : "incorrect";
  if (!preview || kind) {
    return <InviteUnavailable kind={kind ?? "incorrect"} preview={preview} signedIn={profile !== null} timeZone={timeZone} />;
  }
  return <InvitePreviewView preview={preview} token={token} signedIn={profile !== null} timeZone={timeZone} />;
}
