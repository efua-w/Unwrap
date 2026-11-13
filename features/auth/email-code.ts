import { classifyAuthError, type AuthErrorKind } from "@/lib/auth/auth-errors";
import { createClient } from "@/lib/supabase/client";

// The two calls that run in the browser (owner decision 2026-11-04): Supabase counts rate limits
// per IP, so a shared server IP would lock everyone out together. Each returns a kind, never
// Supabase's own text.

export type CodeResult = { ok: true } | { ok: false; kind: AuthErrorKind };

type ErrorLike = { name?: string; status?: number; code?: string; message?: string };

function toResult(error: ErrorLike | null): CodeResult {
  return error ? { ok: false, kind: classifyAuthError(error) } : { ok: true };
}

// A fetch that never reaches Supabase can throw instead of returning an error object.
async function guarded(call: () => Promise<{ error: ErrorLike | null }>): Promise<CodeResult> {
  try {
    const { error } = await call();
    return toResult(error);
  } catch {
    return { ok: false, kind: "network" };
  }
}

// Log in, and Resend on a log-in code. WHY shouldCreateUser false: an unknown address must not
// silently become an account. Supabase answers with an error we map to "no account" (S04).
export function sendLoginCode(email: string): Promise<CodeResult> {
  return guarded(() => createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } }));
}

// Sign up. first_name travels as user metadata; the database trigger turns it into the display
// name and refuses the sign-up without one (migration profiles_user_settings).
export function sendSignupCode(email: string, firstName: string): Promise<CodeResult> {
  return guarded(() =>
    createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { first_name: firstName } },
    }),
  );
}

export type VerifyResult = CodeResult;

export async function verifyCode(email: string, token: string): Promise<VerifyResult> {
  try {
    const { error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
    if (error) return { ok: false, kind: classifyAuthError(error) };
    return { ok: true };
  } catch {
    return { ok: false, kind: "network" };
  }
}
