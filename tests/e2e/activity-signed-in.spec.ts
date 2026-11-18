import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, exchangesDbStatus, signInThroughVerify } from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { ZONE, people, seedExchange, type Person } from "./fixtures/exchange-seed";
import { VIEWPORTS } from "./viewports";

// Slice 6, signed in (GC-006, GC-007, GCO-003): Activity events for a join and an ask, the unread badge in the
// nav, the list grouped by day, Mark all as read, the empty state, Load older, offline, and the secrecy probe.
// Needs the slice 6 migrations applied. Runs in the single-worker "signed-in" project, all three widths in turn.

const OFFLINE = "You're offline. Pages you've opened stay on screen.";
const seed = people();

async function signedIn(browser: Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport, timezoneId: ZONE });
  const page = await context.newPage();
  // WHY an invite `next` is opened after signing in to Home (join-one-screen): signing in FROM an invite is the
  // path that joins or asks automatically; these specs click the one screen's own button.
  const isInvite = next.startsWith("/i/");
  await signInThroughVerify(context, page, person.email, { next: isInvite ? "/home" : next });
  if (isInvite) await page.goto(next);
  return { context, page };
}

async function shot(page: Page, name: string, width: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}-${width}.png`, fullPage: true });
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Activity (needs the slice 6 migrations)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        const probe = await adminClient().rpc("get_unread_activity_count");
        // WHY not an error check alone: the service role has no auth.uid(), so the function may refuse; a missing
        // function is the case that matters.
        test.skip(probe.error?.code === "PGRST202", "The activity_events migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("a join and an ask reach the organiser: badge, grouped list, Mark all as read, empty state for everyone else", async ({ browser }) => {
        test.setTimeout(300_000);
        const organiser = await seed.newPerson("Ngozi");
        const femi = await seed.newPerson("Femi");
        const chidi = await seed.newPerson("Chidi");
        const open = await seedExchange(organiser, "Open swap");
        const approval = await seedExchange(organiser, "Approval swap", { approval: true });

        // Femi joins the open exchange, Chidi asks to join the approval one: the real actions write the events.
        const joiner = await signedIn(browser, viewport, femi, `/i/${open.token}`);
        try {
          await joiner.page.getByRole("button", { name: "Join exchange" }).click();
          await expect(joiner.page).toHaveURL(new RegExp(`/exchanges/${open.id}/list\\?from=join$`), { timeout: 30_000 });
        } finally {
          await joiner.context.close();
        }
        const asker = await signedIn(browser, viewport, chidi, `/i/${approval.token}`);
        try {
          await asker.page.getByRole("button", { name: "Ask to join" }).click();
          await expect(asker.page.getByRole("heading", { level: 1, name: "Waiting for Ngozi" })).toBeVisible();
          // The actors have no event of their own: an empty Activity (AC-24).
          await asker.page.goto("/activity");
          await expect(asker.page.getByRole("heading", { level: 2, name: "You're all caught up." })).toBeVisible();
          await expect(asker.page.getByText("When something happens in your exchanges, it'll show here.")).toBeVisible();
          await expect(asker.page.getByRole("link", { name: /^Activity, \d+ unread$/ })).toHaveCount(0);
          await expectNoAxeViolations(asker.page);
          await shot(asker.page, "activity-empty", width);
        } finally {
          await asker.context.close();
        }

        const host = await signedIn(browser, viewport, organiser, "/exchanges");
        try {
          const { page, context } = host;
          // AC-25: the badge on a page that is not Activity.
          await expect(page.getByRole("link", { name: "Activity, 2 unread" })).toBeVisible();
          await expect(page.getByRole("link", { name: "Activity, 2 unread" })).toHaveAttribute("href", "/activity");
          // WHY goto and not a click: under `next dev` the dev overlay's <nextjs-portal> sits over the bottom tabs
          // and swallows the tap; it does not exist in a production build.
          await page.goto("/activity");
          await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
          await expect(page.getByText("2 unread", { exact: true })).toBeVisible();
          await expect(page.getByRole("heading", { level: 2, name: "Today" })).toBeVisible();
          await expect(page.getByText("Femi joined Open swap.")).toBeVisible();
          await expect(page.getByText("Chidi asked to join Approval swap.")).toBeVisible();
          await expect(page.getByText(/ · Approve or decline$/)).toHaveCount(1);
          await expect(page.getByText("Unread", { exact: true })).toHaveCount(2);
          await expectNoAxeViolations(page);
          await shot(page, "activity-default", width);

          // Q12: opening a row goes to its exchange and marks nothing read.
          await page.getByRole("link", { name: /Chidi asked to join Approval swap/ }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${approval.id}$`));
          await page.goto("/activity");
          await expect(page.getByText("2 unread", { exact: true })).toBeVisible();

          // Secrecy: the page and its data payload carry names only.
          const html = await (await context.request.get("/activity")).text();
          const rsc = await (await context.request.get("/activity", { headers: { RSC: "1" } })).text();
          // WHY a fresh load: earlier navigations may still hold the Verify screen's own email in flight data.
          await page.goto("/activity");
          await page.waitForLoadState("networkidle");
          const dom = await page.content();
          for (const [label, body] of [["html", html], ["rsc", rsc], ["dom", dom]] as const) {
            for (const person of [organiser, femi, chidi]) {
              expect(body, `${label} must not contain ${person.first}'s email`).not.toContain(person.email);
              expect(body, `${label} must not contain ${person.first}'s user id`).not.toContain(person.id);
            }
          }

          // Offline: Mark all as read is disabled.
          await context.setOffline(true);
          await expect(page.getByText(OFFLINE)).toBeVisible();
          await expect(page.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
          await shot(page, "activity-offline", width);
          await context.setOffline(false);
          await expect(page.getByText(OFFLINE)).toBeHidden();

          await page.getByRole("button", { name: "Mark all as read" }).click();
          await expect(page.getByText("No unread activity", { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
          await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
          await expect(page.getByRole("link", { name: /^Activity, \d+ unread$/ })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "activity-allread", width);

          // It sticks across a reload.
          await page.reload();
          await expect(page.getByText("No unread activity", { exact: true })).toBeVisible();
          await expect(page.getByText("Femi joined Open swap.")).toBeVisible();
        } finally {
          await host.context.close();
        }
      });

      test("Load older: thirty rows first, then the rest, grouped by day; offline disables it", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const femi = await seed.newPerson("Femi");
        const exchange = await seedExchange(organiser, "Older swap");
        // 35 events, six hours apart, newest an hour ago: more than one page, over several days.
        const rows = Array.from({ length: 35 }, (_, i) => ({
          user_id: organiser.id,
          exchange_id: exchange.id,
          kind: "member_joined" as const,
          subject_user_id: femi.id,
          created_at: new Date(Date.now() - (i * 6 + 1) * 3_600_000).toISOString(),
        }));
        const inserted = await adminClient().from("activity_events").insert(rows);
        if (inserted.error) throw new Error(`seeding activity failed: ${inserted.error.message}`);

        const host = await signedIn(browser, viewport, organiser, "/activity");
        try {
          const { page, context } = host;
          const items = page.getByText("Femi joined Older swap.");
          await expect(page.getByText("35 unread", { exact: true })).toBeVisible();
          await expect(items).toHaveCount(30);
          await expect(page.getByRole("heading", { level: 2, name: "Yesterday" })).toBeVisible();
          expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(2);
          await expectNoAxeViolations(page);
          await shot(page, "activity-older-before", width);

          await context.setOffline(true);
          await expect(page.getByRole("button", { name: "Load older activity" })).toBeDisabled();
          await context.setOffline(false);
          await expect(page.getByText(OFFLINE)).toBeHidden();

          await page.getByRole("button", { name: "Load older activity" }).click();
          await expect(items).toHaveCount(35);
          await expect(page.getByRole("button", { name: "Load older activity" })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "activity-older", width);
        } finally {
          await host.context.close();
        }
      });
    });
  });
}
