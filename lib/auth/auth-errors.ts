// What went wrong, in terms the screens act on. WHY: the UI never shows Supabase's own text, which
// can be technical and can reveal more than the design allows. Each screen maps a kind to its
// designed copy.
export type AuthErrorKind =
  | "network" // no connection, or the request never reached Supabase
  | "no-account" // sending a code with sign-ups off, for an address that has no account
  | "rate-limited" // too many codes or too many checks
  | "wrong-code" // the code is wrong or has expired (Supabase uses one error for both)
  | "unknown";

export type AuthErrorLike = {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
};

export function classifyAuthError(error: AuthErrorLike): AuthErrorKind {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (error.name === "AuthRetryableFetchError" || error.status === 0) return "network";
  if (code === "otp_disabled" || code === "user_not_found" || message.includes("signups not allowed")) {
    return "no-account";
  }
  if (
    error.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "over_sms_send_rate_limit"
  ) {
    return "rate-limited";
  }
  if (code === "otp_expired" || code === "invalid_credentials" || message.includes("expired or is invalid")) {
    return "wrong-code";
  }
  return "unknown";
}
