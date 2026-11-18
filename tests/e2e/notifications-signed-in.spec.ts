import { expect, test, type Page } from "@playwright/test";
import { adminClient, dbStatus, signInThroughVerify } from "./fixtures/auth";
import { ZONE, people } from "./fixtures/exchange-seed";
import { NOTIFICATION_COPY, savedOff, savedOn } from "../../features/account/notifications-copy";
import { ACTIVITY_COPY as activityCopy } from "../../features/activity/copy";
import { VIEWPORTS } from "./viewports";

// Slice 7, signed in (GC-026, S44 Notifications): the way in from Profile and from Activity, the page copy, the
// two toggles (reminders stay hidden until slice 12, owner Q2), saving and persistence, and Back. Invite by email
// is deferred and not covered. Needs the user_settings notification columns (email_outbox migration) applied.

const toast = (page: Page) => page.locator("[popover]");
const seed = people();

async function notificationColumns(userId: string) {
  const { data, error } = await adminClient()
    .from("user_settings")
    .select("notify_names_drawn, notify_someone_joins")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`could not read user_settings: ${error.message}`);
  return { namesDrawn: data.notify_names_drawn, someoneJoins: data.notify_someone_joins };
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Notifications (needs the slice 7 migrations)", () => {
      test.beforeAll(async () => {
        const status = await dbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        const probe = await adminClient().from("user_settings").select("notify_names_drawn, notify_someone_joins").limit(1);
        test.skip(Boolean(probe.error), "The email_outbox migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("reached from Profile and from Activity; Back returns to Profile", async ({ browser }) => {
        test.setTimeout(120_000);
        const person = await seed.newPerson("Amaka");
        const context = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await context.newPage();
          await signInThroughVerify(context, page, person.email, { next: "/profile" });

          await page.getByRole("link", { name: /Notifications/ }).click();
          await expect(page).toHaveURL(/\/profile\/notifications$/);
          await expect(page.getByRole("heading", { level: 1, name: NOTIFICATION_COPY.title })).toBeVisible();

          await page.getByRole("link", { name: "Back", exact: true }).click();
          await expect(page).toHaveURL(/\/profile$/);

          await page.goto("/activity");
          await page.getByRole("link", { name: activityCopy.chooseEmails }).click();
          await expect(page).toHaveURL(/\/profile\/notifications$/);
          await expect(page.getByRole("heading", { level: 1, name: NOTIFICATION_COPY.title })).toBeVisible();
        } finally {
          await context.close();
        }
      });

      test("copy, no reminder toggles, saving a change persists across a reload, and no horizontal scroll", async ({ browser }) => {
        test.setTimeout(120_000);
        const person = await seed.newPerson("Amaka");
        const context = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await context.newPage();
          await signInThroughVerify(context, page, person.email, { next: "/profile/notifications" });
          await expect(page).toHaveURL(/\/profile\/notifications$/);

          await expect(page.getByRole("heading", { level: 1, name: NOTIFICATION_COPY.title })).toBeVisible();
          await expect(page.getByText(NOTIFICATION_COPY.subtitle)).toBeVisible();
          const group = page.getByRole("group", { name: NOTIFICATION_COPY.groupLegend });
          await expect(group).toBeVisible();
          const drawn = group.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.namesDrawn.label) });
          const joins = group.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.someoneJoins.label) });
          await expect(group.getByText(NOTIFICATION_COPY.options.namesDrawn.hint)).toBeVisible();
          await expect(group.getByText(NOTIFICATION_COPY.options.someoneJoins.hint)).toBeVisible();
          await expect(page.getByRole("heading", { name: NOTIFICATION_COPY.alwaysTitle })).toBeVisible();
          await expect(page.getByText(NOTIFICATION_COPY.alwaysBody)).toBeVisible();

          // Owner Q2: the Join-by and Event reminder toggles stay hidden until slice 12; only two boxes exist.
          await expect(page.getByRole("checkbox")).toHaveCount(2);
          await expect(page.getByText(/reminder/i)).toHaveCount(0);

          // Defaults: both emails on.
          await expect(drawn).toBeChecked();
          await expect(joins).toBeChecked();

          await joins.uncheck();
          await expect(toast(page)).toContainText(savedOff("someoneJoins"));
          await expect(joins).not.toBeChecked();
          await expect(drawn).toBeChecked();
          expect(await notificationColumns(person.id)).toEqual({ namesDrawn: true, someoneJoins: false });

          await page.reload();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.someoneJoins.label) })).not.toBeChecked();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.namesDrawn.label) })).toBeChecked();

          // Turning it back on saves too.
          await page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.someoneJoins.label) }).check();
          await expect(toast(page)).toContainText(savedOn("someoneJoins"));
          await expect.poll(async () => (await notificationColumns(person.id)).someoneJoins).toBe(true);

          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow).toBeLessThanOrEqual(0);
          await page.screenshot({ path: `test-results/screenshots/notifications-${width}.png`, fullPage: true });
        } finally {
          await context.close();
        }
      });
    });
  });
}
