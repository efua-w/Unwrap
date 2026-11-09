import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // WHY the alias: feature modules import with the app's "@/" paths (tsconfig), so unit tests that
  // load them need the same mapping.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
