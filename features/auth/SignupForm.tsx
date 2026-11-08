"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { normaliseDisplayName } from "@/lib/auth/display-name";
import type { AccountStatus } from "@/lib/auth/account-status";
import { isPlausibleEmail, normaliseEmail } from "@/lib/auth/email";
import { checkAccountStatus } from "./actions";
import { sendLoginCode, sendSignupCode } from "./email-code";
import { clearPrefillEmail, usePrefillEmail } from "./prefill-email";
import { rememberCodeSent } from "./verify-storage";

// GC-003 / S03 Sign up. Boards: Entry-Signup-default, busy, errors, exists, limited, offline.
// States: default, busy, validation errors, "Account exists", too many codes, offline.
const COPY = {
  nameMissing: "Add your first name so people know who joined.",
  emailIncomplete: "That email looks incomplete. Check the part after the @.",
  exists: "There's already an account with this email.",
  limited: "We've sent a few codes already. Wait a few minutes, then try again.",
  // Not in a story or design: listed in docs/copy-pending.md.
  failed: "Something went wrong on our side.",
};

type Notice = "limited" | "failed" | null;

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [firstName, setFirstName] = useState("");
  // The address carried from Log in ("Create an account with this email"), until the person types.
  const prefill = usePrefillEmail();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? prefill;
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const focusField = (name: string) =>
    (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.focus();

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    if (busy || !online) return;

    const name = normaliseDisplayName(firstName);
    const address = normaliseEmail(email);
    const nameProblem = name.length === 0 ? COPY.nameMissing : null;
    const emailProblem = isPlausibleEmail(address) ? null : COPY.emailIncomplete;
    setNameError(nameProblem);
    setEmailError(emailProblem);
    setExists(false);
    setNotice(null);
    if (nameProblem) return focusField("firstName");
    if (emailProblem) return focusField("email");

    setBusy(true);
    try {
      // Open item 36 (owner decision 2026-11-04): the server says whether the address has a
      // confirmed account. No account, or an abandoned unconfirmed one, goes straight to the
      // sign-up code (E01), so an unconfirmed account never gets a log-in code or "Account exists".
      const status = await checkAccountStatus(address).catch((): AccountStatus => "unknown");
      if (status !== "not-confirmed") {
        // WHY a log-in code with sign-ups off for a confirmed account (R1-4, accepted): Supabase
        // answers a sign-up for an existing address with a log-in code and no error, so this call
        // both sends that code and confirms the account. It is also the fallback when the server
        // could not check ("unknown"): success means an account exists, "no account" means create
        // one. Account enumeration is accepted by the owner (planner Q3, designs S03/S04).
        const probe = await sendLoginCode(address);
        if (probe.ok) {
          await rememberCodeSent({ email: address, flow: "login", next });
          setExists(true);
          setEmailError(COPY.exists);
          return;
        }
        if (probe.kind === "network") return reportNetworkError();
        if (probe.kind === "rate-limited") return setNotice("limited");
        if (probe.kind !== "no-account") return setNotice("failed");
      }

      const sent = await sendSignupCode(address, name);
      if (!sent.ok) {
        if (sent.kind === "network") return reportNetworkError();
        return setNotice(sent.kind === "rate-limited" ? "limited" : "failed");
      }
      await rememberCodeSent({ email: address, flow: "signup", firstName: name, next });
      clearPrefillEmail();
      router.push("/verify");
    } finally {
      setBusy(false);
    }
  }

  function chooseDifferentEmail() {
    setExists(false);
    setEmailError(null);
    clearPrefillEmail();
    setEmail("");
    focusField("email");
  }

  const footer = exists ? (
    <>
      {/* WHY a button with autoFocus: the error is announced, and focus moves to what to do next. */}
      <Button fullWidth autoFocus onClick={() => router.push("/verify")}>
        Log in with this email
      </Button>
      <Button variant="text" fullWidth onClick={chooseDifferentEmail}>
        Use a different email
      </Button>
    </>
  ) : (
    <>
      <Button type="submit" fullWidth busy={busy} disabled={!online || notice === "limited"}>
        Continue
      </Button>
      <Button variant="text" fullWidth href={loginHref} disabled={busy}>
        I already have an account
      </Button>
    </>
  );

  return (
    <AuthFrame
      title="Create your account"
      intro="Just your first name and email. No password needed."
      backHref="/"
      onSubmit={handleSubmit}
      footer={footer}
    >
      <div className="flex flex-col gap-20">
        <Field
          label="First name"
          name="firstName"
          autoComplete="given-name"
          placeholder="Your first name"
          helper="People in your exchanges see this name."
          error={nameError ?? undefined}
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            setNameError(null);
          }}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          helper="We'll email you a 6-digit code."
          error={emailError ?? undefined}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
            setExists(false);
          }}
        />
      </div>
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
