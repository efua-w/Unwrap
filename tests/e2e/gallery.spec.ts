import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Gallery fixtures live in app/dev/components. Each group names the acceptance criterion it covers.

const PORT = process.env.E2E_PORT ?? "3100";

async function openComponents(page: Page) {
  await page.goto("/dev/components");
  // WHY: the toast region only becomes :popover-open in a client effect, so this means React has hydrated.
  await expect(page.locator("[popover]:popover-open")).toBeAttached();
  await page.waitForLoadState("networkidle");
}

// The cookie is stored URL-encoded.
async function tzCookie(context: BrowserContext): Promise<string | undefined> {
  const value = (await context.cookies()).find((c) => c.name === "tz")?.value;
  return value === undefined ? undefined : decodeURIComponent(value);
}

const toastRegion = (page: Page) => page.locator("[popover]");
const OFFLINE_COPY = "You're offline. Pages you've opened stay on screen.";
// The SkeletonRegion sample on the same page shows its own "Try again" after 8s, so scope to the banner.
const offlineBanner = (page: Page) => page.getByRole("status").filter({ hasText: OFFLINE_COPY });

test.describe("AC-12 Button busy", () => {
  test("Enter in a one-field form does not submit again while busy", async ({ page }) => {
    await openComponents(page);
    // WHY: the fixture is busy for 1.5s; a controlled clock keeps the busy window open however slow the machine is.
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    const field = page.getByLabel("One field form");
    const count = page.getByText(/^Submitted \d+$/);
    await field.fill("x");
    await field.press("Enter");
    await expect(count).toHaveText("Submitted 1");
    const save = page.getByRole("button", { name: "Save form" });
    await expect(save).toHaveAttribute("aria-busy", "true");
    await field.press("Enter");
    await save.dispatchEvent("click");
    await expect(count).toHaveText("Submitted 1");
    await page.clock.runFor(1600);
    await expect(save).not.toHaveAttribute("aria-busy", "true");
    await field.press("Enter");
    await expect(count).toHaveText("Submitted 2");
  });

  test("a busy link does not navigate and keeps focus", async ({ page }) => {
    await openComponents(page);
    const link = page.getByRole("link", { name: "Busy link" });
    await expect(link).toHaveAttribute("aria-busy", "true");
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/dev\/components$/);
    await expect(link).toBeFocused();
  });
});

test.describe("AC-14 Sheet", () => {
  test("Esc closes a confirm sheet, focus goes to the heading and back to the opener", async ({ page }) => {
    await openComponents(page);
    const opener = page.getByRole("button", { name: "Confirm sheet" });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Are you sure?" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a sheet mounted with open=true stays open under dev StrictMode, and closes on Esc (T1-1)", async ({ page }) => {
    await openComponents(page);
    const opener = page.getByRole("button", { name: "Mounted open sheet" });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The stale close event arrives a tick later; the sheet must still be there.
    await page.waitForTimeout(500);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Mounted open" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    // And it opens again the same way a second time.
    await opener.click();
    await page.waitForTimeout(500);
    await expect(dialog).toBeVisible();
  });

  test("a backdrop click closes a confirm sheet but not a destructive one; Esc closes both", async ({ page }) => {
    await openComponents(page);
    await page.getByRole("button", { name: "Confirm sheet" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "Destructive sheet" }).click();
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByRole("heading")).toBeFocused();
    await page.mouse.click(5, 5);
    await expect(alertDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(alertDialog).toBeHidden();
  });

  test("while busy, Esc (twice) and the backdrop do not close it, and focus stays inside", async ({ page }) => {
    await openComponents(page);
    // WHY: the demo action is busy for 1.5s; a controlled clock keeps the busy window open under load.
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.getByRole("button", { name: "Confirm sheet" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    // Focus stays inside the dialog: on the busy Confirm button, or on the heading if the dialog was re-shown.
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.clock.runFor(1600);
    await expect(dialog).toBeHidden();
  });

  test("the form sheet footer stays inside the viewport", async ({ page }) => {
    await openComponents(page);
    await page.getByRole("button", { name: "Form sheet" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Confirm" })).toBeInViewport();
  });
});

test.describe("AC-15 Toast", () => {
  test("a new toast replaces the current one", async ({ page }) => {
    await openComponents(page);
    await page.getByRole("button", { name: "Show toast", exact: true }).click();
    await expect(toastRegion(page)).toContainText("Saved.");
    await page.getByRole("button", { name: "Show toast with action" }).click();
    await expect(toastRegion(page)).toContainText("Item deleted.");
    await expect(toastRegion(page)).not.toContainText("Saved.");
  });

  test("a toast raised under an open sheet is held, then shown with a usable action once it closes (item 12)", async ({
    page,
  }) => {
    await openComponents(page);
    await page.getByRole("button", { name: "Destructive sheet" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Show toast from sheet" }).click();
    await page.waitForTimeout(500);
    await expect(toastRegion(page)).not.toContainText("Item deleted.");
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    const toast = toastRegion(page);
    await expect(toast).toContainText("Item deleted.");
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(toast).toContainText("Restored.");
  });

  test("hover holds the timer; the toast leaves once the remaining time runs out", async ({ page }) => {
    await openComponents(page);
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.getByRole("button", { name: "Show toast", exact: true }).click();
    const toast = toastRegion(page);
    await expect(toast).toContainText("Saved.");
    await page.clock.runFor(3000);
    await toast.getByText("Saved.").hover();
    await page.clock.runFor(10_000);
    await expect(toast).toContainText("Saved.");
    await page.mouse.move(0, 0);
    await page.clock.runFor(500);
    await expect(toast).toContainText("Saved.");
    await page.clock.runFor(1000);
    await expect(toast).not.toContainText("Saved.");
  });

  test("focus holds the toast after the pointer leaves, then focus restores to the opener", async ({ page }) => {
    await openComponents(page);
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    const opener = page.getByRole("button", { name: "Show toast with action" });
    await opener.click();
    const toast = toastRegion(page);
    const undo = toast.getByRole("button", { name: "Undo" });
    await undo.focus();
    await undo.hover();
    await page.mouse.move(0, 0);
    await page.clock.runFor(20_000);
    await expect(toast).toContainText("Item deleted.");
    await page.keyboard.press("Enter");
    await expect(toast).toContainText("Restored.");
    await expect(opener).toBeFocused();
  });
});

test.describe("AC-16 offline banner", () => {
  test("shows the exact copy offline and clears when back online", async ({ page, context }) => {
    await openComponents(page);
    await expect(page.getByText(OFFLINE_COPY, { exact: true })).toHaveCount(1); // the static Alert sample
    await context.setOffline(true);
    await expect(page.getByText(OFFLINE_COPY, { exact: true })).toHaveCount(2);
    await offlineBanner(page).getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText(OFFLINE_COPY, { exact: true })).toHaveCount(2);
    await context.setOffline(false);
    await expect(page.getByText(OFFLINE_COPY, { exact: true })).toHaveCount(1);
  });

  test("Try again clears a banner raised by a failed request", async ({ page }) => {
    await openComponents(page);
    await page.getByRole("button", { name: "reportNetworkError()" }).click();
    await expect(page.getByText(OFFLINE_COPY, { exact: true })).toHaveCount(2);
    await offlineBanner(page).getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText(OFFLINE_COPY, { exact: true })).toHaveCount(1);
  });

  test("the banner's live region is mounted while online", async ({ page }) => {
    await openComponents(page);
    expect(await page.locator('[role="status"]').count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe("AC-18 SkeletonRegion timing", () => {
  test("nothing for 300ms, skeletons after, the slow line at 8s", async ({ page }) => {
    await openComponents(page);
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.getByRole("button", { name: "Restart loading (slow line at 8s)" }).click();
    const region = page.locator('[aria-busy="true"]').last();
    await expect(region).toBeAttached();
    await expect(region.locator("> *")).toHaveCount(0);
    await page.clock.runFor(250);
    await expect(region.locator("> *")).toHaveCount(0);
    await page.clock.runFor(100);
    await expect(region.locator("> *")).toHaveCount(2);
    await expect(page.getByText("Taking longer than usual.")).toHaveCount(0);
    await page.clock.runFor(7700);
    await expect(page.getByRole("status").getByText("Taking longer than usual.")).toBeVisible();
    // The slow line sits outside the aria-busy block, so it is announced.
    await expect(region.getByText("Taking longer than usual.")).toHaveCount(0);
  });
});

test.describe("AC-11 time zone cookie", () => {
  test.use({ timezoneId: "Africa/Accra" });

  test("is set once, with a single refresh, and not again on a reload", async ({ page, context }) => {
    const refreshes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("_rsc=") && request.headers()["rsc"] === "1") refreshes.push(request.url());
    });
    await page.goto("/dev/components");
    await expect(page.locator("[popover]:popover-open")).toBeAttached(); // hydrated
    // Raised poll timeout: the cookie is written after hydration, which waits on the dev server.
    await expect.poll(() => tzCookie(context), { timeout: 15_000 }).toBe("Africa/Accra");
    await page.waitForTimeout(1500);
    expect(refreshes).toHaveLength(1);
    await page.reload();
    await expect(page.locator("[popover]:popover-open")).toBeAttached(); // hydrated
    await page.waitForTimeout(1500);
    expect(refreshes).toHaveLength(1);
  });

  test("an invalid cookie value is replaced by the browser's zone", async ({ page, context }) => {
    await context.addCookies([{ name: "tz", value: "Not%2FAZone", url: `http://localhost:${PORT}` }]);
    await page.goto("/dev/components");
    await expect(page.locator("[popover]:popover-open")).toBeAttached(); // hydrated
    await expect.poll(() => tzCookie(context), { timeout: 15_000 }).toBe("Africa/Accra");
  });
});

test.describe("AC-22 keyboard focus", () => {
  test("every control reached by Tab shows a 2px solid outline with a 2px offset, until focus wraps", async ({ page }) => {
    await openComponents(page);
    const MAX_TABS = 120;
    let first: string | null = null;
    let visited = 0;
    for (let i = 0; i < MAX_TABS; i += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        // The Next dev overlay (dev tooling, not product UI) sits after the page content in tab order.
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
        const s = getComputedStyle(el);
        const label = el.tagName + ":" + (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30);
        return { label, style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset };
      });
      if (info === null) break; // focus left the page content: the cycle is complete
      if (first === null) first = info.label;
      else if (info.label === first) break;
      visited += 1;
      expect(info.style, info.label).toBe("solid");
      expect(info.width, info.label).toBe("2px");
      expect(info.offset, info.label).toBe("2px");
    }
    expect(visited, "should have visited the whole gallery, not stopped at the bound").toBeGreaterThan(20);
    expect(visited).toBeLessThan(MAX_TABS);
  });
});
