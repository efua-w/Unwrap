import { AppShell } from "@/components/layout/AppShell";
import { NotificationSettingsForm } from "@/features/account/NotificationSettingsForm";
import { getNotificationSettings } from "@/features/account/queries";
import { NOTIFICATION_COPY } from "@/features/account/notifications-copy";
import { LoadError } from "@/features/wishlists/components/LoadError";
import { requireProfile } from "@/lib/auth/session";

// S44 Notifications (GC-026). Boards: Acc-Notif-default, -saving, -off, -error, -offline (m and d). Four toggles since
// slice 12 (the two reminders joined the two from slice 7), and "Reminders also show in Activity." under "Always sent".
// Back goes to Profile; Activity links here too, and the owner wants "Back" everywhere.
export default async function NotificationsPage() {
  const profile = await requireProfile("/profile/notifications");
  let initial;
  try {
    initial = await getNotificationSettings();
  } catch {
    initial = null;
  }
  return (
    <AppShell profile={{ name: profile.displayName }} hideTabs back={{ label: "Back", href: "/profile" }}>
      <div className="flex flex-col gap-32 md:max-w-dialog">
        <header className="flex flex-col gap-8">
          <h1 className="text-heading-1">{NOTIFICATION_COPY.title}</h1>
          <p className="text-body-base-regular text-text-secondary">{NOTIFICATION_COPY.subtitle}</p>
        </header>
        {initial === null ? (
          <LoadError title={NOTIFICATION_COPY.loadError} />
        ) : (
          <>
            <NotificationSettingsForm initial={initial} />
            <section aria-labelledby="always-sent" className="flex flex-col gap-4">
              <h2 id="always-sent" className="flex min-h-touch-target items-center text-body-lg-semibold">
                {NOTIFICATION_COPY.alwaysTitle}
              </h2>
              <p className="text-body-base-regular text-text-secondary">{NOTIFICATION_COPY.alwaysBody}</p>
              <p className="mt-8 text-body-sm-regular text-text-muted">{NOTIFICATION_COPY.remindersInActivity}</p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
