import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  signInThroughVerify,
  uniqueEmail,
  wishlistsDbStatus,
} from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { VIEWPORTS } from "./viewports";

// Slice 2, signed in (GC-018 to GC-021). Needs the wishlists migration applied to the project the
// app points at, plus SUPABASE_SECRET_KEY (see auth-signed-in.spec.ts). Until then every test here
// skips with the reason; nothing is faked. Runs in the single-worker "signed-in" project
// (playwright.config.ts), all three widths in turn.

const created: string[] = [];
const UUID_PATH = /\/wishlists\/[0-9a-f-]{36}$/;

const toast = (page: Page) => page.locator("[popover]");

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport });

    test.describe("Wishlists (needs the wishlists migration)", () => {
      test.beforeAll(async () => {
        const status = await wishlistsDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
      });

      test.afterEach(async () => {
        for (const email of created.splice(0)) await deleteTestUser(email);
      });

      async function newUser(firstName: string): Promise<string> {
        const email = uniqueEmail("wl");
        await createTestUser(email, firstName);
        created.push(email);
        return email;
      }

      async function shot(page: Page, name: string) {
        await page.screenshot({ path: `test-results/screenshots/wishlists-${name}-${width}.png`, fullPage: true });
      }

      test("create a list, add, edit, remove and undo an item, change who can see it, delete and undo", async ({
        page,
        context,
      }) => {
        test.setTimeout(180_000);
        const email = await newUser("Amaka");
        await signInThroughVerify(context, page, email, { next: "/wishlists" });
        await expect(page).toHaveURL(/\/wishlists$/);

        // GC-018 first time.
        await expect(page.getByRole("heading", { level: 1, name: "Wishlists" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Make your first wishlist." })).toBeVisible();
        await expectNoAxeViolations(page);
        await shot(page, "first");

        // GC-019 New wishlist: name required, Private preselected.
        await page.getByRole("button", { name: "New wishlist" }).click();
        const newSheet = page.getByRole("dialog", { name: "New wishlist" });
        await expect(newSheet).toBeVisible();
        await expect(newSheet.getByRole("radio", { name: "Private" })).toBeChecked();
        await expect(newSheet.getByText("Only you, and your giver in any exchange you add it to.")).toBeVisible();
        await newSheet.getByRole("button", { name: "Create list" }).click();
        await expect(newSheet.getByText("Give your list a name so people know what it's for.")).toBeVisible();
        await expect(newSheet.getByLabel("List name")).toBeFocused();
        await expectNoAxeViolations(page);
        await shot(page, "new-error");
        await newSheet.getByLabel("List name").fill("Birthday list");
        await newSheet.getByRole("button", { name: "Create list" }).click();

        // GC-020 detail, empty.
        await expect(page).toHaveURL(UUID_PATH);
        const listUrl = page.url();
        await expect(page.getByRole("heading", { level: 1, name: "Birthday list" })).toBeVisible();
        await expect(page.getByText("Only you can see this")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Add your first item" })).toBeVisible();
        await expect(page.getByText("Add a link and we'll fill in the name and price.")).toHaveCount(0);
        // Slice 3: Share is on every list (S21, S23).
        await expect(page.getByRole("button", { name: "Share" })).toBeVisible();

        // GC-021 Add an item: errors, then a valid item. Nice to have is preselected (owner Q7).
        await page.getByRole("button", { name: "Add an item" }).click();
        const itemSheet = page.getByRole("dialog", { name: "Add an item" });
        await expect(itemSheet.getByRole("radio", { name: "Nice to have" })).toBeChecked();
        await expect(itemSheet.getByRole("button", { name: "Add a photo" })).toHaveCount(0);
        await itemSheet.getByLabel("Link (optional)").fill("javascript:alert(1)");
        await itemSheet.getByLabel("Price").fill("85.50");
        await itemSheet.getByRole("button", { name: "Add to list" }).click();
        await expect(itemSheet.getByText("Check the link. It should start with https://")).toBeVisible();
        await expect(itemSheet.getByText("Add a name so your giver knows what it is.")).toBeVisible();
        await expect(itemSheet.getByText("Use whole naira, with no kobo. For example, 8500.")).toBeVisible();
        await expect(itemSheet.getByLabel("Link (optional)")).toBeFocused();
        await expectNoAxeViolations(page);
        await shot(page, "item-errors");
        await itemSheet.getByLabel("Price").fill("2,000,000,000");
        await itemSheet.getByRole("button", { name: "Add to list" }).click();
        await expect(itemSheet.getByText("That's over ₦1,000,000,000. Enter a smaller amount.")).toBeVisible();

        await itemSheet.getByLabel("Link (optional)").fill("jumia.com.ng/tote");
        await itemSheet.getByLabel("What is it?").fill("Ankara tote bag");
        await itemSheet.getByLabel("Price").fill("8,500");
        await itemSheet.getByText("Most wanted", { exact: true }).click();
        await itemSheet.getByLabel("Note for your giver").fill("Any colour but brown.");
        await itemSheet.getByRole("button", { name: "Add to list" }).click();
        await expect(itemSheet).toBeHidden();
        await expect(toast(page)).toContainText("Added 'Ankara tote bag'.");
        await expect(page.getByText("₦8,500 · Most wanted. Any colour but brown.")).toBeVisible();
        await expect(page.getByText("1 item", { exact: true })).toBeVisible();
        await expect(page.getByText("Recently changed first")).toBeVisible();

        // Money is stored as kobo, the link with https:// added (GC-021).
        const listId = listUrl.split("/").pop() ?? "";
        const { data: stored } = await adminClient()
          .from("wishlist_items")
          .select("price_kobo, link, priority, note")
          .eq("wishlist_id", listId)
          .single();
        expect(stored).toEqual({
          price_kobo: 850000,
          link: "https://jumia.com.ng/tote",
          priority: "most_wanted",
          note: "Any colour but brown.",
        });

        // Edit the item from its row.
        await page.getByRole("button", { name: /^Ankara tote bag/ }).click();
        const editSheet = page.getByRole("dialog", { name: "Edit item" });
        await expect(editSheet.getByLabel("Price")).toHaveValue("8,500");
        await editSheet.getByLabel("Price").fill("9000");
        await editSheet.getByRole("button", { name: "Save" }).click();
        await expect(editSheet).toBeHidden();
        await expect(toast(page)).toContainText("Saved 'Ankara tote bag'.");
        await expect(page.getByText("₦9,000 · Most wanted. Any colour but brown.")).toBeVisible();

        // GC-020 remove with the bin, then Undo.
        await page.getByRole("button", { name: "Remove Ankara tote bag" }).click();
        await expect(toast(page)).toContainText("Removed 'Ankara tote bag'.");
        await expect(page.getByText("₦9,000 · Most wanted. Any colour but brown.")).toHaveCount(0);
        // R1-1: the bin is gone, so with no other row focus lands on "Add an item".
        await expect(page.getByRole("button", { name: "Add an item" })).toBeFocused();
        await toast(page).getByRole("button", { name: "Undo" }).click();
        await expect(page.getByText("₦9,000 · Most wanted. Any colour but brown.")).toBeVisible();
        await page.reload();
        await expect(page.getByText("₦9,000 · Most wanted. Any colour but brown.")).toBeVisible();

        // GC-019 Edit list: anyone with the link.
        await page.getByRole("button", { name: "Edit list" }).click();
        const editList = page.getByRole("dialog", { name: "Edit list" });
        await expect(editList.getByLabel("List name")).toHaveValue("Birthday list");
        await editList.getByRole("radio", { name: "Anyone with the link" }).check();
        await expectNoAxeViolations(page);
        await editList.getByRole("button", { name: "Save" }).click();
        await expect(editList).toBeHidden();
        await expect(page.getByText("Anyone with the link can see this")).toBeVisible();
        await shot(page, "detail");

        // My wishlists row.
        await page.getByRole("link", { name: "Back" }).click();
        await expect(page).toHaveURL(/\/wishlists$/);
        await expect(page.getByRole("link", { name: /Birthday list/ })).toContainText("1 item · updated today");
        await expect(page.getByRole("link", { name: /Birthday list/ })).toContainText("Anyone with the link");
        await expectNoAxeViolations(page);
        await shot(page, "list");

        // GC-019 delete from the detail page, then Undo from the toast on My wishlists.
        await page.getByRole("link", { name: /Birthday list/ }).click();
        await expect(page).toHaveURL(UUID_PATH);
        await page.getByRole("button", { name: "Delete list" }).click();
        const del = page.getByRole("alertdialog", { name: "Delete 'Birthday list'?" });
        await expect(del).toBeVisible();
        await expect(del).toContainText(
          "It isn't in any exchange, so nothing else changes. Anyone with the link will see that it's gone.",
        );
        await expectNoAxeViolations(page);
        await shot(page, "delete");
        // R1-10: Keep list returns focus to the button that opened the sheet.
        await del.getByRole("button", { name: "Keep list" }).click();
        await expect(del).toBeHidden();
        await expect(page.getByRole("button", { name: "Delete list" })).toBeFocused();
        await page.getByRole("button", { name: "Delete list" }).click();
        await expect(del).toBeVisible();
        await del.getByRole("button", { name: "Delete list" }).click();
        await expect(page).toHaveURL(/\/wishlists$/);
        await expect(toast(page)).toContainText("Deleted 'Birthday list'.");
        await expect(page.getByRole("heading", { name: "You don't have any wishlists right now." })).toBeVisible();
        await toast(page).getByRole("button", { name: "Undo" }).click();
        await expect(page.getByRole("link", { name: /Birthday list/ })).toBeVisible();

        // Soft delete only: the items were never touched (never-do 8).
        const { data: items } = await adminClient()
          .from("wishlist_items")
          .select("id, deleted_at")
          .eq("wishlist_id", listId);
        expect(items).toHaveLength(1);
        expect(items?.[0]?.deleted_at).toBeNull();
      });

      test("someone else's list, a deleted one and a missing one show the same private state", async ({
        browser,
        baseURL,
      }) => {
        const ownerEmail = await newUser("Amaka");
        const otherEmail = await newUser("Bola");
        const db = adminClient();
        const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
        const ownerId = users?.users.find((u) => u.email === ownerEmail)?.id;
        const { data: list } = await db
          .from("wishlists")
          .insert({ owner_id: ownerId, name: "Secret birthday list" })
          .select("id")
          .single();
        const { data: gone } = await db
          .from("wishlists")
          .insert({ owner_id: ownerId, name: "Old secret list", deleted_at: new Date().toISOString() })
          .select("id")
          .single();

        const context = await browser.newContext({ baseURL, viewport });
        try {
          const page = await context.newPage();
          await signInThroughVerify(context, page, otherEmail);
          for (const id of [list?.id, gone?.id, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
            const response = await page.goto(`/wishlists/${id}`);
            await expect(page.getByRole("heading", { level: 1, name: "This wishlist is private" })).toBeVisible();
            await expect(page.getByText("Only its owner, and their giver in an exchange, can see it.")).toBeVisible();
            await expect(page.getByRole("link", { name: "Go to your wishlists" })).toBeVisible();
            const html = (await response?.text()) ?? "";
            expect(html).not.toContain("Secret birthday list");
            expect(html).not.toContain("Old secret list");
            expect(html).not.toContain("Amaka");
          }
          await expectNoAxeViolations(page);
        } finally {
          await context.close();
        }
      });
    });
  });
}
