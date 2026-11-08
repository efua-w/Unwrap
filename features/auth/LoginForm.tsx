"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { isPlausibleEmail, normaliseEmail } from "@/lib/auth/email";
import { sendLoginCode } from "./email-code";
import { writePrefillEmail } from "./prefill-email";
import { rememberCodeSent } from "./verify-storage";

// GC-004 / S04 Log in. Boards: Entry-Login-default, busy, invalid, noaccount, offline.
const COPY = {
  emailIncomplete: "That email looks incomplete. Check the part after the @.",
  noAccount: "We couldn't find an account with this email.",
  // S04 has no "too many codes" frame; this is S03's line, reused (docs/copy-pending.md).
  limited: "We've sent a few codes already. Wait a few minutes, then try again.",
  // Not in a story or design: listed in docs/copy-pending.md.
  failed: "Something went wrong on our side.",
};

type Notice = "limited" | "failed" | null;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const focusEmail = () => (formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.focus();
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    if (busy || !online) return;

    const address = normaliseEmail(email);
    setNoAccount(false);
    setNotice(null);
    if (!isPlausibleEmail(address)) {
      setEmailError(COPY.emailIncomplete);
      return focusEmail();
    }
    setEmailError(null);

    setBusy(true);
    try {
      const sent = await sendLoginCode(address);
      if (!sent.ok) {
        if (sent.kind === "network") return reportNetworkError();
        if (sent.kind === "no-account") {
          setNoAccount(true);
          return setEmailError(COPY.noAccount);
        }
        return setNotice(sent.kind === "rate-limited" ? "limited" : "failed");
      }
      await rememberCodeSent({ email: address, flow: "login", next });
      router.push("/verify");
    } finally {
      setBusy(false);
    }
  }

  function tryDifferentEmail() {
    setNoAccount(false);
    setEmailError(null);
    setEmail("");
    focusEmail();
  }

  const footer = noAccount ? (
    <>
      {/* WHY a button with autoFocus: the error is announced, and focus moves to what to do next. */}
      <Button
        fullWidth
        autoFocus
        onClick={() => {
          // The address travels in sessionStorage, not the URL.
          writePrefillEmail(normaliseEmail(email));
          router.push(signupHref);
        }}
      >
        Create an account with this email
      </Button>
      <Button variant="text" fullWidth onClick={tryDifferentEmail}>
        Try a different email
      </Button>
    </>
  ) : (
    <>
      <Button type="submit" fullWidth busy={busy} disabled={!online || notice === "limited"}>
        Send code
      </Button>
      <Button variant="text" fullWidth href={signupHref} disabled={busy}>
        Create an account
      </Button>
    </>
  );

  return (
    <AuthFrame
      title="Welcome back"
      intro="Enter your email and we'll send you a code to log in."
      backHref="/"
      onSubmit={handleSubmit}
      footer={footer}
    >
      <Field
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        helper="We'll send a 6-digit code to this address."
        error={emailError ?? undefined}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailError(null);
          setNoAccount(false);
        }}
      />
      {notice ? (
        <Alert
          variant="error"
          action={
            <Button variant="link" onClick={() => setNotice(null)}>
              Try again
            </Button>
          }
        >
          {notice === "limited" ? COPY.limited : COPY.failed}
        </Alert>
      ) : null}
    </AuthFrame>
  );
}
