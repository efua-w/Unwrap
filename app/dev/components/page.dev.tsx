import { CalendarBlank, Clock, Lock, Plus } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { BusyDemo, FormBusyDemo, OfflineDemo, SheetDemo, SkeletonDemo, ToastDemo } from "./Interactive";

// Dev-only gallery. `*.dev.tsx` is only a page outside production builds (next.config.ts).
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-16 border-t-1 border-border-default py-24">
      <h2 className="text-heading-4">{title}</h2>
      {children}
    </section>
  );
}

const people = [
  { id: "1", name: "Ada Okafor" },
  { id: "2", name: "Tunde Bello" },
  { id: "3", name: "Zainab Musa" },
];

export default function ComponentGallery() {
  return (
    <main id="main" className="mx-auto max-w-content-max px-16 py-24 md:px-32">
      <OfflineBanner />
      <h1 className="text-heading-2">Components</h1>
      <Section title="Button">
        <div className="flex flex-wrap items-center gap-12">
          <Button variant="primary">Primary</Button>
          <Button variant="brand">Brand</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="text">Text</Button>
          <Button variant="destructive-text">Destructive text</Button>
          <Button variant="link">Link</Button>
          <Button variant="icon" icon={Plus} label="Add" />
        </div>
        <div className="flex flex-wrap items-center gap-12">
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="text" disabled>
            Disabled
          </Button>
          <Button variant="primary" busy>
            Busy
          </Button>
          <BusyDemo />
          <Button href="/dev/shell" variant="secondary" busy>
            Busy link
          </Button>
        </div>
        <FormBusyDemo />
      </Section>
      <Section title="Field">
        <div className="flex max-w-dialog flex-col gap-16">
          <Field label="Name" name="a" helper="Helper text." />
          <Field label="Name" name="b" defaultValue="Typed value" error="Enter a name." />
          <Field label="Name" name="c" disabled defaultValue="Disabled" />
          <Field label="Note" name="d" multiline maxLength={200} helper="Grows as you type." />
        </div>
      </Section>
      <Section title="Alert">
        <div className="flex max-w-dialog flex-col gap-12">
          <Alert variant="offline">You&apos;re offline. Pages you&apos;ve opened stay on screen.</Alert>
          <Alert
            variant="error"
            title="We couldn't load your wishlists."
            action={<Button variant="link">Try again</Button>}
          >
            Something went wrong on our side. Nothing you&apos;ve added is lost.
          </Alert>
          <Alert variant="privacy">Only you can see this.</Alert>
        </div>
        <OfflineDemo />
      </Section>
      <Section title="Sheet and Toast">
        <SheetDemo />
        <ToastDemo />
      </Section>
      <Section title="Skeleton">
        <div className="flex max-w-dialog flex-col gap-12">
          <Skeleton shape="row" />
          <Skeleton shape="block" />
          <Skeleton shape="line" text="base" />
        </div>
        <SkeletonDemo />
      </Section>
      <Section title="Avatar and AvatarStack">
        <div className="flex flex-wrap items-center gap-16">
          <Avatar name="Ada Okafor" />
          <Avatar name="Tunde" size="nav" />
          <Avatar name="Zainab Musa" size="profile" />
          <AvatarStack people={people} missing={3} label="3 of 6 people have added a wishlist" />
        </div>
      </Section>
      <Section title="Chip">
        <div className="flex flex-wrap items-center gap-12">
          <Chip variant="date" icon={CalendarBlank}>
            12 Dec
          </Chip>
          <Chip variant="urgent" icon={Clock}>
            2 days left
          </Chip>
          <Chip variant="label">Clay</Chip>
          <Chip variant="meta" icon={Lock}>
            Only you
          </Chip>
          <Chip variant="count" count={3} />
          <Chip variant="count" count={12} />
          <Chip variant="count" count={0} />
        </div>
      </Section>
      <Section title="Type and colour">
        <p className="text-heading-1">Heading 1</p>
        <p className="text-heading-3">Heading 3</p>
        <p className="text-body-base-regular">₦20,000 in Plus Jakarta Sans</p>
        <div className="flex flex-wrap gap-8">
          <span className="size-48 rounded-lg bg-surface-brand" />
          <span className="size-48 rounded-lg bg-surface-inverse" />
          <span className="size-48 rounded-lg bg-surface-error" />
          <span className="size-48 rounded-lg bg-surface-success" />
        </div>
      </Section>
    </main>
  );
}
