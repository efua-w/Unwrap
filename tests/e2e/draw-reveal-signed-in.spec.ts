import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, exchangesDbStatus, signInThroughVerify } from "./fixtures/auth";
import { addMember, addRequest, people, seedExchange, type Person } from "./fixtures/exchange-seed";
import { VIEWPORTS } from "./viewports";

// Slice 10, signed in (GCO-011 Draw names, GCO-012 Names drawn, GC-014 Reveal, GC-013 after the draw, GC-006 request closed
// by the draw, GC-007 Names drawn event). NEEDS the draw_and_reveal migration applied to the project the app points at.
//
// Two groups:
//   "before the draw"  never draws: the Draw names sheet's too-few and confirm states, and the pages that are not available
//                      to everyone. Cleaned up like every other signed-in spec.
//   "the draw"         really draws, and a drawn exchange can never be deleted (assignments are immutable, AC-11), so the
//                      throwaway users and exchanges it creates stay behind. WHY opt-in: run it only against a database
//                      where that does not matter (a local stack, or a project you are happy to leave tidy-up for):
//                      E2E_ALLOW_DRAW=1 npm run e2e. CI does not set it.
// Runs in the single-worker "signed-in" project, all three widths in turn.

const NOT_AVAILABLE = "This exchange isn't available to you";
const seed = people();

async function signedIn(browser: Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await signInThroughVerify(context, page, person.email, { next });
  return { context, page };
}

async function exchangeWith<const T extends readonly string[]>(name: string, others: T, options: { approval?: boolean; takingPart?: boolean } = {}) {
  const ngozi = await seed.newPerson("Ngozi");
  const exchange = await seedExchange(ngozi, name, options);
  const joined: Person[] = [];
  for (const first of others) {
    const person = await seed.newPerson(first);
    await addMember(exchange.id, person);
    joined.push(person);
  }
  // WHY the cast: the caller names each person it asked for, in order, so the tuple has exactly that many.
  return { ngozi, joined: joined as unknown as { [K in keyof T]: Person }, exchange };
}

async function drawFromTheSheet(page: Page, exchangeName: string) {
  await page.getByRole("button", { name: /Draw names now/ }).click();
  const sheet = page.getByRole("dialog", { name: `Draw names for ${exchangeName}?` });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Draw names" }).click();
  await page.waitForURL(/\/exchanges\/[^/]+\/drawn$/);
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport });

    test.describe("Draw and reveal (needs the draw_and_reveal migration)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        // WHY the error code: service_role has no execute on get_my_assignment (42501), so a refusal means the function
        // exists; PGRST202 means it does not, i.e. the migration is not applied.
        const probe = await adminClient().rpc("get_my_assignment", { p_exchange: "00000000-0000-4000-8000-000000000000" });
        test.skip(probe.error?.code === "PGRST202", "The draw_and_reveal migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("before the draw: too few people, then the confirm sheet, and nothing is drawn", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, exchange } = await exchangeWith("Few swap", []);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await expect(page.getByRole("button", { name: /Draw names now/ })).toContainText("Needs 3 people. 2 more to go.");
          await page.getByRole("button", { name: /Draw names now/ }).click();
          const few = page.getByRole("dialog", { name: "Not enough people yet" });
          await expect(few).toContainText("Names need at least 3 people to draw.");
          await few.getByRole("button", { name: "Close" }).click();
          await expect(few).toBeHidden();
        } finally {
          await host.context.close();
        }

        const friends = await exchangeWith("Ready swap", ["Ife", "Emeka"]);
        const ready = await signedIn(browser, viewport, friends.ngozi, `/exchanges/${friends.exchange.id}`);
        try {
          const page = ready.page;
          await page.getByRole("button", { name: /Draw names now/ }).click();
          const sheet = page.getByRole("dialog", { name: "Draw names for Ready swap?" });
          await expect(sheet).toContainText("3 people are taking part");
          await expect(sheet).toContainText("This can't be undone.");
          await expect(sheet).toContainText("You won't see who got whom. Nobody will.");
          await sheet.getByRole("button", { name: "Not yet" }).click();
          await expect(sheet).toBeHidden();
          // Nothing was drawn: the page is still the page before the draw.
          await expect(page.getByRole("button", { name: /Draw names now/ })).toBeVisible();
        } finally {
          await ready.context.close();
        }
      });

      // Mid-slice change 2026-11-23 (owner): the ActionCard banner is as wide as the content area, has a Dismiss at the far right,
      // and a dismissed card stays hidden on this device. The "Add your wishlist" card stands in for the drawn-state card,
      // which needs a real draw (same component, gate and button; only the key differs).
      test("action card: banner width, Dismiss, it stays hidden after a reload, no horizontal overflow", async ({ browser }) => {
        test.setTimeout(120_000);
        const { joined, exchange } = await exchangeWith("Banner swap", ["Ife"]);
        const [ife] = joined;
        const member = await signedIn(browser, viewport, ife, `/exchanges/${exchange.id}`);
        try {
          const page = member.page;
          const card = page.getByRole("complementary", { name: "Needs you" });
          const noOverflow = async () =>
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
          await expect(card).toContainText("Add your wishlist");
          await noOverflow();

          if (viewport.width < 768) {
            // The tray as built: no close control.
            await expect(card).toBeVisible();
            await expect(card.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
            return;
          }

          await expect(card).toBeVisible();
          const box = await card.boundingBox();
          // WHY "Your part": the title sits beside the exchange tag, so its left edge is not the column's.
          const column = await page.getByRole("heading", { name: "Your part" }).boundingBox();
          expect(box).not.toBeNull();
          // The board banner is 1040 wide at 1440 (the content area). Below that it fills the content area.
          if (viewport.width === 1440) expect(Math.abs((box?.width ?? 0) - 1040)).toBeLessThanOrEqual(1);
          else expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
          // Left edge lines up with the page below it.
          expect(Math.abs((box?.x ?? 0) - (column?.x ?? 0))).toBeLessThanOrEqual(1);
          await noOverflow();

          // Dismiss is a real button, the last control in the card, and sits at its far right.
          const dismiss = card.getByRole("button", { name: "Dismiss" });
          const action = card.getByRole("link", { name: "Add your wishlist" });
          await expect(dismiss).toBeVisible();
          const dBox = await dismiss.boundingBox();
          const aBox = await action.boundingBox();
          expect((dBox?.x ?? 0)).toBeGreaterThan((aBox?.x ?? 0) + (aBox?.width ?? 0) - 1);
          expect((box?.x ?? 0) + (box?.width ?? 0) - ((dBox?.x ?? 0) + (dBox?.width ?? 0))).toBeLessThanOrEqual(32);
          await page.screenshot({ path: `test-results/screenshots/action-card-banner-${width}.png`, fullPage: true });

          await dismiss.click();
          await expect(card).toHaveCount(0);
          await page.reload();
          await expect(page.getByRole("heading", { level: 1, name: "Banner swap" })).toBeVisible();
          await expect(card).toHaveCount(0);
          // The tray is the same card: it stays hidden at the narrow width too.
          await page.setViewportSize({ width: 390, height: 844 });
          await expect(card).toHaveCount(0);
          await page.setViewportSize(viewport);
        } finally {
          await member.context.close();
        }
      });

      test("not available: an outsider, and a member on Names drawn, before any draw (S47)", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, joined, exchange } = await exchangeWith("Quiet swap", ["Ife"]);
        const [ife] = joined;
        const stranger = await seed.newPerson("Zainab");
        for (const [person, path] of [
          [stranger, "drawn"],
          [stranger, "reveal"],
          [ife, "drawn"],
          [ife, "reveal"],
          [ngozi, "drawn"],
          [ngozi, "reveal"],
        ] as const) {
          const s = await signedIn(browser, viewport, person, `/exchanges/${exchange.id}/${path}`);
          try {
            await expect(s.page.getByRole("heading", { name: NOT_AVAILABLE })).toBeVisible();
          } finally {
            await s.context.close();
          }
        }
      });
    });

    test.describe("The draw itself (opt-in: leaves drawn exchanges behind)", () => {
      test.beforeAll(async () => {
        test.skip(process.env.E2E_ALLOW_DRAW !== "1", "Drawing leaves undeletable rows. Set E2E_ALLOW_DRAW=1 to run.");
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        const probe = await adminClient().rpc("get_my_assignment", { p_exchange: "00000000-0000-4000-8000-000000000000" });
        test.skip(probe.error?.code === "PGRST202", "The draw_and_reveal migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("organiser who takes part: draw, Names drawn, Reveal, Hide again, and no name in the page's HTML", async ({ browser }) => {
        test.setTimeout(180_000);
        const { ngozi, exchange } = await exchangeWith("Draw swap", ["Ife", "Emeka", "Tolu"]);
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await drawFromTheSheet(page, "Draw swap");
          await expect(page.getByRole("heading", { name: "Names are drawn" })).toBeVisible();
          await expect(page.getByText("4 of 4 people, by email")).toBeVisible();
          await expect(page.getByText("Nobody can see who got whom, not even you.")).toBeVisible();

          await page.getByRole("link", { name: "Reveal who you got" }).click();
          await page.waitForURL(/\/reveal$/);
          await expect(page.getByRole("heading", { name: "Make sure no one's looking" })).toBeVisible();
          // AC-12: the server-rendered page never contains the person's name (the three names are the only candidates).
          const html = await (await host.context.request.get(page.url())).text();
          for (const first of ["Ife", "Emeka", "Tolu"]) expect(html).not.toContain(first);

          await page.getByRole("button", { name: "Reveal who you got" }).click();
          await expect(page.getByText("You're buying for")).toBeVisible();
          await expect(page.getByRole("heading", { level: 1 })).toContainText(/Ife|Emeka|Tolu/);
          await expect(page.getByRole("button", { name: "Hide again" })).toBeVisible();
          // Slice 11 (GC-015): the revealed page links to the person's wishlist.
          await expect(page.getByRole("link", { name: "View their wishlist" })).toHaveAttribute("href", `/exchanges/${exchange.id}/recipient`);

          await page.getByRole("button", { name: "Hide again" }).click();
          await expect(page.getByRole("heading", { name: "Make sure no one's looking" })).toBeVisible();
          await page.reload();
          await expect(page.getByRole("heading", { name: "Make sure no one's looking" })).toBeVisible();

          // The exchange page says so on this device.
          await page.goto(`/exchanges/${exchange.id}`);
          await expect(page.getByText("Hidden on this device")).toBeVisible();
          await expect(page.getByText("Names are drawn for Draw swap.")).toHaveCount(0);
        } finally {
          await host.context.close();
        }
      });

      test("participant and request: the card, the row, Activity, and Dismiss on a request the draw closed", async ({ browser }) => {
        test.setTimeout(240_000);
        const { ngozi, joined, exchange } = await exchangeWith("Card swap", ["Ife", "Emeka", "Tolu"], { approval: true, takingPart: false });
        const [ife] = joined;
        const late = await seed.newPerson("Chidi");
        await addRequest(exchange.id, late);

        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          await drawFromTheSheet(host.page, "Card swap");
          await expect(host.page.getByRole("link", { name: "Reveal who you got" })).toHaveCount(0);
          await host.page.getByRole("link", { name: "Back to exchange" }).click();
          await expect(host.page.getByText("Nobody can see who got whom, not even you.")).toBeVisible();
          await expect(host.page.getByRole("button", { name: /Draw names now/ })).toHaveCount(0);
          await expect(host.page.getByRole("link", { name: "Exclusions" })).toBeVisible();
        } finally {
          await host.context.close();
        }

        // An organiser who only organises has no assignment: Reveal is not available.
        const hostAgain = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}/reveal`);
        try {
          await expect(hostAgain.page.getByRole("heading", { name: NOT_AVAILABLE })).toBeVisible();
        } finally {
          await hostAgain.context.close();
        }

        const member = await signedIn(browser, viewport, ife, `/exchanges/${exchange.id}`);
        try {
          const page = member.page;
          await expect(page.getByText("Names are drawn for Card swap.")).toBeVisible();
          await expect(page.getByText("Hidden until you reveal it.")).toBeVisible();
          await page.goto("/activity");
          await expect(page.getByRole("link", { name: /Names are drawn for Card swap\./ })).toHaveAttribute("href", `/exchanges/${exchange.id}/reveal`);
          await page.goto("/exchanges");
          await expect(page.getByText("Names are drawn. Gifts on")).toBeVisible();
          await expect(page.getByRole("link", { name: "Reveal who you got" })).toBeVisible();
        } finally {
          await member.context.close();
        }

        const asker = await signedIn(browser, viewport, late, "/exchanges");
        try {
          const page = asker.page;
          await expect(page.getByText("Names were drawn before Ngozi could let you in.")).toBeVisible();
          await page.getByRole("button", { name: "Dismiss Card swap" }).click();
          await expect(page.getByText("Names were drawn before Ngozi could let you in.")).toBeHidden();
        } finally {
          await asker.context.close();
        }
      });
    });
  });
}
