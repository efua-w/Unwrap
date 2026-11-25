import { expect, test, type Page } from "@playwright/test";
import { adminClient, dbStatus, signInThroughVerify } from "./fixtures/auth";
import { ZONE, people } from "./fixtures/exchange-seed";
import { NOTIFICATION_COPY, savedOff, savedOn } from "../../features/account/notifications-copy";
import { ACTIVITY_COPY as activityCopy } from "../../features/activity/copy";
import { VIEWPORTS } from "./viewports";

// Slice 7 and 12, signed in (GC-026, S44 Notifications): the way in from Profile and from Activity, the page copy, the
// four toggles (the two reminders since slice 12), "Reminders also show in Activity.", saving and persistence, and Back. Invite by email
// is deferred and not covered. Needs the user_settings notification columns (email_outbox migration) applied.

const toast = (page: Page) => page.locator("[popover]");
const seed = people();

async function notificationColumns(userId: string) {
  const { data, error } = await adminClient()
    .from("user_settings")
    .select("notify_names_drawn, notify_someone_joins, notify_join_by_reminder, notify_event_reminder")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`could not read user_settings: ${error.message}`);
  return {
    namesDrawn: data.notify_names_drawn,
    someoneJoins: data.notify_someone_joins,
    joinByReminder: data.notify_join_by_reminder,
    eventReminder: data.notify_event_reminder,
  };
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Notifications (needs the slice 7 migrations)", () => {
      test.beforeAll(async () => {
        const status = await dbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        const probe = await adminClient().from("user_settings").select("notify_names_drawn, notify_someone_joins, notify_join_by_reminder, notify_event_reminder").limit(1);
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

      test("copy, four toggles, saving a change persists across a reload, and no horizontal scroll", async ({ browser }) => {
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

          // Slice 12: the two reminders sit with the other two, and "Reminders also show in Activity." sits under "Always sent".
          const joinBy = group.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.joinByReminder.label) });
          const event = group.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.eventReminder.label) });
          await expect(page.getByRole("checkbox")).toHaveCount(4);
          await expect(group.getByText(NOTIFICATION_COPY.options.joinByReminder.hint)).toBeVisible();
          await expect(group.getByText(NOTIFICATION_COPY.options.eventReminder.hint)).toBeVisible();
          await expect(page.getByText(NOTIFICATION_COPY.remindersInActivity)).toBeVisible();
          // Owner B4: "Always sent" also names the could-not-draw email.
          await expect(page.getByText(NOTIFICATION_COPY.alwaysBody)).toContainText("names couldn't be drawn");

          // Defaults: every email on.
          await expect(drawn).toBeChecked();
          await expect(joins).toBeChecked();
          await expect(joinBy).toBeChecked();
          await expect(event).toBeChecked();

          await joins.uncheck();
          await expect(toast(page)).toContainText(savedOff("someoneJoins"));
          await expect(joins).not.toBeChecked();
          await expect(drawn).toBeChecked();
          expect(await notificationColumns(person.id)).toEqual({
            namesDrawn: true, someoneJoins: false, joinByReminder: true, eventReminder: true,
          });

          await page.reload();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.someoneJoins.label) })).not.toBeChecked();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.namesDrawn.label) })).toBeChecked();

          // Turning it back on saves too.
          await page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.someoneJoins.label) }).check();
          await expect(toast(page)).toContainText(savedOn("someoneJoins"));
          await expect.poll(async () => (await notificationColumns(person.id)).someoneJoins).toBe(true);

          // The two reminders save, persist across a reload, and write only their own column.
          await joinBy.uncheck();
          await expect(toast(page)).toContainText(savedOff("joinByReminder"));
          await expect.poll(async () => await notificationColumns(person.id)).toEqual({
            namesDrawn: true, someoneJoins: true, joinByReminder: false, eventReminder: true,
          });
          await event.uncheck();
          await expect(toast(page)).toContainText(savedOff("eventReminder"));
          await page.reload();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.joinByReminder.label) })).not.toBeChecked();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.eventReminder.label) })).not.toBeChecked();
          await expect(page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.namesDrawn.label) })).toBeChecked();
          await page.getByRole("checkbox", { name: new RegExp(NOTIFICATION_COPY.options.eventReminder.label) }).check();
          await expect(toast(page)).toContainText(savedOn("eventReminder"));
          await expect.poll(async () => await notificationColumns(person.id)).toEqual({
            namesDrawn: true, someoneJoins: true, joinByReminder: false, eventReminder: true,
          });

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
