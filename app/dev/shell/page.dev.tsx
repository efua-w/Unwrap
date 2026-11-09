import { AppShell } from "@/components/layout/AppShell";

type SearchParams = Promise<{ back?: string; tabs?: string; unread?: string }>;

// Dev-only gallery of the app shell. Options: ?back=1, ?tabs=0, ?unread=12.
export default async function ShellGallery({ searchParams }: { searchParams: SearchParams }) {
  const { back, tabs, unread } = await searchParams;
  return (
    <AppShell
      profile={{ name: "Ada Okafor" }}
      unreadActivity={Number(unread ?? "3")}
      hideTabs={tabs === "0"}
      back={back ? { label: "Go back", href: "/dev/shell" } : undefined}
    >
      <h1 className="text-heading-2">App shell</h1>
      <p className="text-body-base-regular text-text-secondary">
        Resize across 768. Options: ?back=1, ?tabs=0, ?unread=12.
      </p>
      <div className="flex flex-col gap-16 pt-16">
        {Array.from({ length: 20 }, (_, i) => (
          <p key={i} className="rounded-xl bg-surface-subtle p-16 text-body-base-regular">
            Row {i + 1}
          </p>
        ))}
      </div>
    </AppShell>
  );
}
