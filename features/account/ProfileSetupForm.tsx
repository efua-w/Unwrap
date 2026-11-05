"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { saveDisplayName } from "@/features/auth/actions";
import { normaliseDisplayName } from "@/lib/auth/display-name";

// GC-005 / S06 Profile setup. Boards: Entry-Profile-default-m, -d, saving, noname, offline.
// The photo control is out of scope in slice 1 (owner decision 2026-11-04): initials only.
const COPY = {
  nameMissing: "Add a name so your group knows it's you.",
  // Not in a story or design: listed in docs/copy-pending.md.
  failed: "Something went wrong on our side.",
};

export function ProfileSetupForm({ initialName, next }: { initialName: string; next: string }) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    if (busy || !online) return;

    setFailed(false);
    if (normaliseDisplayName(name).length === 0) {
      setError(COPY.nameMissing);
      (formRef.current.elements.namedItem("displayName") as HTMLInputElement | null)?.focus();
      return;
    }
    setError(null);

    setBusy(true);
    try {
      const result = await saveDisplayName(name);
      if (result.ok) {
        router.replace(next);
        return;
      }
      if (result.reason === "name-missing") return setError(COPY.nameMissing);
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/welcome?next=${encodeURIComponent(next)}`)}`);
      setFailed(true);
    } catch {
      // A Server Action that cannot reach the server throws.
      reportNetworkError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="How should people see you?"
      intro="This is how you show up in every exchange you join."
      onSubmit={handleSubmit}
      footer={
        <Button type="submit" fullWidth busy={busy} disabled={!online}>
          Continue
        </Button>
      }
    >
      <Avatar name={normaliseDisplayName(name) || initialName} size="profile" decorative />
      <Field
        label="Display name"
        name="displayName"
        autoComplete="name"
        helper="You can change this later in Profile."
        error={error ?? undefined}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
      />
      {failed ? (
        <Alert
          variant="error"
          action={
            <Button variant="link" onClick={() => setFailed(false)}>
              Try again
            </Button>
          }
        >
          {COPY.failed}
        </Alert>
      ) : null}
    </AuthFrame>
  );
}
