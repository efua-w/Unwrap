import { VerifyForm } from "@/features/auth/VerifyForm";
import { inviteBannerForNext } from "@/features/joining/invite-banner";
import { redirectIfSignedIn } from "@/lib/auth/session";
import { readVerifyCookie } from "@/lib/auth/verify-cookie";

// S05 Verify code (GC-003, GC-004). Reopens from the cookie so a reload or a trip to the email app
// lands back here for the same address. With no cookie, the client tries the localStorage backup.
export default async function VerifyPage() {
  const initial = await readVerifyCookie();
  // R1-9: a signed-in person still goes where the saved state was heading (already sanitised).
  await redirectIfSignedIn(initial?.next);
  return <VerifyForm initial={initial} banner={await inviteBannerForNext(initial?.next)} />;
}
