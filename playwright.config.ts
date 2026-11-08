import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import { VIEWPORTS } from "./tests/e2e/viewports";

// WHY: the signed-in specs need SUPABASE_SECRET_KEY, which lives only in .env.local (never committed).
// CI passes it as an environment variable instead, so a missing file is fine.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// WHY: the port comes from the environment so a busy port on one machine is not committed config.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const SIGNED_IN = /auth-signed-in\.spec\.ts$/;

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
    // The dev server needs SUPABASE_SECRET_KEY too: Sign up's server-only account check uses it
    // (owner decision 2026-11-04, open item 36). Next reads it from .env.local, or from CI's env.
  },
  // One project per width (tests/e2e/viewports.ts), plus the signed-in spec in a project of its own.
  projects: [
    ...VIEWPORTS.map(({ name, viewport }) => ({ name, use: { viewport }, testIgnore: SIGNED_IN })),
    // WHY one worker, in file order (T2-1, T2-2): every signed-in test signs in for real against the
    // project and the one `next dev`. Run alongside each other, those sign-ins starved the server and
    // tests ran out of time wherever they happened to be (often closing a context). The spec runs its
    // three widths itself, so no two signed-in tests ever overlap; stubbed specs use the other worker.
    { name: "signed-in", testMatch: SIGNED_IN, fullyParallel: false, workers: 1 },
  ],
});
