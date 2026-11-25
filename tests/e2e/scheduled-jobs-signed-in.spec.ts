import { expect, test, type Page } from "@playwright/test";
import { adminClient, dbStatus, signInThroughVerify } from "./fixtures/auth";
import { addMember, seedExchange, ymdIn, ZONE, people, type Person, type Seeded } from "./fixtures/exchange-seed";
import { expectNoAxeViolations } from "./fixtures/axe";
import { DRAW_COPY } from "../../features/draw/copy";
import { HOW_COPY } from "../../features/exchange-list/joined";
import { VIEWPORTS } from "./viewports";

// Slice 12 (GCO-011, GC-011, GC-010, items 77 and 88): what can be checked WITHOUT a real draw, tick() or the cron job.
// - The "How we'll tell you" lines and the skipped-list sentence follow the viewer's own reminder toggles.
// - The organiser's blocked card and what a member sees while the draw moment has passed. WHY a service-role write is allowed
//   here: the spec only needs an exchange in the state the tick job would leave, and it never runs the job or a draw. It sets
//   draw_blocked_reason on a throwaway exchange that cleanup() deletes.
// NOT covered, because it needs a real run: that tick() writes the reason and queues E15, the reminders, the completion, and
// the emails themselves (unit tests cover the rendering).

const seed = people();

async function setReminders(userId: string, values: { notify_join_by_reminder?: boolean; notify_event_reminder?: boolean; notify_names_drawn?: boolean }) {
  const { error } = await adminClient().from("user_settings").update(values).eq("user_id", userId);
  if (error) throw new Error(`could not update user_settings: ${error.message}`);
}

// The state the tick job leaves after one failed attempt: the automatic draw's moment is behind us and the reason is set.
async function block(exchange: Seeded, reason: "few" | "exclusions") {
  // WHY one update: an automatic draw's draw_at must equal join_by_at (check exchanges_auto_draw_at_join_by), so closeJoining,
  // which moves join_by_at alone, would be refused.
  const joinBy = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { error } = await adminClient()
    .from("exchanges")
    .update({ join_by_at: joinBy, draw_at: joinBy, gift_day: ymdIn(5), draw_blocked_reason: reason })
    .eq("id", exchange.id);
  if (error) throw new Error(`could not mark the exchange blocked: ${error.message}`);
}

async function signedIn(browser: import("@playwright/test").Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport, timezoneId: ZONE });
  const page = await context.newPage();
  await signInThroughVerify(context, page, person.email, { next });
  return { context, page };
}

const text = (page: Page) => page.locator("main").innerText();

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.beforeAll(async () => {
      const status = await dbStatus();
      test.skip(!status.ready, status.ready ? "" : status.reason);
      const probe = await adminClient().from("exchanges").select("id").limit(1);
      test.skip(Boolean(probe.error), "The exchanges table is not readable.");
      const reminders = await adminClient().from("user_settings").select("notify_join_by_reminder, notify_event_reminder").limit(1);
      test.skip(Boolean(reminders.error), "The reminder settings columns are not available.");
    });

    test.afterEach(async () => {
      await seed.cleanup();
    });

    test("You're in: the reminder promises follow the person's own toggles (items 77, 88)", async ({ browser }) => {
      test.setTimeout(120_000);
      const organiser = await seed.newPerson("Ngozi");
      const joiner = await seed.newPerson("Amaka");
      const exchange = await seedExchange(organiser, "Choir swap");
      await addMember(exchange.id, joiner);
      const { context, page } = await signedIn(browser, viewport, joiner, `/exchanges/${exchange.id}/joined`);
      try {
        const main = page.locator("main");
        // Defaults: every email on, and no list yet.
        await expect(main.getByRole("heading", { name: HOW_COPY.title })).toBeVisible();
        await expect(main.getByText(HOW_COPY.namesDrawn)).toBeVisible();
        await expect(main.getByText(HOW_COPY.joinBy)).toBeVisible();
        await expect(main.getByText(HOW_COPY.event)).toBeVisible();
        await expect(main.getByText(/Add one before .+\. We'll email you the day before\./)).toBeVisible();
        await expect(main.getByRole("link", { name: HOW_COPY.chooseEmails })).toHaveAttribute("href", "/profile/notifications");
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/youre-in-skipped-${width}.png`, fullPage: true });

        // Join-by reminder off: its line and the email sentence go, the others stay.
        await setReminders(joiner.id, { notify_join_by_reminder: false });
        await page.reload();
        await expect(main.getByText(HOW_COPY.joinBy)).toHaveCount(0);
        await expect(main.getByText(/We'll email you the day before/)).toHaveCount(0);
        await expect(main.getByText(/Add one before .+\./)).toBeVisible();
        await expect(main.getByText(HOW_COPY.event)).toBeVisible();

        // Event reminder off too, names drawn still on.
        await setReminders(joiner.id, { notify_event_reminder: false });
        await page.reload();
        await expect(main.getByText(HOW_COPY.event)).toHaveCount(0);
        await expect(main.getByText(HOW_COPY.namesDrawn)).toBeVisible();

        // Everything off: the board's one line and no reminder promise.
        await setReminders(joiner.id, { notify_names_drawn: false });
        await page.reload();
        await expect(main.getByText(HOW_COPY.allOff)).toBeVisible();
        for (const line of [HOW_COPY.namesDrawn, HOW_COPY.joinBy, HOW_COPY.event]) await expect(main.getByText(line)).toHaveCount(0);
        await page.screenshot({ path: `test-results/screenshots/youre-in-noreminders-${width}.png`, fullPage: true });
      } finally {
        await context.close();
      }
    });

    test("blocked draw, too few people: the organiser's card, Draw names now… stays, no date and no retry promise (B1)", async ({ browser }) => {
      test.setTimeout(120_000);
      const organiser = await seed.newPerson("Ngozi");
      const friend = await seed.newPerson("Chika");
      const exchange = await seedExchange(organiser, "Book club swap", { manual: false });
      await addMember(exchange.id, friend);
      await block(exchange, "few");
      const { context, page } = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}`);
      try {
        const main = page.locator("main");
        await expect(main.getByText(DRAW_COPY.blocked.status, { exact: true })).toBeVisible();
        const card = main.getByRole("region", { name: DRAW_COPY.blocked.title });
        await expect(card).toBeVisible();
        await expect(card).toContainText(DRAW_COPY.blocked.meta);
        await expect(card).toContainText("Only 2 people are taking part, and names need at least 3 people. 1 more person is needed.");
        await expect(card.getByRole("link")).toHaveCount(0);
        await expect(main.getByText(/Couldn't run on /)).toBeVisible();
        // B1: Draw names now… stays, and the false sub is gone.
        const tools = main.getByRole("region", { name: "Organiser tools" });
        await expect(tools.getByRole("button", { name: new RegExp(DRAW_COPY.rowTitle) })).toBeVisible();
        await expect(tools.getByText(DRAW_COPY.rowSubFew(1))).toBeVisible();
        const body = await text(page);
        expect(body).not.toMatch(/Or we draw them on|try again|We'll try/i);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/blocked-few-${width}.png`, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      } finally {
        await context.close();
      }
    });

    test("blocked draw, exclusions cause: the same card with Edit exclusions (B2)", async ({ browser }) => {
      test.setTimeout(120_000);
      const organiser = await seed.newPerson("Ngozi");
      const friend = await seed.newPerson("Chika");
      const exchange = await seedExchange(organiser, "Book club swap", { manual: false });
      await addMember(exchange.id, friend);
      await block(exchange, "exclusions");
      const { context, page } = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}`);
      try {
        const card = page.locator("main").getByRole("region", { name: DRAW_COPY.blocked.title });
        await expect(card).toContainText(DRAW_COPY.blocked.exclusionsBody);
        await expect(card.getByRole("link", { name: DRAW_COPY.blocked.editExclusions })).toHaveAttribute(
          "href",
          `/exchanges/${exchange.id}/exclusions`,
        );
        await page.screenshot({ path: `test-results/screenshots/blocked-exclusions-${width}.png`, fullPage: true });
      } finally {
        await context.close();
      }
    });

    test("a member sees nothing about a blocked draw and nothing dated about it (Q5, Q6)", async ({ browser }) => {
      test.setTimeout(120_000);
      const organiser = await seed.newPerson("Ngozi");
      const friend = await seed.newPerson("Chika");
      const exchange = await seedExchange(organiser, "Book club swap", { manual: false });
      await addMember(exchange.id, friend);
      await block(exchange, "exclusions");
      const { context, page } = await signedIn(browser, viewport, friend, `/exchanges/${exchange.id}`);
      try {
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 1, name: "Book club swap" })).toBeVisible();
        const body = await text(page);
        expect(body).not.toMatch(/couldn't be drawn|exclusion|pairs|Needs you now|Edit exclusions/i);
        expect(body).not.toMatch(/Names are drawn on|Names are drawn Fri|You're all set/i);
        await expect(main.getByText("Names drawn", { exact: true })).toHaveCount(0);
        await expect(main.getByText("Join by", { exact: true })).toBeVisible();

        // The Exchanges row says nothing dated either.
        await page.goto("/exchanges");
        const row = page.getByRole("link", { name: /Book club swap/ });
        await expect(row).toBeVisible();
        await expect(row).not.toContainText(/Names are drawn/);
        await page.screenshot({ path: `test-results/screenshots/blocked-member-${width}.png`, fullPage: true });
      } finally {
        await context.close();
      }
    });
  });
}
