import { defineConfig } from "@playwright/test";

// WHY: the port comes from the environment so a busy port on one machine is not committed config.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

// The galleries under /dev only exist in `next dev` (next.config.ts), so e2e runs against the dev server.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  // WHY: against `next dev` a request can take 15s or more when the server is busy (a traced reload took 17s),
  // so the defaults of 30s per test and 5s per expect are too tight. This is server latency, not a component fault.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // WHY: the dev server compiles on demand; many workers at once starve it and distort the timing tests.
  workers: process.env.CI ? 1 : 2,
  globalSetup: "./tests/e2e/global-setup.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, browserName: "chromium", trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `${baseURL}/dev/components`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // 390 and 1440 are the board widths; 768 is judged against the mobile design (CLAUDE.md DoD).
  projects: [
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
