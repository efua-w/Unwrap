import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, exchangesDbStatus, signInThroughVerify } from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { ZONE, addMember, attachWishlist, people, seedExchange, JOIN_AT, type Person } from "./fixtures/exchange-seed";
import { VIEWPORTS } from "./viewports";
import { formatDay } from "../../lib/dates/format";

// Slice 8, signed in (GCO-006 readiness, GCO-008 Nudge): the readiness block and header on the exchange page, the Nudge
// sheet in its default, sent, recent and offline states, Undo, Participants' Nudge links, and the members' and
// outsiders' views. NEEDS the readiness_and_nudges migration applied to the project the app points at: until then
// every test here is skipped by the probe below (it cannot pass before). Runs in the single-worker "signed-in"
// project, all three widths in turn; the browser runs in Africa/Lagos so day labels are predictable.

const NOT_AVAILABLE = "This exchange isn't available to you";
const OFFLINE = "You're offline. Pages you've opened stay on screen.";
const toast = (page: Page) => page.locator("[popover]");
const seed = people();
const DRAW_DAY = formatDay(new Date(JOIN_AT), ZONE);

async function signedIn(browser: Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport, timezoneId: ZONE });
  const page = await context.newPage();
  await signInThroughVerify(context, page, person.email, { next });
  return { context, page };
}

async function shot(page: Page, name: string, width: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}-${width}.png`, fullPage: true });
}

// Ngozi organises and takes part with a list; Ife has a list; Emeka and Tolu have none. So "2 of 4 wishlists are in" and two are missing (plural sentence and button).
async function readinessExchange(name: string, manual: boolean) {
  const ngozi = await seed.newPerson("Ngozi");
  const ife = await seed.newPerson("Ife");
  const emeka = await seed.newPerson("Emeka");
  const tolu = await seed.newPerson("Tolu");
  const exchange = await seedExchange(ngozi, name, { manual });
  await attachWishlist(exchange.id, ngozi);
  for (const person of [ife, emeka, tolu]) await addMember(exchange.id, person);
  await attachWishlist(exchange.id, ife);
  return { ngozi, ife, emeka, tolu, exchange };
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Readiness and Nudge (needs the readiness_and_nudges migration)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        // WHY the error code: service_role has no execute on get_readiness (42501), so a refusal means the function
        // exists; PGRST202 means it does not, i.e. the migration is not applied.
        const probe = await adminClient().rpc("get_readiness", { p_exchange: "00000000-0000-4000-8000-000000000000" });
        test.skip(probe.error?.code === "PGRST202", "The readiness_and_nudges migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("organiser: the header and the readiness block name who is missing", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, exchange } = await readinessExchange("Readiness swap", false);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await expect(page.getByText(`2 of 4 wishlists are in. Names are drawn ${DRAW_DAY}.`)).toBeVisible();
          const block = page.getByRole("region", { name: "2 of 4 wishlists are in" });
          await expect(block.getByText(`Needs you by ${DRAW_DAY}`)).toBeVisible();
          await expect(block.getByText("Emeka and Tolu haven't added theirs.")).toBeVisible();
          await expect(block.getByRole("button", { name: "Nudge 2 people…" })).toBeVisible();
          // The board draws no faces and no dashed avatars in this block.
          await expectNoAxeViolations(page);
          await shot(page, "readiness-block", width);
        } finally {
          await host.context.close();
        }
      });

      test("organiser who draws names themselves: the header and block say so", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, exchange } = await readinessExchange("Manual readiness", true);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await expect(page.getByText("2 of 4 wishlists are in. You draw names when you're ready.")).toBeVisible();
          await expect(page.getByText("Needs you before names are drawn")).toBeVisible();
        } finally {
          await host.context.close();
        }
      });

      test("Nudge: preview, send, the toast with Undo, then everyone reads as nudged recently", async ({ browser }) => {
        test.setTimeout(180_000);
        const { ngozi, exchange } = await readinessExchange("Nudge swap", false);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await page.waitForLoadState("networkidle");
          await page.getByRole("button", { name: "Nudge 2 people…" }).click();
          const sheet = page.getByRole("dialog", { name: "Nudge 2 people?" });
          await expect(sheet.getByText("Emeka and Tolu")).toBeVisible();
          await expect(sheet.getByText("They'll get this by email:")).toBeVisible();
          await expect(sheet.getByText(`“Ngozi is waiting on your wishlist for Nudge swap. Names are drawn ${DRAW_DAY}.”`)).toBeVisible();
          await expect(sheet.getByText("Anyone nudged in the last 12 hours is skipped.")).toBeVisible();
          // No address in the preview (the organiser reads addresses on Participants only).
          await expect(sheet.getByText("@")).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "nudge-default", width);
          await sheet.getByRole("button", { name: "Send nudge" }).click();
          await expect(sheet).toBeHidden();
          await expect(toast(page)).toContainText("Nudge sent to Emeka and Tolu.");
          await expect(toast(page).getByRole("button", { name: "Undo" })).toBeVisible();
          await shot(page, "nudge-sent", width);

          // Board Org-Nudge-recent: everyone was nudged, so Send is off.
          await page.reload();
          await page.getByRole("button", { name: "Nudge 2 people…" }).click();
          const recent = page.getByRole("dialog", { name: "Everyone was nudged recently" });
          await expect(recent.getByText("Everyone here was nudged in the last 12 hours. Give them a little time.")).toBeVisible();
          await expect(recent.getByRole("button", { name: "Send nudge" })).toBeDisabled();
          await expectNoAxeViolations(page);
          await shot(page, "nudge-recent", width);
          await recent.getByRole("button", { name: "Close" }).click();
          await expect(recent).toBeHidden();
        } finally {
          await host.context.close();
        }
      });

      test("Undo within the window stops the nudge, and the people can be nudged again", async ({ browser }) => {
        test.setTimeout(180_000);
        const { ngozi, exchange } = await readinessExchange("Undo swap", false);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await page.waitForLoadState("networkidle");
          await page.getByRole("button", { name: "Nudge 2 people…" }).click();
          await page.getByRole("dialog", { name: "Nudge 2 people?" }).getByRole("button", { name: "Send nudge" }).click();
          await toast(page).getByRole("button", { name: "Undo" }).click();
          await expect(toast(page)).toContainText("Nudge undone.");
          await page.reload();
          await page.getByRole("button", { name: "Nudge 2 people…" }).click();
          await expect(page.getByRole("dialog", { name: "Nudge 2 people?" })).toBeVisible();
        } finally {
          await host.context.close();
        }
      });

      test("Participants: Nudge all and a row's Nudge open the same sheet; one person reads by first name", async ({ browser }) => {
        test.setTimeout(180_000);
        const { ngozi, exchange } = await readinessExchange("People nudge", false);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}/participants`);
        try {
          const page = host.page;
          await page.waitForLoadState("networkidle");
          await expect(page.getByRole("heading", { name: "Still need a wishlist (2)" })).toBeVisible();
          await page.getByRole("button", { name: "Nudge all 2…" }).click();
          await expect(page.getByRole("dialog", { name: "Nudge 2 people?" })).toBeVisible();
          await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
          await expect(page.getByRole("dialog")).toBeHidden();

          await page.getByRole("button", { name: "Nudge Emeka" }).click();
          const one = page.getByRole("dialog", { name: "Nudge Emeka?" });
          await expect(one.getByText(`“Ngozi is waiting on your wishlist for People nudge. Names are drawn ${DRAW_DAY}.”`)).toBeVisible();
          await shot(page, "participants-nudge", width);
          await one.getByRole("button", { name: "Send nudge" }).click();
          await expect(toast(page)).toContainText("Nudge sent to Emeka.");
          // Emeka is now nudged recently; Tolu is not.
          await page.reload();
          await page.getByRole("button", { name: "Nudge Emeka" }).click();
          await expect(page.getByRole("dialog", { name: "Everyone was nudged recently" })).toBeVisible();
        } finally {
          await host.context.close();
        }
      });

      test("offline: Send nudge is off and the sheet says so", async ({ browser }) => {
        test.setTimeout(180_000);
        const { ngozi, exchange } = await readinessExchange("Offline nudge", false);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await page.waitForLoadState("networkidle");
          await page.getByRole("button", { name: "Nudge 2 people…" }).click();
          const sheet = page.getByRole("dialog", { name: "Nudge 2 people?" });
          await expect(sheet.getByRole("button", { name: "Send nudge" })).toBeEnabled();
          await host.context.setOffline(true);
          await expect(page.getByText(OFFLINE)).toBeVisible();
          await expect(sheet.getByRole("button", { name: "Send nudge" })).toBeDisabled();
          await expect(sheet.getByText("You're offline. You can send this once you're back online. They'll get this by email:")).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "nudge-offline", width);
          await host.context.setOffline(false);
          await expect(sheet.getByRole("button", { name: "Send nudge" })).toBeEnabled();
        } finally {
          await host.context.close();
        }
      });

      test("everyone ready: no readiness block, and a member or an outsider never sees one", async ({ browser }) => {
        test.setTimeout(180_000);
        const { ngozi, emeka, tolu, exchange } = await readinessExchange("Ready swap", false);
        await attachWishlist(exchange.id, emeka);
        await attachWishlist(exchange.id, tolu);
        const outsider = await seed.newPerson("Gbemi");

        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        const member = await signedIn(browser, viewport, emeka, `/exchanges/${exchange.id}`);
        const stranger = await signedIn(browser, viewport, outsider, `/exchanges/${exchange.id}`);
        try {
          await host.page.waitForLoadState("networkidle");
          await expect(host.page.getByRole("heading", { level: 1, name: "Ready swap" })).toBeVisible();
          await expect(host.page.getByRole("button", { name: /^Nudge/ })).toHaveCount(0);
          // WHY only the block: the header line "4 of 4 wishlists are in. ..." stays when everyone is ready (board header pattern).
          await expect(host.page.getByText(`4 of 4 wishlists are in. Names are drawn ${DRAW_DAY}.`)).toBeVisible();
          await expect(host.page.getByRole("region", { name: /wishlists are in/ })).toHaveCount(0);

          // WHY the members' page: readiness is the organiser's, so it carries no count and no one's list status (GCO-006).
          await expect(member.page.getByRole("heading", { level: 1, name: "Ready swap" })).toBeVisible();
          await expect(member.page.getByText(/wishlists are in|Nudge/)).toHaveCount(0);

          await expect(stranger.page.getByText(NOT_AVAILABLE)).toBeVisible();
          await expect(stranger.page.getByText(/wishlists are in|Nudge/)).toHaveCount(0);
        } finally {
          await host.context.close();
          await member.context.close();
          await stranger.context.close();
        }
      });
    });
  });
}
