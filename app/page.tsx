import { Check, Lock } from "@phosphor-icons/react/dist/ssr";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { Button } from "@/components/ui/Button";
import { Icon, type PhosphorIcon } from "@/components/ui/Icon";
import { HowItWorks } from "@/features/onboarding/HowItWorks";

// S01 Landing (GC-001). Boards: Entry-Landing-default-m, -d, -offline-m.
// Static: it reads no cookies or headers, so it renders immediately and works when assets fail.
// The route stays static even for a signed-in visitor, which is also where Log out lands.
const TRUST: ReadonlyArray<{ icon: PhosphorIcon; text: string }> = [
  { icon: Check, text: "Free for everyone in the exchange." },
  { icon: Lock, text: "Only you see who you got. Not even the organiser." },
  { icon: Check, text: "No passwords. We email you a code." },
];

export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="flex min-h-48 items-center justify-between px-20 pt-16 md:px-40 md:pt-32">
        <p className="font-heading text-heading-4">Unwrap</p>
        <Button variant="link" href="/login">
          Log in
        </Button>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none md:items-center md:px-40 md:py-80">
        <div className="flex w-full flex-1 flex-col md:max-w-content-max md:flex-none">
          <div className="flex flex-1 flex-col gap-32 px-20 pb-24 pt-16 md:flex-none md:flex-row md:flex-wrap md:gap-64 md:p-0">
            <div className="flex flex-col gap-32 md:max-w-dialog md:flex-1 md:basis-dialog">
              <div className="flex flex-col gap-8">
                <h1 className="text-heading-1">Secret Santa, without the spreadsheet.</h1>
                <p className="text-body-base-regular text-text-secondary">
                  Start an exchange, share one link, and we draw names on the day. Everyone adds a wishlist, and
                  nobody sees who got whom.
                </p>
              </div>
              {/* Mobile pins "Get started" at the bottom instead (below). */}
              <div className="flex-wrap gap-8 max-md:hidden md:flex">
                <Button href="/signup">Get started</Button>
                <Button variant="text" href="/login">
                  Log in
                </Button>
              </div>
              <ul className="flex flex-col gap-8">
                {TRUST.map((item) => (
                  <li key={item.text} className="flex items-start gap-8 text-body-sm-regular text-text-secondary">
                    <Icon icon={item.icon} size="sm" className="mt-2" />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:flex-1 md:basis-dialog">
              <HowItWorks headingId="how" />
            </div>
          </div>
          <div className="sticky bottom-0 flex flex-col gap-8 bg-surface-default px-20 pb-24 pt-12 md:hidden">
            <Button href="/signup" fullWidth>
              Get started
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
