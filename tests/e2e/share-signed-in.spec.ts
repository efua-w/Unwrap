import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sharedDbStatus,
  signInThroughVerify,
  uniqueEmail,
} from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { VIEWPORTS } from "./viewports";

// Slice 3, signed in (GC-022, GC-027): the default visibility in Privacy, a new list starting from
// it, and the Share sheet. Needs the share_and_default_visibility migration applied (see
// shared-wishlist.spec.ts). Runs in the single-worker "signed-in" project, all three widths in turn.

const created: string[] = [];
const toast = (page: Page) => page.locator("[popover]");

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport });

    test.describe("Share and default visibility (needs the share migration)", () => {
      test.beforeAll(async () => {
        const status = await sharedDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
      });

      test.afterEach(async () => {
        for (const email of created.splice(0)) await deleteTestUser(email);
      });

      test("Privacy default, a new list starting from it, and the Share sheet end to end", async ({ page, context }) => {
        test.setTimeout(180_000);
        const email = uniqueEmail("share");
        const userId = await createTestUser(email, "Amaka");
        created.push(email);
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        // WHY: the WhatsApp tab must not reach the real site.
        await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
        await signInThroughVerify(context, page, email, { next: "/profile" });

        // S45: Profile has a Privacy row; the default starts as Private.
        await page.getByRole("link", { name: "Privacy" }).click();
        await expect(page).toHaveURL(/\/profile\/privacy$/);
        await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
        await expect(page.getByText("Changes save as you make them.")).toBeVisible();
        const group = page.getByRole("group", { name: "Default for new wishlists" });
        await expect(group.getByRole("radio", { name: "Private" })).toBeChecked();
        await expect(group.getByText("Only you, until you share it.")).toBeVisible();
        await expectNoAxeViolations(page);

        await group.getByRole("radio", { name: "Anyone with the link" }).check();
        await expect(toast(page)).toContainText("Saved. New wishlists start as Anyone with the link.");
        await expect
          .poll(async () => {
            const { data } = await adminClient()
              .from("user_settings")
              .select("default_wishlist_visibility")
              .eq("user_id", userId)
              .single();
            return data?.default_wishlist_visibility;
          })
          .toBe("link");
        await page.reload();
        await expect(
          page.getByRole("group", { name: "Default for new wishlists" }).getByRole("radio", { name: "Anyone with the link" }),
        ).toBeChecked();
        await page.screenshot({ path: `test-results/screenshots/privacy-link-${width}.png`, fullPage: true });

        // GC-027: New wishlist starts from the default; Edit uses the list's own value (below).
        await page.goto("/wishlists");
        await page.getByRole("button", { name: "New wishlist" }).click();
        const newSheet = page.getByRole("dialog", { name: "New wishlist" });
        await expect(newSheet.getByRole("radio", { name: "Anyone with the link" })).toBeChecked();
        await newSheet.getByLabel("List name").fill("Birthday list");
        await newSheet.getByRole("button", { name: "Create list" }).click();
        await expect(page).toHaveURL(/\/wishlists\/[0-9a-f-]{36}$/);
        const listId = page.url().split("/").pop() ?? "";
        await expect(page.getByText("Anyone with the link can see this")).toBeVisible();
        const { data: row } = await adminClient().from("wishlists").select("share_token").eq("id", listId).single();
        const token = row?.share_token as string;
        const shareUrl = `${new URL(page.url()).origin}/w/${token}`;

        // S23 Share sheet, public state: the link, WhatsApp, Copy link.
        await page.getByRole("button", { name: "Share" }).click();
        const sheet = page.getByRole("dialog", { name: "Share “Birthday list”" });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText("Your link")).toBeVisible();
        await expect(sheet.getByText(shareUrl, { exact: true })).toBeVisible();
        await expect(sheet.getByRole("radio", { name: "Anyone with the link" })).toBeChecked();
        await expect(sheet.getByText("It's private, so there's no link yet.")).toHaveCount(0);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/share-public-${width}.png`, fullPage: true });

        // WhatsApp message, as written in GC-022.
        const popup = page.waitForEvent("popup");
        await sheet.getByRole("button", { name: "Share to WhatsApp" }).click();
        const wa = await popup;
        const text = new URL(wa.url()).searchParams.get("text");
        expect(text).toBe(`Here's my wishlist, "Birthday list", on Unwrap. Take a look: ${shareUrl}`);
        await wa.close();

        // Copy link: the clipboard holds the link; the confirmation toast shows once the sheet closes
        // (a toast held under an open Sheet is presented when it closes).
        await sheet.getByRole("button", { name: "Copy link" }).click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(shareUrl);
        await sheet.getByRole("button", { name: "Done" }).click();
        await expect(toast(page)).toContainText("Link copied. Paste it anywhere to share.");

        // Choosing Private in the sheet turns sharing off; the link stops working at once.
        await page.getByRole("button", { name: "Share" }).click();
        const again = page.getByRole("dialog", { name: "Share “Birthday list”" });
        await again.getByRole("radio", { name: "Private" }).check();
        await expect(again.getByText("It's private, so there's no link yet.")).toBeVisible();
        await expect(again.getByRole("button", { name: "Get a shareable link" })).toBeVisible();
        await expect(again.getByText("Your link")).toHaveCount(0);
        await expect
          .poll(async () => (await adminClient().from("wishlists").select("visibility").eq("id", listId).single()).data?.visibility)
          .toBe("private");
        expect((await page.request.get(shareUrl)).status()).toBe(404);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/share-private-${width}.png`, fullPage: true });

        // "Get a shareable link" makes it shareable again, with the same permanent link.
        await again.getByRole("button", { name: "Get a shareable link" }).click();
        await expect(again.getByText(shareUrl, { exact: true })).toBeVisible();
        expect((await page.request.get(shareUrl)).status()).toBe(200);
        await again.getByRole("button", { name: "Done" }).click();
        await expect(page.getByText("Anyone with the link can see this")).toBeVisible();

        // Edit list shows the list's own value, not the default; then set the default back to Private.
        await page.getByRole("button", { name: "Edit list" }).click();
        await expect(
          page.getByRole("dialog", { name: "Edit list" }).getByRole("radio", { name: "Anyone with the link" }),
        ).toBeChecked();
        await page.keyboard.press("Escape");
        await page.goto("/profile/privacy");
        await page.getByRole("radio", { name: "Private" }).check();
        await expect(toast(page)).toContainText("Saved. New wishlists start as Private.");
      });
    });
  });
}
