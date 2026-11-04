import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/dev/components", "/dev/shell"] as const;

for (const path of PAGES) {
  test.describe(path, () => {
    test("has no axe violations", async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // WHY: the Next dev overlay is tooling, not product UI.
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("nextjs-portal")
        .analyze();
      expect(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) })),
      ).toEqual([]);
    });

    test("saves a full-page screenshot for board comparison", async ({ page }, info) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const name = `${path.replace(/\//g, "-").slice(1)}-${info.project.name}.png`;
      await page.screenshot({ path: `test-results/screenshots/${name}`, fullPage: true });
    });
  });
}
