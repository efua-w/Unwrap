"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { useToast } from "@/components/ui/Toast";
import {
  cooldownRemainingMs,
  destinationAfterVerify,
  formatCountdown,
  type VerifyState,
} from "@/lib/auth/verify-state";
import { changeEmail as changeEmailAction, finishSignIn, saveVerifyState } from "./actions";
import { sendLoginCode, sendSignupCode, verifyCode } from "./email-code";
import {
  clearStoredVerifyState,
  readStoredVerifyState,
  rememberCodeSent,
  useStoredVerifyState,
  writeStoredVerifyState,
} from "./verify-storage";
import { useNow } from "./use-now";

// GC-003 / GC-004 / S05 Verify code. Boards: Entry-Verify-default, login, checking, wrong, locked,
// resent, offline. There is no submit button: the code is checked as soon as all 6 digits are in.
const COPY = {
  wrong: "That code didn't work. Check the latest email, or send a new code.",
  locked: "Too many tries. Send a new code to keep going.",
  helper: "It checks automatically once all 6 digits are in. The code works for 10 minutes.",
  // S03's line, reused for a resend that is refused (docs/copy-pending.md).
  limited: "We've sent a few codes already. Wait a few minutes, then try again.",
  // Not in a story or design: listed in docs/copy-pending.md.
  failed: "Something went wrong on our side.",
};

type Status = "idle" | "checking" | "locked";
type Notice = "limited" | "failed" | null;

export function VerifyForm({ initial }: { initial: VerifyState | null }) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const stored = useStoredVerifyState();
  // Set after a resend: the new send time replaces the old state.
  const [resent, setResent] = useState<VerifyState | null>(null);
  const state = resent ?? initial ?? stored;
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [wrong, setWrong] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [resending, setResending] = useState(false);
  const now = useNow();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // WHY a flag and an effect: after a wrong code or a resend the field is re-enabled by the next
  // render, and a disabled field cannot take focus, so focus is moved once that render is done.
  const refocus = useRef(false);
  const leaving = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    const input = inputRef.current;
    // WHY wait while disabled: after "Send a new code" the field can still be disabled in the first
    // render that runs this, and focus() on a disabled field does nothing (flaky focus, round 4).
    if (!input || input.disabled) return;
    refocus.current = false;
    input.focus();
  });

  // Resume (GC-003): the cookie state came from the server; otherwise the storage copy is used;
  // with neither, there is nothing to verify, so go back to Sign up.
  useEffect(() => {
    // WHY: once the person is leaving (verified, or Change email), nothing may write the state back.
    if (leaving.current) return;
    if (state) {
      writeStoredVerifyState(state);
      // State that came only from storage: put the cookie back too, so a reload does not depend
      // on storage alone.
      if (!initial && !resent) {
        saveVerifyState(state).catch(() => {
          // The storage copy is enough for this visit.
        });
      }
      return;
    }
    // The storage snapshot arrives on the render after hydration, so read it directly here.
    if (readStoredVerifyState()) return;
    // WHY: whatever is left in storage is stale or invalid, and it still holds an email address.
    clearStoredVerifyState();
    router.replace("/signup");
  }, [state, initial, resent, router]);

  const flow = state?.flow ?? "signup";
  const parentHref = flow === "login" ? "/login" : "/signup";
  const remaining = state && now !== null ? cooldownRemainingMs(state.sentAt, now) : null;

  const onComplete = useCallback(
    async (token: string) => {
      if (!state) return;
      setWrong(false);
      setNotice(null);
      setStatus("checking");
      const result = await verifyCode(state.email, token);
      if (result.ok) {
        leaving.current = true;
        clearStoredVerifyState();
        const destination = destinationAfterVerify(state);
        try {
          // Records the zone, clears the cookie and redirects, all in one response.
          await finishSignIn({
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            flow: state.flow,
            next: state.next,
          });
        } catch {
          // The person is signed in; only the hand-off failed (network). Navigate ourselves.
          router.replace(destination);
        }
        return; // stays on "Checking your code" until the page changes
      }
      setCode("");
      if (result.kind === "wrong-code") {
        setStatus("idle");
        setWrong(true);
        refocus.current = true;
      } else if (result.kind === "rate-limited") {
        setStatus("locked");
      } else if (result.kind === "network") {
        setStatus("idle");
        reportNetworkError();
        refocus.current = true;
      } else {
        setStatus("idle");
        setNotice("failed");
      }
    },
    [state, router, reportNetworkError],
  );

  async function resend() {
    if (!state || resending || !online) return;
    setResending(true);
    setNotice(null);
    try {
      // A sign-up code is sent again with the account's name; a log-in code never creates anyone.
      const result =
        state.flow === "signup" && state.firstName
          ? await sendSignupCode(state.email, state.firstName)
          : await sendLoginCode(state.email);
      if (!result.ok) {
        if (result.kind === "network") return reportNetworkError();
        return setNotice(result.kind === "rate-limited" ? "limited" : "failed");
      }
      const saved = await rememberCodeSent({
        email: state.email,
        flow: state.flow,
        firstName: state.firstName,
        next: state.next,
      });
      if (saved) setResent(saved);
      setCode("");
      setWrong(false);
      setStatus("idle");
      toast.show({ message: `New code sent to ${state.email}.` });
      refocus.current = true;
    } finally {
      setResending(false);
    }
  }

  function changeEmail() {
    leaving.current = true;
    clearStoredVerifyState();
    // WHY an action that redirects (not clear-then-push): a separate action re-rendered /verify and
    // could cancel the push, leaving the person on Verify.
    changeEmailAction(flow).catch(() => router.push(parentHref));
  }

  const locked = status === "locked";
  const cooling = remaining !== null && remaining > 0;

  const footer = locked ? (
    // WHY autoFocus: the field is now disabled, so focus moves to the one thing to do next.
    <Button fullWidth autoFocus busy={resending} disabled={!online} onClick={resend}>
      Send a new code
    </Button>
  ) : null;

  return (
    <AuthFrame
      title="Check your email"
      backHref={parentHref}
      intro={
        state ? (
          <>
            We sent a 6-digit code to <strong className="font-semibold text-text-default">{state.email}</strong>.
          </>
        ) : undefined
      }
      onSubmit={(event) => event.preventDefault()}
      footer={footer}
    >
      {state ? (
        <div className="flex flex-col gap-8">
          <OtpInput
            label="6-digit code"
            name="code"
            value={code}
            onChange={(next) => {
              setCode(next);
              setWrong(false);
            }}
            onComplete={onComplete}
            helper={locked ? COPY.locked : COPY.helper}
            error={wrong ? COPY.wrong : undefined}
            checking={status === "checking"}
            disabled={locked}
            autoFocus
            inputRef={inputRef}
          />
          <div className="flex flex-wrap items-center gap-x-24 gap-y-4">
            {locked ? null : remaining === null ? (
              <span className="min-h-touch-target" />
            ) : cooling ? (
              <span className="inline-flex min-h-touch-target items-center text-body-sm-regular text-text-muted">
                You can resend in {formatCountdown(remaining)}
              </span>
            ) : (
              <Button variant="link" busy={resending} disabled={!online} onClick={resend}>
                Resend code
              </Button>
            )}
            <Button variant="link" onClick={changeEmail}>
              Change email
            </Button>
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
        </div>
      ) : null}
    </AuthFrame>
  );
}
