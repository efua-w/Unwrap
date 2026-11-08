import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// WHY: the root entry is a client barrel and breaks in Server Components (plan §8).
const phosphorPath = {
  name: "@phosphor-icons/react",
  message: "Import from @phosphor-icons/react/dist/ssr (server-safe).",
};

// WHY: lib/supabase/admin uses SUPABASE_SECRET_KEY, which bypasses Row Level Security. Only Server
// Action files ("use server") may import it, so no client component can pull it into a bundle
// (owner decision 2026-11-04, open item 36). `server-only` and a runtime check back this up.
const adminPatterns = [
  {
    group: ["@/lib/supabase/admin", "**/supabase/admin", "./admin"],
    message: "lib/supabase/admin is server-only: import it only from a Server Action file (features/*/actions.ts).",
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": ["error", { paths: [phosphorPath], patterns: adminPatterns }],
    },
  },
  {
    files: ["features/*/actions.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [phosphorPath] }],
    },
  },
]);
