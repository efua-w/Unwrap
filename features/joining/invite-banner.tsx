import "server-only";
import type { ReactNode } from "react";
import { InviteContextBanner } from "@/components/ui/InviteContextBanner";
import { inviteTokenFromNext } from "@/lib/auth/invite-path";
import { getInvitePreview } from "./queries";

// GC-003, GC-004: the banner for Sign up, Log in and Verify. WHY derived on the server from the
// sanitised `next` and no new cookie field: the invite token is already inside `next`, and only an
// exact invite path (inviteTokenFromNext) can show it. An unknown link, or a failed read, shows no
// banner: the banner is context, never a reason to block sign-in.
export async function inviteBannerForNext(next: string | undefined): Promise<ReactNode> {
  const token = inviteTokenFromNext(next);
  if (!token) return null;
  try {
    const preview = await getInvitePreview(token);
    if (!preview) return null;
    return <InviteContextBanner exchangeName={preview.exchangeName} tint={preview.tint} />;
  } catch {
    return null;
  }
}
