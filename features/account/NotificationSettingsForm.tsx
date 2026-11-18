"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { CheckboxGroup, type CheckboxOption } from "@/components/ui/CheckboxGroup";
import { useToast } from "@/components/ui/Toast";
import { setNotificationSetting } from "./actions";
import { NOTIFICATION_KEYS, type NotificationKey, type NotificationSettings } from "./notifications";
import { failedOff, failedOn, NOTIFICATION_COPY, savedOff, savedOn } from "./notifications-copy";

const OPTIONS: readonly CheckboxOption<NotificationKey>[] = NOTIFICATION_KEYS.map((key) => ({
  value: key,
  label: NOTIFICATION_COPY.options[key].label,
  hint: NOTIFICATION_COPY.options[key].hint,
}));

// GC-026 / S44 Notifications (boards Acc-Notif-*). Saves on change and shows the new state at once; on a
// failure it puts the box back and says so. WHY it goes back: the line reads "it's still on", so the screen
// must show it on. The boxes are disabled while a save runs (board Acc-Notif-saving) and when offline.
export function NotificationSettingsForm({ initial }: { initial: NotificationSettings }) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [settings, setSettings] = useState<NotificationSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(key: NotificationKey, next: boolean) {
    if (busy || !online || settings[key] === next) return;
    setError(null);
    setSettings((s) => ({ ...s, [key]: next }));
    setBusy(true);
    const rollback = () => {
      setSettings((s) => ({ ...s, [key]: !next }));
      setError(next ? failedOn(key) : failedOff(key));
    };
    try {
      const result = await setNotificationSetting(key, next);
      if (result.ok) {
        toast.show({ message: next ? savedOn(key) : savedOff(key) });
      } else if (result.reason === "signed-out") {
        return router.replace(`/login?next=${encodeURIComponent("/profile/notifications")}`);
      } else {
        rollback();
      }
    } catch {
      // A Server Action that cannot reach the server throws (GC-029: no offline writes).
      rollback();
      reportNetworkError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-16">
      <CheckboxGroup
        legend={NOTIFICATION_COPY.groupLegend}
        options={OPTIONS}
        checked={NOTIFICATION_KEYS.filter((key) => settings[key])}
        onChange={change}
        disabled={!online || busy}
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
