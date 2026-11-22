import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, exchangesDbStatus, signInThroughVerify } from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { addMember, people, seedExchange, type Person } from "./fixtures/exchange-seed";
import { VIEWPORTS } from "./viewports";

// Slice 9, signed in (GCO-009 Exclusions): the Organiser tools row and its pair count, the empty page, the Add a pair
// sheet (first person, then second, with addresses), the fair-draw line, the impossible alert and its Remove that pair,
// the "at least 3 people" line, Save pairs, Back throwing the draft away, and the members' and outsiders' views. NEEDS
// the exclusions migration applied to the project the app points at: until then every test here is skipped by the probe
// below. Runs in the single-worker "signed-in" project, all three widths in turn.

const NOT_AVAILABLE = "This exchange isn't available to you";
const FAIR = "A fair draw is still possible with these pairs.";
const TOO_FEW = "Names need at least 3 people to draw.";
const toast = (page: Page) => page.locator("[popover]");
const seed = people();

async function signedIn(browser: Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await signInThroughVerify(context, page, person.email, { next });
  return { context, page };
}

async function shot(page: Page, name: string, width: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}-${width}.png`, fullPage: true });
}

// Walks the two steps of the sheet. WHY the locator changes: step 2's title is "Who shouldn't {first} draw?".
async function addPairInSheet(page: Page, first: Person, second: Person) {
  await page.getByRole("button", { name: "Add a pair" }).click();
  const step1 = page.getByRole("dialog", { name: "Add a pair" });
  await step1.getByRole("radio", { name: new RegExp(`^${first.first}`) }).check();
  await step1.getByRole("button", { name: "Next" }).click();
  const step2 = page.getByRole("dialog", { name: new RegExp(`shouldn.t ${first.first} draw`) });
  await step2.getByRole("radio", { name: new RegExp(`^${second.first}`) }).check();
  await step2.getByRole("button", { name: "Add pair" }).click();
  await expect(step2).toBeHidden();
}

// Ngozi organises and takes part. `others` join her.
async function exchangeWith<const T extends readonly string[]>(name: string, others: T) {
  const ngozi = await seed.newPerson("Ngozi");
  const exchange = await seedExchange(ngozi, name);
  const joined: Person[] = [];
  for (const first of others) {
    const person = await seed.newPerson(first);
    await addMember(exchange.id, person);
    joined.push(person);
  }
  // WHY the cast: the caller names each person it asked for, in order, so the tuple has exactly that many.
  return { ngozi, joined: joined as unknown as { [K in keyof T]: Person }, exchange };
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport });

    test.describe("Exclusions (needs the exclusions migration)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        // WHY the error code: service_role has no execute on get_exclusions (42501), so a refusal means the function
        // exists; PGRST202 means it does not, i.e. the migration is not applied.
        const probe = await adminClient().rpc("get_exclusions", { p_exchange: "00000000-0000-4000-8000-000000000000" });
        test.skip(probe.error?.code === "PGRST202", "The exclusions migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("organiser: add a pair, see the fair-draw line, save, and the row counts it", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, joined, exchange } = await exchangeWith("Pairs swap", ["Ife", "Emeka", "Tolu"]);
        const [ife] = joined;
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          // Organiser tools: the row, with no count while there are no pairs.
          const tools = page.getByRole("region", { name: "Organiser tools" });
          await expect(tools.getByRole("link", { name: "Exclusions" })).toBeVisible();
          await tools.getByRole("link", { name: "Exclusions" }).click();
          await expect(page.getByRole("heading", { level: 1, name: "Exclusions" })).toBeVisible();

          // Empty state.
          await expect(page.getByText("No pairs yet. Everyone can draw anyone except themselves.")).toBeVisible();
          await expect(page.getByRole("button", { name: "Save pairs" })).toBeDisabled();
          await shot(page, "exclusions-empty", width);

          // Add a pair: step one lists addresses (owner Q1a), step two leaves the first person out.
          await page.getByRole("button", { name: "Add a pair" }).click();
          const sheet1 = page.getByRole("dialog", { name: "Add a pair" });
          await expect(sheet1.getByText(ife.email)).toBeVisible();
          await sheet1.getByRole("radio", { name: /^Ngozi/ }).check();
          await sheet1.getByRole("button", { name: "Next" }).click();
          const sheet2 = page.getByRole("dialog", { name: /shouldn.t Ngozi draw/ });
          await expect(sheet2.getByRole("radio", { name: /^Ngozi/ })).toHaveCount(0);
          await expect(sheet2.getByRole("radio", { name: /^Ife/ })).toBeVisible();
          await shot(page, "exclusions-pairsecond", width);
          await sheet2.getByRole("radio", { name: /^Ife/ }).check();
          await sheet2.getByRole("button", { name: "Add pair" }).click();

          await expect(page.getByRole("list", { name: "Pairs" }).getByText("Ngozi and Ife")).toBeVisible();
          await expect(page.getByText(FAIR)).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "exclusions-default", width);

          await page.getByRole("button", { name: "Save pairs" }).click();
          await expect(toast(page)).toContainText("Pairs saved.");
          await expect(page.getByRole("button", { name: "Save pairs" })).toBeDisabled();

          // The saved pair survives a reload, and the exchange page's row counts it.
          await page.reload();
          await expect(page.getByText("Ngozi and Ife")).toBeVisible();
          await page.goto(`/exchanges/${exchange.id}`);
          await expect(page.getByRole("link", { name: /Exclusions/ })).toContainText("1 pair");
        } finally {
          await host.context.close();
        }
      });

      test("organiser: an impossible draw names the last pair, and Remove that pair makes it fair", async ({ browser }) => {
        test.setTimeout(120_000);
        // WHY 4 people and 3 pairs: with 4 people, two bidirectional exclusions on Ngozi still leave a valid matching
        // (Ngozi↔Tolu, Ife↔Emeka). A third pair (Ngozi↔Tolu) leaves Ngozi with no one to give to → infeasible.
        const { ngozi, joined, exchange } = await exchangeWith("Stuck swap", ["Ife", "Emeka", "Tolu"]);
        const [ife, emeka, tolu] = joined;
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}/exclusions`);
        try {
          const page = host.page;
          await addPairInSheet(page, ngozi, ife);
          await expect(page.getByText(FAIR)).toBeVisible();
          await addPairInSheet(page, ngozi, emeka);
          await expect(page.getByText(FAIR)).toBeVisible();
          // Ngozi can no longer give to anyone, so no fair draw exists; the newest pair is the one to relax.
          await addPairInSheet(page, ngozi, tolu);
          const alert = page.getByRole("alert").filter({ hasText: "can't be drawn fairly" });
          await expect(alert).toContainText("Remove Ngozi and Tolu, or invite more people.");
          await expect(alert).toContainText("You can still save, and the draw checks again later.");
          await shot(page, "exclusions-impossible", width);

          await alert.getByRole("button", { name: "Remove that pair" }).click();
          await expect(page.getByRole("list", { name: "Pairs" }).getByText("Ngozi and Tolu")).toHaveCount(0);
          await expect(page.getByText(FAIR)).toBeVisible();
          await expect(page.getByRole("alert").filter({ hasText: "can't be drawn fairly" })).toHaveCount(0);
        } finally {
          await host.context.close();
        }
      });

      test("organiser: saving pairs that block a fair draw is allowed", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, joined, exchange } = await exchangeWith("Blocked swap", ["Ife", "Emeka"]);
        const [ife, emeka] = joined;
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}/exclusions`);
        try {
          const page = host.page;
          await addPairInSheet(page, ngozi, ife);
          await addPairInSheet(page, ngozi, emeka);
          await expect(page.getByRole("alert").filter({ hasText: "can't be drawn fairly" })).toBeVisible();
          await page.getByRole("button", { name: "Save pairs" }).click();
          await expect(toast(page)).toContainText("Pairs saved.");
        } finally {
          await host.context.close();
        }
      });

      test("organiser: under 3 people the page says so, and leaving throws the draft away", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, joined, exchange } = await exchangeWith("Small swap", ["Ife"]);
        const [ife] = joined;
        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}/exclusions`);
        try {
          const page = host.page;
          await expect(page.getByText(TOO_FEW)).toBeVisible();
          await addPairInSheet(page, ngozi, ife);
          await expect(page.getByText(TOO_FEW)).toBeVisible();
          await expect(page.getByText(FAIR)).toHaveCount(0);
          // Everyone is paired with everyone, so there is nobody left to pair.
          await expect(page.getByRole("button", { name: "Add a pair" })).toBeDisabled();
          // The bin's name says which pair it removes.
          await expect(page.getByRole("button", { name: "Remove Ngozi and Ife" })).toBeVisible();

          // Leaving without saving: nothing was written.
          await page.goto(`/exchanges/${exchange.id}`);
          await page.goto(`/exchanges/${exchange.id}/exclusions`);
          await expect(page.getByText("No pairs yet. Everyone can draw anyone except themselves.")).toBeVisible();
        } finally {
          await host.context.close();
        }
      });

      test("a member and an outsider get the not-available page, and the member's exchange page has no Exclusions row", async ({ browser }) => {
        test.setTimeout(120_000);
        const { joined, exchange } = await exchangeWith("Private swap", ["Ife"]);
        const [ife] = joined;
        const outsider = await seed.newPerson("Zara");
        for (const person of [ife, outsider]) {
          const visitor = await signedIn(browser, viewport, person, `/exchanges/${exchange.id}/exclusions`);
          try {
            await expect(visitor.page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
          } finally {
            await visitor.context.close();
          }
        }
        const member = await signedIn(browser, viewport, ife, `/exchanges/${exchange.id}`);
        try {
          await expect(member.page.getByRole("link", { name: /Exclusions/ })).toHaveCount(0);
        } finally {
          await member.context.close();
        }
      });
    });
  });
}
