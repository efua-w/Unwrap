import { expect, test, type Browser } from "@playwright/test";
import { adminClient, exchangesDbStatus, signInThroughVerify } from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { addMember, people, seedExchange, type Person } from "./fixtures/exchange-seed";
import { VIEWPORTS } from "./viewports";

// Slice 11, signed in (GC-015 the recipient's wishlist and got-it marks, GC-010 the list after the draw). NEEDS the
// recipient_list_and_marks migration applied to the project the app points at.
//
// Two groups, like the slice 10 spec:
//   "before the draw"  never draws: the recipient page is not available to anyone, and signed-out visitors go to sign in.
//   "the draw"         really draws (opt-in: E2E_ALLOW_DRAW=1 npm run e2e; a drawn exchange can never be deleted, so it leaves rows
//                      behind). WHY opt-in and out of CI: item 115. NEVER run it against the hosted dev project.
// Runs in the single-worker "signed-in" project, all three widths in turn.

const NOT_AVAILABLE = "This exchange isn't available to you";
const seed = people();

async function signedIn(browser: Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await signInThroughVerify(context, page, person.email, { next });
  return { context, page };
}

async function exchangeWith<const T extends readonly string[]>(name: string, others: T) {
  const ngozi = await seed.newPerson("Ngozi");
  const exchange = await seedExchange(ngozi, name);
  const joined: Person[] = [];
  for (const first of others) {
    const person = await seed.newPerson(first);
    await addMember(exchange.id, person);
    joined.push(person);
  }
  return { ngozi, joined: joined as unknown as { [K in keyof T]: Person }, exchange };
}

// A personal wishlist with two items, attached to the person's membership. WHY direct inserts: the attach flow has its own
// specs, and the names are unique per owner so a giver's page can be told apart.
async function listWithItems(exchangeId: string, person: Person) {
  const db = adminClient();
  const list = await db.from("wishlists").insert({ owner_id: person.id, name: `${person.first}'s wishes` }).select("id").single();
  if (list.error || !list.data) throw new Error(`listWithItems failed: ${list.error?.message}`);
  const items = await db.from("wishlist_items").insert([
    { wishlist_id: list.data.id, name: `${person.first} item A`, priority: "most_wanted", price_kobo: 600_000, note: "Any colour." },
    { wishlist_id: list.data.id, name: `${person.first} item B`, priority: "nice_to_have", price_kobo: 9_000_000, link: "https://shop.example/b" },
  ]);
  if (items.error) throw new Error(`listWithItems items failed: ${items.error.message}`);
  const attached = await db
    .from("exchange_members")
    .update({ attached_wishlist_id: list.data.id })
    .eq("exchange_id", exchangeId)
    .eq("user_id", person.id);
  if (attached.error) throw new Error(`listWithItems attach failed: ${attached.error.message}`);
}

async function ready() {
  const status = await exchangesDbStatus();
  test.skip(!status.ready, status.ready ? "" : status.reason);
  // WHY the error code: service_role has no execute on open_recipient_list (42501), so a refusal means the function exists;
  // PGRST202 means it does not, i.e. the migration is not applied.
  const probe = await adminClient().rpc("open_recipient_list", { p_exchange: "00000000-0000-4000-8000-000000000000" });
  test.skip(probe.error?.code === "PGRST202", "The recipient_list_and_marks migration is not applied to the Supabase project the app points at.");
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport });

    test.describe("Recipient list, before any draw (needs the recipient_list_and_marks migration)", () => {
      test.beforeAll(ready);
      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("not available: an outsider, a member and the organiser, before any draw (S47)", async ({ browser }) => {
        test.setTimeout(120_000);
        const { ngozi, joined, exchange } = await exchangeWith("Quiet list swap", ["Ife"]);
        const [ife] = joined;
        const stranger = await seed.newPerson("Zainab");
        for (const person of [stranger, ife, ngozi]) {
          const s = await signedIn(browser, viewport, person, `/exchanges/${exchange.id}/recipient`);
          try {
            await expect(s.page.getByRole("heading", { name: NOT_AVAILABLE })).toBeVisible();
            // Nothing of the exchange is in the page: no name, no exchange name.
            const html = await s.page.content();
            expect(html).not.toContain("Quiet list swap");
            await expectNoAxeViolations(s.page);
          } finally {
            await s.context.close();
          }
        }
      });

      test("a signed-out visitor is sent to sign in and back", async ({ page }) => {
        await page.goto("/exchanges/00000000-0000-4000-8000-000000000000/recipient");
        await expect(page).toHaveURL(/\/login\?next=%2Fexchanges%2F00000000-0000-4000-8000-000000000000%2Frecipient/);
      });

      test("the list page before the draw is unchanged: attach is still offered, with Skip only from Join", async ({ browser }) => {
        test.setTimeout(120_000);
        const { joined, exchange } = await exchangeWith("Before swap", ["Ife"]);
        const [ife] = joined;
        const s = await signedIn(browser, viewport, ife, `/exchanges/${exchange.id}/list`);
        try {
          await expect(s.page.getByRole("button", { name: "Add items instead" })).toBeVisible();
          await expect(s.page.getByRole("link", { name: "Skip for now" })).toHaveCount(0);
          await expect(s.page.getByText("Wishlist attached. Your giver can see it now.")).toHaveCount(0);
        } finally {
          await s.context.close();
        }
      });
    });

    test.describe("The recipient's list after the draw (opt-in: leaves drawn exchanges behind)", () => {
      test.beforeAll(async () => {
        test.skip(process.env.E2E_ALLOW_DRAW !== "1", "Drawing leaves undeletable rows. Set E2E_ALLOW_DRAW=1 to run.");
        await ready();
      });
      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("giver: no name in the HTML, the list, a mark with Undo, Hide again, and the item sheet", async ({ browser }) => {
        test.setTimeout(240_000);
        const { ngozi, joined, exchange } = await exchangeWith("List swap", ["Ife", "Emeka", "Tolu"]);
        const everyone = [ngozi, ...joined];
        for (const person of everyone) await listWithItems(exchange.id, person);

        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          await host.page.getByRole("button", { name: /Draw names now/ }).click();
          const sheet = host.page.getByRole("dialog", { name: "Draw names for List swap?" });
          await sheet.getByRole("button", { name: "Draw names" }).click();
          await host.page.waitForURL(/\/exchanges\/[^/]+\/drawn$/);
        } finally {
          await host.context.close();
        }

        const [ife] = joined;
        const giver = await signedIn(browser, viewport, ife, `/exchanges/${exchange.id}/reveal`);
        try {
          const page = giver.page;
          await page.getByRole("button", { name: "Reveal who you got" }).click();
          await page.getByRole("link", { name: "View their wishlist" }).click();
          await page.waitForURL(/\/recipient$/);

          // AC-9: the server-rendered page never contains anyone else's name.
          const html = await (await giver.context.request.get(page.url())).text();
          for (const first of ["Ngozi", "Emeka", "Tolu"]) expect(html).not.toContain(`${first} item`);
          await expect(page.getByRole("heading", { level: 1 })).toContainText("'s wishlist");
          await expect(page.getByText("2 items")).toBeVisible();
          await expect(page.getByText("Recently changed first")).toBeVisible();
          await expectNoAxeViolations(page);

          // ₦90,000 is over the ₦5,000 to ₦10,000 budget.
          const rowB = page.getByRole("link", { name: / item B/ });
          await expect(rowB).toContainText("Over budget");

          const rowA = page.getByRole("link", { name: / item A/ });
          await rowA.click();
          const dialog = page.getByRole("dialog", { name: / item A/ });
          await expect(dialog).toBeVisible();
          await expect(dialog).toContainText("Within the ₦5,000 to ₦10,000 budget.");
          await expect(dialog.getByRole("button", { name: "Open the shop" })).toHaveCount(0);
          await expect(dialog).toContainText("No shop link. The name and note are all there is.");
          await dialog.getByRole("button", { name: "I got this" }).click();
          await expect(page.getByText(/Marked “.* item A” as got\. Only you can see this\./)).toBeVisible();
          await expect(rowA).toContainText("You got this");
          await page.getByRole("button", { name: "Undo" }).click();
          await expect(rowA).not.toContainText("You got this");

          // Hide again on this device: the list page shows nothing of the person and loads nothing.
          await page.goto(`/exchanges/${exchange.id}/reveal`);
          await page.getByRole("button", { name: "Hide again" }).click();
          await page.goto(`/exchanges/${exchange.id}/recipient`);
          await expect(page.getByRole("heading", { name: "Hidden on this device" })).toBeVisible();
          await expect(page.getByText(" item A")).toHaveCount(0);
          await expect(page.getByRole("link", { name: "Show" })).toHaveAttribute("href", `/exchanges/${exchange.id}/reveal`);
        } finally {
          await giver.context.close();
        }
      });

      test("after the draw, a person with no list attaches one and removes it again, with Undo", async ({ browser }) => {
        test.setTimeout(240_000);
        const { ngozi, joined, exchange } = await exchangeWith("Late list swap", ["Ife", "Emeka", "Tolu"]);
        for (const person of [ngozi, ...joined.slice(0, 2)]) await listWithItems(exchange.id, person);
        const [, , tolu] = joined;
        // Tolu has a wishlist, but has not attached it to the exchange.
        const db = adminClient();
        const own = await db.from("wishlists").insert({ owner_id: tolu.id, name: "Tolu's list" }).select("id").single();
        if (own.error) throw new Error(own.error.message);

        const host = await signedIn(browser, viewport, ngozi, `/exchanges/${exchange.id}`);
        try {
          await host.page.getByRole("button", { name: /Draw names now/ }).click();
          await host.page.getByRole("dialog", { name: "Draw names for Late list swap?" }).getByRole("button", { name: "Draw names" }).click();
          await host.page.waitForURL(/\/exchanges\/[^/]+\/drawn$/);
        } finally {
          await host.context.close();
        }

        const member = await signedIn(browser, viewport, tolu, `/exchanges/${exchange.id}/list`);
        try {
          const page = member.page;
          await expect(page.getByRole("heading", { name: "Tell your giver what you'd like" })).toBeVisible();
          await expect(page.getByText("Your giver will see the list you pick as soon as you attach it.")).toBeVisible();
          await expect(page.getByRole("link", { name: "Skip for now" })).toHaveCount(0);
          await page.getByRole("button", { name: "Choose a wishlist" }).click();
          await page.getByRole("radio", { name: /Tolu's list/ }).check();
          await page.getByRole("button", { name: "Use this wishlist" }).click();
          await expect(page.getByText("Wishlist attached. Your giver can see it now.")).toBeVisible();

          await page.getByRole("button", { name: "Remove wishlist…" }).click();
          const sheet = page.getByRole("alertdialog", { name: "Remove your wishlist from Late list swap?" });
          await expect(sheet).toContainText("Your giver won't see it any more.");
          await sheet.getByRole("button", { name: "Remove wishlist" }).click();
          await expect(page.getByText("Wishlist removed from Late list swap.")).toBeVisible();
          await page.getByRole("button", { name: "Undo" }).click();
          await expect(page.getByRole("button", { name: "Remove wishlist…" })).toBeVisible();
        } finally {
          await member.context.close();
        }
      });
    });
  });
}
