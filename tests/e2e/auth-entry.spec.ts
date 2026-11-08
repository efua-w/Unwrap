import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  OTP_NO_ACCOUNT,
  OTP_RATE_LIMITED,
  OTP_SENT,
  VERIFY_LIMITED,
  verifyOk,
  VERIFY_WRONG,
  seedVerifyState,
  stubAuth,
} from "./fixtures/auth";

// Slice 1 entry screens that need no database and no email provider: every Supabase auth call from
// the browser is answered by a stub (fixtures/auth.ts), and the Server Actions that run are the
// real ones. The signed-in half lives in auth-signed-in.spec.ts.

const EMAIL = "amaka.obi@example.com";
const OFFLINE_COPY = "You're offline. Pages you've opened stay on screen.";

// WHY wait for network idle: a form submitted before React hydrates would do a native GET submit.
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function fillSignup(page: Page, name = "Amaka", email = EMAIL) {
  await page.getByLabel("First name").fill(name);
  await page.getByLabel("Email").fill(email);
}

test.describe("Landing (GC-001)", () => {
  test("shows the exact copy, the three steps and the trust lines", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1, name: "Secret Santa, without the spreadsheet." })).toBeVisible();
    await expect(
      page.getByText(
        "Start an exchange, share one link, and we draw names on the day. Everyone adds a wishlist, and nobody sees who got whom.",
      ),
    ).toBeVisible();
    for (const line of [
      "Free for everyone in the exchange.",
      "Only you see who you got. Not even the organiser.",
      "No passwords. We email you a code.",
    ]) {
      await expect(page.getByText(line)).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 2, name: "How Unwrap works" })).toBeVisible();
    const steps = page.getByRole("listitem").filter({ hasText: /Start an exchange|Share the link|We draw names/ });
    await expect(steps).toHaveCount(3);
    await expect(page.getByText("Give it a name, a budget and a day to swap gifts.")).toBeVisible();
    await expect(page.getByText("Send it on WhatsApp. People join and add a wishlist.")).toBeVisible();
  });

  test("Get started and Log in lead to Sign up and Log in", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toHaveAttribute("href", "/login");
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("shows the offline banner when the connection drops", async ({ page, context }) => {
    await open(page, "/");
    await context.setOffline(true);
    await expect(page.getByText(OFFLINE_COPY)).toBeVisible();
  });
});

test.describe("Sign up validation (GC-003, no request is sent)", () => {
  test("a blank form shows both designed errors and focuses the first field", async ({ page }) => {
    const calls = await stubAuth(page, {});
    await open(page, "/signup");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Add your first name so people know who joined.")).toBeVisible();
    await expect(page.getByText("That email looks incomplete. Check the part after the @.")).toBeVisible();
    await expect(page.getByLabel("First name")).toBeFocused();
    await expect(page.getByLabel("First name")).toHaveAttribute("aria-invalid", "true");
    expect(calls.otp).toHaveLength(0);
  });

  test("an incomplete email is refused and the error clears while typing", async ({ page }) => {
    const calls = await stubAuth(page, {});
    await open(page, "/signup");
    await fillSignup(page, "Amaka", "amaka.obi@gmail");
    await page.getByRole("button", { name: "Continue" }).click();
    const error = page.getByText("That email looks incomplete. Check the part after the @.");
    await expect(error).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused();
    await page.getByLabel("Email").fill("amaka.obi@gmail.com");
    await expect(error).toBeHidden();
    expect(calls.otp).toHaveLength(0);
  });

  test("shows the designed fields and helpers", async ({ page }) => {
    await open(page, "/signup");
    await expect(page.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
    await expect(page.getByText("Just your first name and email. No password needed.")).toBeVisible();
    await expect(page.getByText("People in your exchanges see this name.")).toBeVisible();
    await expect(page.getByText("We'll email you a 6-digit code.")).toBeVisible();
    await expect(page.getByRole("link", { name: "I already have an account" })).toHaveAttribute("href", "/login");
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  });
});

test.describe("Sign up and Log in states (GC-003, GC-004)", () => {
  test("a new email: the server finds no confirmed account, so the sign-up code is sent with the first name, and Verify opens", async ({ page }) => {
    const calls = await stubAuth(page, { account: "not-confirmed", otp: [OTP_SENT] });
    await open(page, "/signup");
    await fillSignup(page, "  Amaka  ", "Amaka.Obi@Example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByText("We sent a 6-digit code to")).toBeVisible();
    await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();
    expect(calls.account).toBe(1);
    // Open item 36: no log-in probe, so an abandoned (unconfirmed) account never gets a log-in code.
    expect(calls.otp).toHaveLength(1);
    expect(calls.otp[0]?.create_user).toBe(true);
    expect(calls.otp[0]?.data?.first_name).toBe("Amaka");
    expect(calls.otp[0]?.email).toBe(EMAIL);
  });

  test("an unconfirmed (abandoned) account continues as a sign-up: no Account exists, and Verify is the sign-up one", async ({ page }) => {
    // The server answers "not-confirmed" for both a new and an unconfirmed address (one bit only).
    const calls = await stubAuth(page, { account: "not-confirmed", otp: [OTP_SENT] });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByText("There's already an account with this email.")).toHaveCount(0);
    expect(calls.otp.map((c) => c.create_user)).toEqual([true]);
    // The saved state is the sign-up flow, so Resend sends E01 again with the name.
    const saved = await page.evaluate(() => window.localStorage.getItem("uw_verify"));
    expect(JSON.parse(saved ?? "{}")).toMatchObject({ flow: "signup", firstName: "Amaka", email: EMAIL });
  });

  test("a confirmed account shows the Account exists state and goes to Verify without a second code", async ({ page }) => {
    const calls = await stubAuth(page, { account: "confirmed", otp: [OTP_SENT] });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("There's already an account with this email.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log in with this email" })).toBeFocused();
    await page.getByRole("button", { name: "Log in with this email" }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();
    // Only the log-in code was sent (R1-4); it is the one Verify checks.
    expect(calls.otp).toHaveLength(1);
    expect(calls.otp[0]?.create_user).toBe(false);
  });

  test("when the server cannot check, Sign up falls back to the log-in probe", async ({ page }) => {
    const calls = await stubAuth(page, { account: "unknown", otp: [OTP_NO_ACCOUNT, OTP_SENT] });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/verify$/);
    expect(calls.otp.map((c) => c.create_user)).toEqual([false, true]);
  });

  test("Use a different email clears the Account exists state", async ({ page }) => {
    await stubAuth(page, { account: "confirmed", otp: [OTP_SENT] });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByText("There's already an account with this email.")).toBeHidden();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("too many codes shows the designed alert, disables Continue, and Try again re-enables it", async ({ page }) => {
    await stubAuth(page, { otp: [OTP_RATE_LIMITED] });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("We've sent a few codes already. Wait a few minutes, then try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("a failed request raises the offline banner and keeps the typed values", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (route) => route.abort("failed"));
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(OFFLINE_COPY)).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue("Amaka");
    await expect(page.getByLabel("Email")).toHaveValue(EMAIL);
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("offline: Continue is disabled and the banner shows", async ({ page, context }) => {
    await open(page, "/signup");
    await fillSignup(page);
    await context.setOffline(true);
    await expect(page.getByText(OFFLINE_COPY)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("Continue shows busy while the request is in flight, and the other action is disabled", async ({ page }) => {
    await page.route("**/auth/v1/otp**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify(OTP_NO_ACCOUNT.body) });
    });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("link", { name: "I already have an account" })).toHaveAttribute("aria-disabled", "true");
  });

  test("Log in: the designed copy, and an invalid email is refused without a request", async ({ page }) => {
    const calls = await stubAuth(page, {});
    await open(page, "/login");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Enter your email and we'll send you a code to log in.")).toBeVisible();
    await expect(page.getByText("We'll send a 6-digit code to this address.")).toBeVisible();
    await page.getByLabel("Email").fill("amaka.obi@");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("That email looks incomplete. Check the part after the @.")).toBeVisible();
    expect(calls.otp).toHaveLength(0);
  });

  test("Log in with an unknown email shows No account found and the two designed actions", async ({ page }) => {
    const calls = await stubAuth(page, { otp: [OTP_NO_ACCOUNT] });
    await open(page, "/login");
    await page.getByLabel("Email").fill("amaka.obi@yahoo.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("We couldn't find an account with this email.")).toBeVisible();
    // WHY: shouldCreateUser must be false on Log in, or an unknown address would silently become an account.
    expect(calls.otp[0]?.create_user).toBe(false);
    await page.getByRole("button", { name: "Try a different email" }).click();
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
    await page.getByLabel("Email").fill("amaka.obi@yahoo.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("button", { name: "Create an account with this email" })).toBeFocused();
    await page.getByRole("button", { name: "Create an account with this email" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    // R1-9: the address is carried (not in the URL) and the field is filled in.
    await expect(page.getByLabel("Email")).toHaveValue("amaka.obi@yahoo.com");
    expect(page.url()).not.toContain("yahoo");
  });

  test("Log in with a known email opens Verify", async ({ page }) => {
    await stubAuth(page, { otp: [OTP_SENT] });
    await open(page, "/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();
  });

  test("Log in too many codes shows the same alert", async ({ page }) => {
    await stubAuth(page, { otp: [OTP_RATE_LIMITED] });
    await open(page, "/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("We've sent a few codes already. Wait a few minutes, then try again.")).toBeVisible();
  });
});

test.describe("Verify code (GC-003, GC-004)", () => {
  async function openVerify(page: Page, context: import("@playwright/test").BrowserContext, flow: "signup" | "login" = "login") {
    await seedVerifyState(context, page, { email: EMAIL, flow, firstName: flow === "signup" ? "Amaka" : undefined });
    await open(page, "/verify");
  }

  test("shows the email, the helper, a countdown from 0:59 and Change email, and no submit button", async ({ page, context }) => {
    // WHY a fixed clock (T2-1): "0:59" must not depend on how fast the dev server loads the page.
    // Date.now() in the page stays one second after the code was sent; timers still run.
    const sentAt = Date.now();
    await page.clock.setFixedTime(sentAt + 1000);
    await seedVerifyState(context, page, { email: EMAIL, flow: "login", sentAt });
    await open(page, "/verify");
    await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
    await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();
    await expect(
      page.getByText("It checks automatically once all 6 digits are in. The code works for 10 minutes."),
    ).toBeVisible();
    await expect(page.getByText("You can resend in 0:59")).toBeVisible();
    await expect(page.getByRole("button", { name: "Change email" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Verify|Continue|Submit)/ })).toHaveCount(0);
    await expect(page.getByLabel("6-digit code")).toBeFocused();
    await expect(page.getByLabel("6-digit code")).toHaveAttribute("autocomplete", "one-time-code");
    await expect(page.getByLabel("6-digit code")).toHaveAttribute("inputmode", "numeric");
  });

  test("with no saved state it goes back to Sign up", async ({ page }) => {
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("survives a reload, then the cookie being removed (localStorage), and only then goes back to Sign up", async ({ page, context }) => {
    await stubAuth(page, { account: "not-confirmed", otp: [OTP_SENT] });
    await open(page, "/signup");
    await fillSignup(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/verify$/);

    await page.reload();
    await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();

    await context.clearCookies({ name: "uw_verify" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();
    // The cookie is put back from the storage copy.
    await expect.poll(async () => (await context.cookies()).some((c) => c.name === "uw_verify")).toBe(true);

    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("a wrong code shows the designed error, clears the boxes and keeps focus", async ({ page, context }) => {
    const calls = await stubAuth(page, { verify: [VERIFY_WRONG] });
    await openVerify(page, context);
    const input = page.getByLabel("6-digit code");
    await input.fill("123456");
    await expect(page.getByText("That code didn't work. Check the latest email, or send a new code.")).toBeVisible();
    // R1-2: the error is a live alert, and focus is back in the field so it is read out.
    await expect(page.getByRole("alert").filter({ hasText: "That code didn't work." })).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(calls.verify).toBe(1);
    // Typing again clears the error.
    await input.pressSequentially("1");
    await expect(page.getByText("That code didn't work. Check the latest email, or send a new code.")).toBeHidden();
  });

  test("checking shows 'Checking your code' while the request runs", async ({ page, context }) => {
    await stubAuth(page, { verify: [VERIFY_WRONG], verifyDelayMs: 1500 });
    await openVerify(page, context);
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page.getByRole("status").filter({ hasText: "Checking your code" })).toBeVisible();
    await expect(page.getByText("That code didn't work.")).toBeVisible();
  });

  test("the code is checked once, on the sixth digit, and non-digits are dropped", async ({ page, context }) => {
    const calls = await stubAuth(page, { verify: [VERIFY_WRONG], verifyDelayMs: 300 });
    await openVerify(page, context);
    const input = page.getByLabel("6-digit code");
    await input.pressSequentially("12ab345");
    await expect(input).toHaveValue("12345");
    expect(calls.verify).toBe(0);
    await input.pressSequentially("6");
    await expect(page.getByText("That code didn't work.")).toBeVisible();
    expect(calls.verify).toBe(1);
  });

  test("a pasted code with spaces is read and checked", async ({ page, context }) => {
    const calls = await stubAuth(page, { verify: [VERIFY_WRONG] });
    await openVerify(page, context);
    await page.getByLabel("6-digit code").evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text", "482 915");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(page.getByText("That code didn't work.")).toBeVisible();
    expect(calls.verify).toBe(1);
  });

  test("too many tries locks the field and offers Send a new code, which re-opens it", async ({ page, context }) => {
    const calls = await stubAuth(page, { verify: [VERIFY_LIMITED], otp: [OTP_SENT] });
    await openVerify(page, context);
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page.getByText("Too many tries. Send a new code to keep going.")).toBeVisible();
    await expect(page.getByLabel("6-digit code")).toBeDisabled();
    // R1-2: announced, and focus moves to the one next action.
    await expect(page.getByRole("alert").filter({ hasText: "Too many tries." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new code" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Change email" })).toBeVisible();
    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByText(`New code sent to ${EMAIL}.`)).toBeVisible();
    await expect(page.getByLabel("6-digit code")).toBeEnabled();
    await expect(page.getByLabel("6-digit code")).toBeFocused();
    expect(calls.otp).toHaveLength(1);
  });

  test("Resend appears when the 60 seconds are up, sends a log-in code, and restarts the countdown", async ({ page, context }) => {
    const calls = await stubAuth(page, { otp: [OTP_SENT] });
    // 57 seconds in: the countdown is on screen and runs out within a few seconds.
    await seedVerifyState(context, page, { email: EMAIL, flow: "login", sentAt: Date.now() - 57_000 });
    await open(page, "/verify");
    // WHY no check of the last seconds of the countdown here: on a slow dev server the page can
    // take longer than the 3 seconds left to load, so the countdown may already be over. The
    // countdown itself is checked from 0:59 in the test above.
    await expect(page.getByRole("button", { name: "Resend code" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(page.getByText(`New code sent to ${EMAIL}.`)).toBeVisible();
    await expect(page.getByText(/You can resend in 0:[0-9][0-9]/)).toBeVisible();
    expect(calls.otp).toHaveLength(1);
    // WHY: a log-in code must never create an account.
    expect(calls.otp[0]?.create_user).toBe(false);
  });

  test("Resend on a sign-up code sends it again with the first name", async ({ page, context }) => {
    const calls = await stubAuth(page, { otp: [OTP_SENT] });
    await seedVerifyState(context, page, { email: EMAIL, flow: "signup", firstName: "Amaka", sentAt: Date.now() - 120_000 });
    await open(page, "/verify");
    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(page.getByText(`New code sent to ${EMAIL}.`)).toBeVisible();
    expect(calls.otp[0]?.create_user).toBe(true);
    expect(calls.otp[0]?.data?.first_name).toBe("Amaka");
  });

  test("a refused resend shows the designed alert", async ({ page, context }) => {
    await stubAuth(page, { otp: [OTP_RATE_LIMITED] });
    await seedVerifyState(context, page, { email: EMAIL, flow: "login", sentAt: Date.now() - 120_000 });
    await open(page, "/verify");
    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(page.getByText("We've sent a few codes already. Wait a few minutes, then try again.")).toBeVisible();
  });

  test("offline: Resend is disabled and the banner shows", async ({ page, context }) => {
    await seedVerifyState(context, page, { email: EMAIL, flow: "login", sentAt: Date.now() - 120_000 });
    await open(page, "/verify");
    await context.setOffline(true);
    await expect(page.getByText(OFFLINE_COPY)).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend code" })).toBeDisabled();
  });

  test("Change email clears the saved state and returns to the right form", async ({ page, context }) => {
    await openVerify(page, context, "login");
    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("a tampered cookie is ignored", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "uw_verify",
        value: encodeURIComponent(JSON.stringify({ v: 1, email: EMAIL, flow: "login", next: "//evil.com", sentAt: Date.now() })),
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe("Auth gate and next (GC-003, GC-004)", () => {
  for (const path of ["/home", "/profile", "/welcome"]) {
    test(`${path} sends a signed-out visitor to Log in and remembers where they were going`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
      await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    });
  }

  test("a safe next is carried to Sign up; an unsafe one is dropped", async ({ page }) => {
    await open(page, "/login?next=%2Fexchanges%2F1");
    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup?next=%2Fexchanges%2F1");
    for (const bad of ["//evil.com", "https://evil.com", "/%2F%2Fevil.com", "/\\evil.com"]) {
      await open(page, `/login?next=${encodeURIComponent(bad)}`);
      await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
    }
  });
});

test.describe("Pinned actions stay above the keyboard", () => {
  test("below 768 the main action stays in view when the screen is short (the keyboard open)", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile-390", "pinned actions are a below-768 behaviour");
    await page.setViewportSize({ width: 390, height: 360 });
    for (const path of ["/signup", "/login"]) {
      await open(page, path);
      const main = page.getByRole("button", { name: /^(Continue|Send code)$/ });
      const box = await main.boundingBox();
      expect(box, path).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0), path).toBeLessThanOrEqual(360);
      expect(box?.y ?? -1, path).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("OtpInput gallery", () => {
  test("reports one completion per fill, strips non-digits, and accepts paste", async ({ page }) => {
    await open(page, "/dev/components");
    const input = page.getByLabel("6-digit code").first();
    const completed = page.getByTestId("otp-completed");
    await input.pressSequentially("48a2");
    await expect(input).toHaveValue("482");
    await expect(completed).toHaveText("Completed 0");
    await input.pressSequentially("915");
    await expect(completed).toHaveText("Completed 1: 482915");
    await input.fill("");
    await input.evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text", "111-222");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(completed).toHaveText("Completed 2: 111222");
  });
});

test.describe("Accessibility and board screenshots", () => {
  const SCREENS: Array<{ name: string; path: string; seed?: boolean }> = [
    { name: "landing", path: "/" },
    { name: "signup", path: "/signup" },
    { name: "login", path: "/login" },
    { name: "verify", path: "/verify", seed: true },
  ];
  for (const screen of SCREENS) {
    test(`${screen.name} has no axe violations and saves a screenshot`, async ({ page, context }, info) => {
      if (screen.seed) await seedVerifyState(context, page, { email: EMAIL, flow: "login" });
      await open(page, screen.path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("nextjs-portal")
        .analyze();
      expect(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) })),
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/screenshots/entry-${screen.name}-${info.project.name}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("R1-1 Where Verify goes (stubbed good code, fake session)", () => {
  // The fake session is rejected by the server, so the destination page sends the visitor to Log in
  // with that destination as `next`. That redirect target is what these tests read.
  async function verifyAndRead(
    page: Page,
    context: import("@playwright/test").BrowserContext,
    seed: { flow: "signup" | "login"; next?: string; firstName?: string },
    firstConfirmation: boolean,
  ): Promise<string | null> {
    await stubAuth(page, { verify: [verifyOk({ firstConfirmation })] });
    await seedVerifyState(context, page, { email: EMAIL, ...seed });
    await open(page, "/verify");
    await page.getByLabel("6-digit code").fill("123456");
    await page.waitForURL((url) => url.pathname === "/login" && url.searchParams.has("next"), { timeout: 30_000 });
    return new URL(page.url()).searchParams.get("next");
  }

  test("an abandoned sign-up logging in (first confirmation) reaches Profile setup", async ({ page, context }) => {
    expect(await verifyAndRead(page, context, { flow: "login" }, true)).toBe("/welcome");
  });

  test("a first confirmation keeps the deep link for after Profile setup", async ({ page, context }) => {
    expect(await verifyAndRead(page, context, { flow: "login", next: "/exchanges/1" }, true)).toBe(
      "/welcome?next=%2Fexchanges%2F1",
    );
  });

  test("a returning person goes Home", async ({ page, context }) => {
    expect(await verifyAndRead(page, context, { flow: "login" }, false)).toBe("/home");
  });

  test("a returning person with a deep link goes there", async ({ page, context }) => {
    // The route is not built yet and is not gated, so the browser simply lands on it.
    await stubAuth(page, { verify: [verifyOk({ firstConfirmation: false })] });
    await seedVerifyState(context, page, { email: EMAIL, flow: "login", next: "/exchanges/1" });
    await open(page, "/verify");
    await page.getByLabel("6-digit code").fill("123456");
    await page.waitForURL((url) => url.pathname === "/exchanges/1", { timeout: 30_000 });
  });

  test("a sign-up reaches Profile setup", async ({ page, context }) => {
    expect(await verifyAndRead(page, context, { flow: "signup", firstName: "Amaka" }, true)).toBe("/welcome");
  });
});

test.describe("R1-8 Stale verify state is removed", () => {
  const STALE = { v: 1, email: EMAIL, flow: "login", sentAt: Date.now() - 31 * 60_000 };
  for (const [label, value] of [
    ["too old", JSON.stringify(STALE)],
    ["not JSON", "{broken"],
    ["wrong shape", JSON.stringify({ v: 1, email: "nope", flow: "x", sentAt: 1 })],
  ] as const) {
    test(`a ${label} localStorage entry is deleted and Verify goes back to Sign up`, async ({ page }) => {
      await page.addInitScript((v) => window.localStorage.setItem("uw_verify", v), value);
      await page.goto("/verify");
      await expect(page).toHaveURL(/\/signup$/);
      expect(await page.evaluate(() => window.localStorage.getItem("uw_verify"))).toBeNull();
    });
  }
});

test.describe("R1-9 Deep links survive", () => {
  test("a signed-out visit to Profile setup with a next keeps it through Log in", async ({ page }) => {
    await page.goto("/welcome?next=%2Fexchanges%2F1");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/welcome?next=%2Fexchanges%2F1");
  });
});

test.describe("T1-3 Landing content scrolls clear of the pinned bar", () => {
  test("the last step ends above the pinned Get started at 390", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile-390", "the pinned bar is a below-768 layout");
    await open(page, "/");
    await page.getByText("Nobody sees who got whom.").last().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = await page.getByText("On the day, everyone finds out who they are buying for.").boundingBox();
    const bar = await page.getByRole("link", { name: "Get started" }).boundingBox();
    expect(last).not.toBeNull();
    expect(bar).not.toBeNull();
    expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
  });
});
