"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { RadioGroup, type RadioOption } from "@/components/ui/RadioGroup";
import { useToast } from "@/components/ui/Toast";
import type { WishlistVisibility } from "@/lib/validation/wishlist";
import { setDefaultVisibility } from "./actions";

// GC-027 / S45 Privacy, "Default for new wishlists" only (owner 2026-11-08: data export and
// "Who sees what" arrive with slice 16). Boards: Acc-Privacy-default, -link, -saveerror, -offline.
// Saves on change. WHY the radio goes back on failure: the line says "it's still X", so the screen
// must show X.
const LABEL: Record<WishlistVisibility, string> = { private: "Private", link: "Anyone with the link" };

const OPTIONS: readonly RadioOption<WishlistVisibility>[] = [
  { value: "private", label: LABEL.private, hint: "Only you, until you share it." },
  { value: "link", label: LABEL.link, hint: "People you send the link to can see it." },
];

const saved = (value: WishlistVisibility) => `Saved. New wishlists start as ${LABEL[value]}.`;
const failed = (stillValue: WishlistVisibility) =>
  `We couldn't save your default, so it's still ${LABEL[stillValue]}. Try again.`;

export function DefaultVisibilityForm({ initial }: { initial: WishlistVisibility }) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [value, setValue] = useState<WishlistVisibility>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(next: WishlistVisibility) {
    if (busy || !online || next === value) return;
    const previous = value;
    setError(null);
    setValue(next);
    setBusy(true);
    try {
      const result = await setDefaultVisibility(next);
      if (result.ok) {
        toast.show({ message: saved(next) });
      } else if (result.reason === "signed-out") {
        return router.replace(`/login?next=${encodeURIComponent("/profile/privacy")}`);
      } else {
        setValue(previous);
        setError(failed(previous));
      }
    } catch {
      // A Server Action that cannot reach the server throws (GC-029: no offline writes).
      setValue(previous);
      setError(failed(previous));
      reportNetworkError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-16">
      <RadioGroup
        legend="Default for new wishlists"
        name="default-visibility"
        options={OPTIONS}
        value={value}
        onChange={change}
        disabled={!online || busy}
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
