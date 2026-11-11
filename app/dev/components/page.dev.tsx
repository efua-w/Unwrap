import { CalendarBlank, Clock, Globe, ListHeart, Lock, Plus } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { Field } from "@/components/ui/Field";
import { ListRow } from "@/components/ui/ListRow";
import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { ShareActions } from "@/components/ui/ShareActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { Timeline } from "@/components/ui/Timeline";
import {
  BusyDemo,
  FormBusyDemo,
  ListRowDemo,
  MoneyFieldDemo,
  MountedOpenSheetDemo,
  OfflineDemo,
  OtpDemo,
  RadioGroupDemo,
  SegmentedTabsDemo,
  SheetDemo,
  SkeletonDemo,
  TimeField12Demo,
  ToastDemo,
} from "./Interactive";

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
          <Field label="Join by" name="e" type="date" defaultValue="2026-12-04" />
          <Field label="Draw time" name="f" type="time" defaultValue="15:00" error="Choose a time." />
        </div>
      </Section>
      <Section title="TimeField12">
        <TimeField12Demo />
      </Section>
      <Section title="MoneyField">
        <MoneyFieldDemo />
      </Section>
      <Section title="RadioGroup">
        <RadioGroupDemo />
      </Section>
      <Section title="SegmentedTabs">
        <SegmentedTabsDemo />
      </Section>
      <Section title="ExchangeTag">
        <div className="flex flex-wrap items-center gap-12">
          <ExchangeTag name="Book club" tint="clay" />
          <ExchangeTag name="Office Secret Santa" tint="peach" />
          <ExchangeTag name="Family" tint="sand" size="header" />
          <ExchangeTag name="Church choir" tint="mint" size="header" />
        </div>
      </Section>
      <Section title="Timeline and LocalDateTime">
        <div className="flex max-w-dialog flex-col gap-12">
          <Timeline
            steps={[
              { title: "People join", detail: "Anyone with the link can join until Fri 4 Dec." },
              { title: "Names are drawn", detail: "Fri 4 Dec at 6:00 pm." },
              { title: "Gifts are exchanged", detail: "Sat 12 Dec." },
            ]}
          />
          <p className="text-body-sm-regular text-text-muted">
            <LocalDateTime value="2026-12-04T17:00:00Z" timeZone="Africa/Lagos" format="dayTime" /> in Lagos,{" "}
            <LocalDateTime value="2026-12-04T17:00:00Z" timeZone="Europe/London" format="dayTime" /> in London.
          </p>
        </div>
      </Section>
      <Section title="ShareActions">
        <div className="flex max-w-dialog flex-col gap-12">
          <span id="gallery-share-link" className="break-all text-body-base-semibold">
            https://example.com/i/0123456789abcdef0123456789abcdef
          </span>
          <ShareActions
            url="https://example.com/i/0123456789abcdef0123456789abcdef"
            whatsAppHref="https://wa.me/?text=Gallery"
            linkElementId="gallery-share-link"
          />
        </div>
      </Section>
      <Section title="OtpInput">
        <OtpDemo />
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
        <MountedOpenSheetDemo />
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
      <Section title="ListRow">
        <ul className="flex max-w-dialog flex-col">
          <ListRow
            href="/dev/shell"
            title="Birthday list"
            sub="4 items · updated Wed 9 Sep"
            meta={
              <Chip variant="meta" icon={Globe}>
                Anyone with the link
              </Chip>
            }
          />
          <ListRow
            href="/dev/shell"
            title="New flat"
            sub="0 items · updated today"
            divider
            meta={
              <Chip variant="meta" icon={Lock}>
                Only you
              </Chip>
            }
          />
        </ul>
        <ListRowDemo />
      </Section>
      <Section title="EmptyState">
        <div className="flex max-w-dialog flex-col gap-12">
          <EmptyState
            icon={ListHeart}
            title="Make your first wishlist."
            body="Gallery copy: why a list helps."
            action={<Button icon={Plus}>New wishlist</Button>}
          />
          <EmptyState title="Add your first item" body="Gallery copy: example item types." />
        </div>
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
