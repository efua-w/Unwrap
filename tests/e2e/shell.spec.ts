import { expect, test } from "@playwright/test";

// AC-21: tabs below 768, sidebar from 768. aria-current is covered by the isActivePath unit test
// because the gallery routes are not one of the four sections.
test.describe("AC-21 app shell", () => {
  test("shows bottom tabs below 768 and the sidebar from 768", async ({ page }, info) => {
    await page.goto("/dev/shell");
    const nav = page.getByRole("navigation", { name: "Main" });
    const visible = nav.filter({ visible: true });
    await expect(visible).toHaveCount(1);
    const box = await visible.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    if (width < 768) {
      expect(box?.y ?? 0, info.project.name).toBeGreaterThan(400);
      await expect(page.getByRole("link", { name: "Profile and settings" })).toBeVisible();
    } else {
      expect(box?.x ?? 1, info.project.name).toBeLessThan(300);
      await expect(page.getByRole("link", { name: /Ada Okafor/ })).toBeVisible();
    }
  });

  test("the unread count is in the Activity link's name", async ({ page }) => {
    await page.goto("/dev/shell?unread=12");
    await expect(page.getByRole("link", { name: "Activity, 12 unread" }).filter({ visible: true })).toHaveCount(1);
    await page.goto("/dev/shell?unread=0");
    await expect(page.getByRole("link", { name: "Activity", exact: true }).filter({ visible: true })).toHaveCount(1);
  });

  test("the back header link goes to the parent page", async ({ page }) => {
    await page.goto("/dev/shell?back=1");
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/dev/shell");
  });

  // T6-1: from 768 the offline banner sits in the content column, beside the Sidebar.
  test("the offline banner does not overlap the Sidebar", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-1440", "the Sidebar only exists from 768; the 1440 case is the one decided");
    await page.goto("/dev/shell");
    await expect(page.locator("[popover]:popover-open")).toBeAttached();
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    const banner = page.getByRole("status").filter({ hasText: "You're offline." });
    await expect(banner.getByText("You're offline. Pages you've opened stay on screen.")).toBeVisible();
    const sidebar = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    const bannerBox = await banner.getByText("You're offline.").boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();
    expect((bannerBox?.x ?? 0)).toBeGreaterThanOrEqual((sidebarBox?.x ?? 0) + (sidebarBox?.width ?? 0));
    const home = sidebar.getByRole("link", { name: "Home" });
    await expect(home).toBeVisible();
    await home.click({ trial: true });
  });
});
