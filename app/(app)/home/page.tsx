import { Plus } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { HowItWorks } from "@/features/onboarding/HowItWorks";
import { requireProfile } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/dates/format-long-date";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// S07 Home, first-time state (GC-006). Boards: HomeState-Mobile-first, HomeState-Desktop-first.
// Slice 1 has no exchanges or wishlists yet, so this is the only state; the others arrive with
// the slices that create that data.
export default async function HomePage() {
  const profile = await requireProfile("/home");
  const timeZone = await readViewerTimeZone();
  const today = formatLongDate(new Date(), timeZone);

  return (
    <AppShell profile={{ name: profile.displayName }}>
      <div className="flex flex-col gap-32 md:gap-40">
        <div className="flex flex-col gap-4">
          <span className="text-body-xs-semibold text-text-muted">{today}</span>
          <h1 className="text-heading-1">Welcome, {profile.displayName}.</h1>
        </div>
        <div className="flex flex-col gap-24 md:max-w-dialog">
          <HowItWorks headingId="how">
            {/* WHY: both links go to routes later slices build (plan §3); owner decision 2026-11-04 keeps them. */}
            <Button href="/exchanges/new" icon={Plus} fullWidth>
              Start an exchange
            </Button>
            <Button variant="text" href="/wishlists" fullWidth>
              Make a wishlist
            </Button>
          </HowItWorks>
          <p className="text-body-sm-regular text-text-muted">
            Got an invite? Open the link you were sent and you&apos;ll land in that exchange.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
