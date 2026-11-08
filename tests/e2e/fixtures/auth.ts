import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BrowserContext, Page, Route } from "@playwright/test";

// Test-only helpers for the entry flow. SUPABASE_SECRET_KEY is read here; in app code only the
// server-only lib/supabase/admin.ts may read it, and it never carries a NEXT_PUBLIC_ prefix. It is used to create throwaway
// users and to mint the 6-digit code an email would carry, so no real inbox is needed.
// Everything that needs it checks dbStatus() first and skips with a reason when it is absent.

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_ENV = process.env.SUPABASE_SECRET_KEY;

export type DbStatus = { ready: true } | { ready: false; reason: string };

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!URL_ENV || !SECRET_ENV) throw new Error("adminClient needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  admin ??= createClient(URL_ENV, SECRET_ENV, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

let cached: Promise<DbStatus> | null = null;

// WHY a probe instead of just the key check: with the key but without the profiles migration
// applied, the specs would fail with database errors. A clear skip says what to do first.
export function dbStatus(): Promise<DbStatus> {
  cached ??= (async (): Promise<DbStatus> => {
    if (!URL_ENV) return { ready: false, reason: "NEXT_PUBLIC_SUPABASE_URL is not set (see .env.example)." };
    if (!SECRET_ENV) {
      return { ready: false, reason: "SUPABASE_SECRET_KEY is not set in .env.local, so signed-in specs cannot create users." };
    }
    // WHY not a HEAD request: a missing table comes back without an error body on HEAD.
    const { error } = await adminClient().from("profiles").select("id").limit(1);
    if (error) {
      return {
        ready: false,
        reason: "The profiles_user_settings migration is not applied to the Supabase project the app points at.",
      };
    }
    return { ready: true };
  })();
  return cached;
}

export function uniqueEmail(label: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // WHY resend.dev: Resend's "delivered" address accepts mail without a real inbox.
  return `delivered+uw-e2e-${label}-${id}@resend.dev`;
}

// Creates a confirmed user the way sign-up would: first_name in the metadata, so the database
// trigger writes the profile and settings rows. No email is sent.
export async function createTestUser(email: string, firstName: string, confirmed = true): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    email_confirm: confirmed,
    user_metadata: { first_name: firstName },
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message ?? "no user"}`);
  return data.user.id;
}

// profiles.id has no ON DELETE CASCADE (account deletion anonymises, GC-028), so the profile goes
// first; user_settings cascades with the user.
export async function deleteTestUser(email: string): Promise<void> {
  const db = adminClient();
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email === email);
  if (!user) return;
  await db.from("profiles").delete().eq("id", user.id);
  await db.auth.admin.deleteUser(user.id);
}

// The code an email would carry. generateLink sends nothing; it returns the one-time code.
export async function mintCode(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  const code = data?.properties?.email_otp;
  if (error || !code) throw new Error(`mintCode failed: ${error?.message ?? "no code"}`);
  // WHY: the app and the email templates are built for 6 digits (GC-003). A project still on
  // Supabase's default length would make every code here look wrong, so say what to change.
  if (code.length !== 6) {
    throw new Error(`The Supabase project sends ${code.length}-digit codes; set Auth > Providers > Email > OTP length to 6 (owner checklist in docs/tasks/slice-1.md).`);
  }
  return code;
}

const VERIFY_COOKIE = "uw_verify";
const VERIFY_STORAGE_KEY = "uw_verify";

export type SeedVerify = { email: string; flow: "signup" | "login"; firstName?: string; next?: string; sentAt?: number };

function stateJson(input: SeedVerify): string {
  return JSON.stringify({ v: 1, ...input, sentAt: input.sentAt ?? Date.now() });
}

// Puts the verify state where the app keeps it, as if a code had just been sent, so a test can
// open /verify directly. `where` picks the cookie (the default: the page writes the backup itself), the localStorage backup, or both. A storage seed is re-applied on every navigation of the page, so tests that clear it use the cookie only.
export async function seedVerifyState(
  context: BrowserContext,
  page: Page,
  input: SeedVerify,
  where: "cookie" | "storage" | "both" = "cookie",
): Promise<void> {
  const json = stateJson(input);
  if (where !== "storage") {
    await context.addCookies([
      {
        name: VERIFY_COOKIE,
        value: encodeURIComponent(json),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  if (where !== "cookie") {
    await page.addInitScript(
      ([key, value]) => {
        if (!window.localStorage.getItem(key as string)) window.localStorage.setItem(key as string, value as string);
      },
      [VERIFY_STORAGE_KEY, json],
    );
  }
}

// Signs a user in through the real Verify screen, with a minted code, and waits for the redirect.
// WHY not the Log in screen: it would send a real email through the SMTP provider, which is not
// what these specs test. `flow` decides where Verify sends the person (signup goes to Profile setup).
export async function signInThroughVerify(
  context: BrowserContext,
  page: Page,
  email: string,
  options: { flow?: "signup" | "login"; next?: string; firstName?: string } = {},
): Promise<void> {
  const { flow = "login", next, firstName } = options;
  await seedVerifyState(context, page, { email, flow, next, firstName });
  const code = await mintCode(email);
  await page.goto("/verify");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("6-digit code").fill(code);
  await page.waitForURL((url) => url.pathname !== "/verify", { timeout: 30_000 });
  // WHY: a later page.goto must not abort a navigation that is still settling (ERR_ABORTED flake).
  await page.waitForLoadState("networkidle");
}

// Browser-side Supabase auth calls are answered by a stub, so the screens' states can be driven
// without a database, an email provider, or the rate limits.
export type OtpStub = { status: number; body: Record<string, unknown> };

export const OTP_SENT: OtpStub = { status: 200, body: {} };
export const OTP_NO_ACCOUNT: OtpStub = {
  status: 422,
  body: { code: 422, error_code: "otp_disabled", msg: "Signups not allowed for otp" },
};
export const OTP_RATE_LIMITED: OtpStub = {
  status: 429,
  body: { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" },
};
export const VERIFY_WRONG: OtpStub = {
  status: 403,
  body: { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" },
};
export const VERIFY_LIMITED: OtpStub = {
  status: 429,
  body: { code: 429, error_code: "over_request_rate_limit", msg: "Request rate limit reached" },
};

// A successful verify response, for the destination tests. The session is structurally valid but
// fake, so the server rejects it and the next page sends the visitor to Log in: the redirect target
// (/login?next=<destination>) shows where Verify meant to go.
function fakeJwt(): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "00000000-0000-4000-8000-000000000099", exp: 4102444800, role: "authenticated" })}.sig`;
}

export function verifyOk(options: { firstConfirmation: boolean }): OtpStub {
  const confirmed = "2026-11-04T10:00:00.000Z";
  return {
    status: 200,
    body: {
      access_token: fakeJwt(),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: 4102444800,
      refresh_token: "fake-refresh",
      user: {
        id: "00000000-0000-4000-8000-000000000099",
        aud: "authenticated",
        role: "authenticated",
        email: "amaka.obi@example.com",
        created_at: "2026-11-04T09:00:00.000Z",
        email_confirmed_at: confirmed,
        // Same instant: this sign-in confirmed the address. Seconds later: confirmed before.
        last_sign_in_at: options.firstConfirmation ? "2026-11-04T10:00:00.005Z" : "2026-11-04T10:00:07.000Z",
        app_metadata: {},
        user_metadata: {},
      },
    },
  };
}

export type AuthCalls = {
  otp: Array<{ create_user?: boolean; data?: { first_name?: string }; email?: string }>;
  verify: number;
  /** How many times Sign up's server-side account check answered. */
  account: number;
};

/** What Sign up's server-side account check (checkAccountStatus) answers. */
export type AccountStub = "confirmed" | "not-confirmed" | "unknown";
const ACCOUNT_ANSWER = /"(?:confirmed|not-confirmed|unknown)"/;

function fulfil(route: Route, stub: OtpStub) {
  return route.fulfill({
    status: stub.status,
    contentType: "application/json",
    body: JSON.stringify(stub.body),
  });
}

// `otp` stubs are used in order; the last one repeats.
// `account` is Sign up's server-side check. WHY rewrite the real response: the Server Action runs
// on the dev server against the real project, and its wire format belongs to Next. The request
// still goes through; only the one-word answer is swapped, so the test controls it without a hook
// in app code. Defaults to "not-confirmed" (a new address).
export async function stubAuth(
  page: Page,
  options: { otp?: OtpStub[]; verify?: OtpStub[]; verifyDelayMs?: number; account?: AccountStub },
): Promise<AuthCalls> {
  const calls: AuthCalls = { otp: [], verify: 0, account: 0 };
  const account = options.account ?? "not-confirmed";
  await page.route(
    (url) => url.pathname === "/signup",
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) return route.fallback();
      try {
        const response = await route.fetch();
        const body = await response.text();
        const headers = { ...response.headers() };
        delete headers["content-length"];
        if (!ACCOUNT_ANSWER.test(body)) return await route.fulfill({ response, headers, body });
        calls.account += 1;
        return await route.fulfill({ response, headers, body: body.replace(ACCOUNT_ANSWER, JSON.stringify(account)) });
      } catch (error) {
        // WHY (T2-1): when a test ends while an action is still in flight, the page closes under this
        // handler and Playwright disposes the response ("Response has been disposed"). Nobody is
        // waiting for that answer any more, so only that case is ignored; anything else still fails.
        if (page.isClosed()) return;
        throw error;
      }
    },
  );
  const otp = options.otp ?? [OTP_SENT];
  const verify = options.verify ?? [VERIFY_WRONG];
  await page.route("**/auth/v1/otp**", async (route) => {
    calls.otp.push(route.request().postDataJSON() as AuthCalls["otp"][number]);
    const stub = otp[Math.min(calls.otp.length - 1, otp.length - 1)] ?? OTP_SENT;
    await fulfil(route, stub);
  });
  await page.route("**/auth/v1/verify**", async (route) => {
    calls.verify += 1;
    if (options.verifyDelayMs) await new Promise((r) => setTimeout(r, options.verifyDelayMs));
    const stub = verify[Math.min(calls.verify - 1, verify.length - 1)] ?? VERIFY_WRONG;
    await fulfil(route, stub);
  });
  return calls;
}
