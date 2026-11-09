import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function expectNoAxeViolations(page: Page) {
  // WHY: the sheet fades in (sheet-in, opacity 0 to 1). Axe blends colours with the live opacity, so
  // checking mid-animation reports false color-contrast failures (GC-019). Wait until every
  // animation, including ::backdrop ones, has finished; rules stay on.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }))).toEqual([]);
}
