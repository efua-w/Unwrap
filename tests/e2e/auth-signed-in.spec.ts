import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  dbStatus,
  deleteTestUser,
  mintCode,
  seedVerifyState,
  signInThroughVerify,
  uniqueEmail,
} from "./fixtures/auth";
import { VIEWPORTS } from "./viewports";

// Slice 1, signed in. These need a Supabase project with the profiles_user_settings migration
// applied and SUPABASE_SECRET_KEY in .env.local (or the CI secret). Without them every test here
// skips with the reason; nothing is faked. Throwaway users use @resend.dev addresses and are
// deleted afterwards (the profile first: profiles.id has no cascade).
//
// WHY its own project, one worker, all three widths in turn (T2-1, T2-2): see playwright.config.ts.
// No two of these real sign-ins run at the same time, so none waits on another for the dev server.

const created: string[] = [];

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport });

    test.describe("Signed in (needs the database)", () => {
      test.beforeAll(async () => {
        const status = await dbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
      });

      test.afterEach(async () => {
        for (const email of created.splice(0)) await deleteTestUser(email);
      });

      async function newUser(firstName: string, confirmed = true): Promise<string> {
        const email = uniqueEmail("in");
        await createTestUser(email, firstName, confirmed);
        created.push(email);
        return email;
      }

      async function profileOf(email: string): Promise<{ display_name: string; timezone: string }> {
        const db = adminClient();
        const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
        const id = users?.users.find((u) => u.email === email)?.id;
        if (!id) throw new Error("user not found");
        const { data: profile } = await db.from("profiles").select("display_name").eq("id", id).single();
        const { data: settings } = await db.from("user_settings").select("timezone").eq("user_id", id).single();
        return { display_name: String(profile?.display_name), timezone: String(settings?.timezone) };
      }

      test("a returning person verifies and lands on Home (first time), and the time zone is recorded on every sign-in", async ({
        browser,
        baseURL,
      }) => {
        const email = await newUser("Amaka");
        for (const timezoneId of ["Europe/London", "Asia/Tokyo"]) {
          const context = await browser.newContext({ baseURL, timezoneId });
          const page = await context.newPage();
          await signInThroughVerify(context, page, email);
          await expect(page).toHaveURL(/\/home$/);
          await expect(page.getByRole("heading", { level: 1, name: "Welcome, Amaka." })).toBeVisible();
          await expect(page.getByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} [A-Z][a-z]+$/)).toBeVisible();
          await expect(page.getByRole("heading", { level: 2, name: "How Unwrap works" })).toBeVisible();
          await expect(page.getByRole("link", { name: "Start an exchange", exact: true }).first()).toBeVisible();
          await expect(page.getByRole("link", { name: "Make a wishlist" })).toBeVisible();
          await expect(page.getByText("Got an invite? Open the link you were sent and you'll land in that exchange.")).toBeVisible();
          await expect(page.getByRole("navigation", { name: "Main" }).filter({ visible: true })).toHaveCount(1);
          await expect.poll(async () => (await profileOf(email)).timezone).toBe(timezoneId);
          await context.close();
        }
      });

      test("a new account goes to Profile setup with the sign-up name filled in, and Continue saves it", async ({ page, context }) => {
        const email = await newUser("Amaka");
        await signInThroughVerify(context, page, email, { flow: "signup", firstName: "Amaka" });
        await expect(page).toHaveURL(/\/welcome$/);
        await expect(page.getByRole("heading", { level: 1, name: "How should people see you?" })).toBeVisible();
        await expect(page.getByText("This is how you show up in every exchange you join.")).toBeVisible();
        await expect(page.getByText("You can change this later in Profile.")).toBeVisible();
        const name = page.getByLabel("Display name");
        await expect(name).toHaveValue("Amaka");
        // WHY: photo upload is out of scope in slice 1; initials only.
        await expect(page.getByRole("button", { name: "Add a photo" })).toHaveCount(0);

        await name.fill("   ");
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page.getByText("Add a name so your group knows it's you.")).toBeVisible();
        await expect(name).toBeFocused();

        await name.fill("Amaka O");
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/\/home$/);
        await expect(page.getByRole("heading", { level: 1, name: "Welcome, Amaka O." })).toBeVisible();
        expect((await profileOf(email)).display_name).toBe("Amaka O");
      });

      test("R1-1: an abandoned sign-up (unconfirmed account) that logs in reaches Profile setup, not Home", async ({ page, context }) => {
        const email = await newUser("Amaka", false);
        await signInThroughVerify(context, page, email, { flow: "login" });
        await expect(page).toHaveURL(/\/welcome$/);
        await expect(page.getByLabel("Display name")).toHaveValue("Amaka");
      });

      // Open item 36: the server-side account check runs for real against the project; only the
      // browser's code request is answered locally, so no email is sent.
      async function signUpThroughForm(page: import("@playwright/test").Page, email: string) {
        const otp: Array<{ create_user?: boolean }> = [];
        await page.route("**/auth/v1/otp**", async (route) => {
          otp.push(route.request().postDataJSON() as { create_user?: boolean });
          await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        });
        await page.goto("/signup");
        await page.waitForLoadState("networkidle");
        await page.getByLabel("First name").fill("Amaka");
        await page.getByLabel("Email").fill(email);
        await page.getByRole("button", { name: "Continue" }).click();
        return otp;
      }

      test("item 36: Sign up with an unconfirmed (abandoned) account continues as a sign-up and reaches Profile setup", async ({ page }) => {
        const email = await newUser("Amaka", false);
        const otp = await signUpThroughForm(page, email);
        await expect(page).toHaveURL(/\/verify$/);
        await expect(page.getByText("There's already an account with this email.")).toHaveCount(0);
        expect(otp.map((c) => c.create_user)).toEqual([true]);
        await page.waitForLoadState("networkidle");
        await page.getByLabel("6-digit code").fill(await mintCode(email));
        await expect(page).toHaveURL(/\/welcome$/, { timeout: 30_000 });
        await expect(page.getByLabel("Display name")).toHaveValue("Amaka");
      });

      test("item 36: Sign up with a confirmed account still shows Account exists (R1-4)", async ({ page }) => {
        const email = await newUser("Amaka");
        const otp = await signUpThroughForm(page, email);
        await expect(page.getByText("There's already an account with this email.")).toBeVisible();
        expect(otp.map((c) => c.create_user)).toEqual([false]);
      });

      test("a very long emoji name is cut to 50 characters without splitting an emoji", async ({ page, context }) => {
        const email = await newUser("Amaka");
        await signInThroughVerify(context, page, email, { flow: "signup", firstName: "Amaka" });
        await page.getByLabel("Display name").fill("\u{1F600}".repeat(80));
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/\/home$/);
        const saved = (await profileOf(email)).display_name;
        expect(Array.from(saved)).toHaveLength(50);
        expect(saved).toBe("\u{1F600}".repeat(50));
      });

      test("Profile shows the name and Log out ends only this device's session and lands on Landing", async ({
        browser,
        baseURL,
      }) => {
        const email = await newUser("Amaka");
        const contextA = await browser.newContext({ baseURL });
        const contextB = await browser.newContext({ baseURL });
        try {
          const a = await contextA.newPage();
          const b = await contextB.newPage();
          // WHY one after the other: each sign-in mints a fresh code, which replaces the previous one.
          await signInThroughVerify(contextA, a, email);
          await signInThroughVerify(contextB, b, email);

          // R1-8: a verify state left in storage must not outlive the session.
          await a.evaluate(() => window.localStorage.setItem("uw_verify", "{}"));
          await a.goto("/profile");
          await expect(a.getByRole("heading", { level: 1, name: "Amaka" })).toBeVisible();
          await a.waitForLoadState("networkidle");
          await a.getByRole("button", { name: "Log out" }).click();
          await expect(a).toHaveURL(/\/$/);
          expect(await a.evaluate(() => window.localStorage.getItem("uw_verify"))).toBeNull();
          await expect(a.getByRole("heading", { level: 1, name: "Secret Santa, without the spreadsheet." })).toBeVisible();
          expect((await contextA.cookies()).filter((c) => c.name.startsWith("sb-") && c.value !== "")).toHaveLength(0);
          await a.goto("/home");
          await expect(a).toHaveURL(/\/login\?next=%2Fhome$/);

          // The other device is still signed in (scope "local").
          await b.goto("/home");
          await expect(b).toHaveURL(/\/home$/);
        } finally {
          // WHY finally: a context this test opened must close even when a step fails, or it outlives the test.
          await contextA.close();
          await contextB.close();
        }
      });

      test("signed in, Sign up, Log in and Verify go straight to Home", async ({ page, context }) => {
        const email = await newUser("Amaka");
        await signInThroughVerify(context, page, email);
        for (const path of ["/signup", "/login", "/verify"]) {
          await page.goto(path);
          await expect(page).toHaveURL(/\/home$/);
        }
        // R1-9: signed in, a deep link on Log in is followed instead of Home.
        await page.goto("/login?next=%2Fprofile");
        await expect(page).toHaveURL(/\/profile$/);
      });

      test("a deep link survives log-in: next is opened after Verify", async ({ page, context }) => {
        const email = await newUser("Amaka");
        await signInThroughVerify(context, page, email, { next: "/profile" });
        await expect(page).toHaveURL(/\/profile$/);
      });

      test("a wrong code is refused by the real service", async ({ page, context }) => {
        const email = await newUser("Amaka");
        await seedVerifyState(context, page, { email, flow: "login" });
        await page.goto("/verify");
        await page.waitForLoadState("networkidle");
        await page.getByLabel("6-digit code").fill("000000");
        await expect(page.getByText("That code didn't work. Check the latest email, or send a new code.")).toBeVisible();
        await expect(page).toHaveURL(/[/]verify$/);
      });

      for (const path of ["/home", "/welcome", "/profile"]) {
        test(`${path} has no axe violations and saves a screenshot`, async ({ page, context }) => {
          const email = await newUser("Amaka");
          await signInThroughVerify(context, page, email, { next: path });
          await page.waitForLoadState("networkidle");
          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .exclude("nextjs-portal")
            .analyze();
          expect(
            results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) })),
          ).toEqual([]);
          await page.screenshot({
            path: `test-results/screenshots/signed-in${path.replace("/", "-")}-${width}.png`,
            fullPage: true,
          });
        });
      }
    });

    // The full sign-up through the UI sends a real email through the project's SMTP provider, so it
    // only runs when asked for (E2E_REAL_SIGNUP=1) and once Resend is set up on the Supabase project.
    test.describe("Sign up through the UI (sends a real email)", () => {
      test.beforeAll(async () => {
        const status = await dbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        test.skip(process.env.E2E_REAL_SIGNUP !== "1", "Set E2E_REAL_SIGNUP=1 once Resend SMTP is configured on the Supabase project.");
      });

      test("a new person signs up, verifies, sets a name and reaches Home", async ({ page }) => {
        const email = uniqueEmail("signup");
        try {
            await page.goto("/signup");
            await page.waitForLoadState("networkidle");
            await page.getByLabel("First name").fill("Amaka");
            await page.getByLabel("Email").fill(email);
            await page.getByRole("button", { name: "Continue" }).click();
            await expect(page).toHaveURL(/\/verify$/);
            const code = await mintCode(email);
            await page.getByLabel("6-digit code").fill(code);
            await expect(page).toHaveURL(/\/welcome$/, { timeout: 30_000 });
            await expect(page.getByLabel("Display name")).toHaveValue("Amaka");
            await page.getByRole("button", { name: "Continue" }).click();
            await expect(page).toHaveURL(/\/home$/);
            await expect(page.getByRole("heading", { level: 1, name: "Welcome, Amaka." })).toBeVisible();
        } finally {
          await deleteTestUser(email);
        }
      });
    });
  });
}
