import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUser, sharedDbStatus, uniqueEmail } from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";

// Slice 3, signed out (GC-023 / S25). Needs the share_and_default_visibility migration applied to the
// project the app points at, plus SUPABASE_SECRET_KEY: lists are seeded with the secret key, then
// read by an anonymous visitor through the real page. Skips with the reason until then.

const created: string[] = [];

type Seed = { token: string; id: string };

async function seedList(options: {
  name: string;
  visibility?: "private" | "link";
  deleted?: boolean;
  items?: Array<{ name: string; link?: string | null; price_kobo?: number | null; priority?: string; note?: string | null }>;
}): Promise<Seed> {
  const email = uniqueEmail("shared");
  const ownerId = await createTestUser(email, "Amaka Obi");
  created.push(email);
  const db = adminClient();
  const { data, error } = await db
    .from("wishlists")
    .insert({ owner_id: ownerId, name: options.name, visibility: options.visibility ?? "link" })
    .select("id, share_token")
    .single();
  if (error || !data) throw new Error(`seed list failed: ${error?.message}`);
  const items = options.items ?? [];
  if (items.length > 0) {
    const { error: itemError } = await db
      .from("wishlist_items")
      .insert(items.map((item) => ({ priority: "nice_to_have", ...item, wishlist_id: data.id })));
    if (itemError) throw new Error(`seed items failed: ${itemError.message}`);
  }
  if (options.deleted) await db.from("wishlists").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
  return { token: data.share_token as string, id: data.id as string };
}

test.describe("Shared wishlist, signed out (needs the share migration)", () => {
  test.beforeAll(async () => {
    const status = await sharedDbStatus();
    test.skip(!status.ready, status.ready ? "" : status.reason);
  });

  test.afterEach(async () => {
    for (const email of created.splice(0)) await deleteTestUser(email);
  });

  test("a shared list shows its owner, intro and rows; links open safely; robots and referrer are off", async ({ page }, testInfo) => {
    const { token } = await seedList({
      name: "Birthday list",
      items: [
        { name: "Gold hoop earrings", link: "https://shop.example/hoops", price_kobo: 2_500_000, priority: "most_wanted", note: "Small hoops." },
        { name: "Snake plant", priority: "nice_to_have" },
        { name: "Spa day voucher", link: "https://shop.example/spa", price_kobo: 4_000_000 },
        { name: "Adire kimono", link: "https://shop.example/kimono", priority: "most_wanted" },
      ],
    });
    const response = await page.goto(`/w/${token}`);
    expect(response?.status()).toBe(200);
    // Hidden from search engines and no Referer leak (GC-023), as headers and as metadata.
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page).toHaveTitle("A wishlist on Unwrap");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "A wishlist on Unwrap");

    await expect(page.getByText("Amaka Obi", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Birthday list" })).toBeVisible();
    // Number words, and the first name only.
    await expect(page.getByText("Four things Amaka would love.", { exact: true })).toBeVisible();
    await expect(page.getByText("4 items", { exact: true })).toBeVisible();
    await expect(page.getByText("Recently changed first")).toHaveCount(0);
    // Price, note and priority are separate lines; priority is a badge (S25 update 2026-11-09).
    const hoopsRow = page.getByRole("listitem").filter({ hasText: "Gold hoop earrings" });
    await expect(hoopsRow.getByText("₦25,000", { exact: true })).toBeVisible();
    await expect(hoopsRow.getByText("Small hoops.", { exact: true })).toBeVisible();
    await expect(hoopsRow.getByText("Most wanted", { exact: true })).toBeVisible();

    // A row with a link opens it in a new tab, safely; a row without one is not a link.
    const hoops = page.getByRole("link", { name: /Gold hoop earrings/ });
    await expect(hoops).toHaveAttribute("href", "https://shop.example/hoops");
    await expect(hoops).toHaveAttribute("target", "_blank");
    await expect(hoops).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
    await expect(page.getByRole("link", { name: /Snake plant/ })).toHaveCount(0);
    await expect(page.getByText("Snake plant")).toBeVisible();

    // No owner-only controls, and the share token is not repeated in the markup.
    await expect(page.getByRole("button", { name: /Share|Edit|Remove/ })).toHaveCount(0);
    // WHY: Next's RSC payload carries the URL segment (the visitor has it in the address bar), so check what the page renders: no href, visible text or data-* attribute repeats it.
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => h.includes(token))).toEqual([]);
    expect(await page.locator("body").innerText()).not.toContain(token);
    const dataAttrs = await page.locator("*").evaluateAll((els) =>
      els.flatMap((el) => Array.from(el.attributes).filter((a) => a.name.startsWith("data-")).map((a) => a.value)),
    );
    expect(dataAttrs.filter((v) => v.includes(token))).toEqual([]);

    await expect(page.getByRole("link", { name: "Make a wishlist of your own" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "What is Unwrap?" })).toHaveAttribute("href", "/");
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `test-results/screenshots/shared-default-${testInfo.project.name}.png`, fullPage: true });
  });

  test("intro for one item, digits above ten, and the empty state", async ({ page }, testInfo) => {
    const one = await seedList({ name: "Just one", items: [{ name: "Kettle" }] });
    await page.goto(`/w/${one.token}`);
    await expect(page.getByText("One thing Amaka would love.", { exact: true })).toBeVisible();
    await expect(page.getByText("1 item", { exact: true })).toBeVisible();

    const many = await seedList({
      name: "Lots",
      items: Array.from({ length: 11 }, (_, i) => ({ name: `Thing ${i + 1}` })),
    });
    await page.goto(`/w/${many.token}`);
    await expect(page.getByText("11 things Amaka would love.", { exact: true })).toBeVisible();

    const empty = await seedList({ name: "Nothing yet" });
    await page.goto(`/w/${empty.token}`);
    await expect(page.getByRole("heading", { level: 2, name: "Amaka hasn't added anything yet." })).toBeVisible();
    await expect(
      page.getByText("Check back closer to the date. We'll show items here as soon as Amaka adds them."),
    ).toBeVisible();
    await expect(page.getByText(/things Amaka would love/)).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `test-results/screenshots/shared-empty-${testInfo.project.name}.png`, fullPage: true });
  });

  test("private, deleted, unknown and malformed links all give the same page and the same 404", async ({ page }, testInfo) => {
    const priv = await seedList({ name: "Hidden", visibility: "private", items: [{ name: "Secret thing" }] });
    const gone = await seedList({ name: "Gone", deleted: true, items: [{ name: "Gone thing" }] });
    const tokens = [priv.token, gone.token, "0".repeat(32), "not-a-token", priv.token.toUpperCase()];

    const seen: string[] = [];
    for (const token of tokens) {
      const response = await page.goto(`/w/${token}`);
      expect(response?.status(), token).toBe(404);
      expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      await expect(page.getByRole("heading", { level: 1, name: "This wishlist isn't available" })).toBeVisible();
      await expect(page.getByText("Its owner may have made it private. Ask them to send you the link again.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Make a wishlist of your own" })).toHaveAttribute("href", "/signup");
      const text = await page.locator("main").innerText();
      // Never names the list, its owner or what was behind the link, and never mentions turning off a link.
      expect(text).not.toMatch(/Hidden|Gone|Secret|Amaka|turn/i);
      seen.push(text);
    }
    expect(new Set(seen).size).toBe(1);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `test-results/screenshots/shared-unavailable-${testInfo.project.name}.png`, fullPage: true });
  });

  test("making a shared list private takes its link away at once", async ({ page }) => {
    const { token, id } = await seedList({ name: "Soon private", items: [{ name: "Lamp" }] });
    expect((await page.goto(`/w/${token}`))?.status()).toBe(200);
    await adminClient().from("wishlists").update({ visibility: "private" }).eq("id", id);
    expect((await page.goto(`/w/${token}`))?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This wishlist isn't available" })).toBeVisible();
  });
});
