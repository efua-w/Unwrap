// Fails when the secret key's name or value shows up in anything `next build` sends to browsers:
// the client bundles in .next/static and the prerendered pages in .next/server/app. Run after a
// build: npm run secrets:check. Prints file paths only, never the value (open item 36: the key is
// now read by server code, so this checks it never leaks into client output).
// Erasable TypeScript only (runs under Node type stripping).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const SECRET_NAMES = ["SUPABASE_SECRET_KEY"];
const PRERENDERED_EXTENSIONS = new Set([".html", ".rsc", ".body", ".meta"]);
// WHY a minimum: a very short or empty value would match by accident and say nothing.
const MIN_VALUE_LENGTH = 16;

export type Leak = { file: string; found: "name" | "value" };

export function findLeaks(files: Array<{ file: string; content: string }>, names: string[], values: string[]): Leak[] {
  const usableValues = values.filter((v) => v.length >= MIN_VALUE_LENGTH);
  const leaks: Leak[] = [];
  for (const { file, content } of files) {
    if (names.some((n) => content.includes(n))) leaks.push({ file, found: "name" });
    if (usableValues.some((v) => content.includes(v))) leaks.push({ file, found: "value" });
  }
  return leaks;
}

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(path);
  }
  return out;
}

function main(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const staticDir = join(".next", "static");
  if (!existsSync(staticDir)) {
    console.error("secrets:check: .next/static is missing; run `npm run build` first.");
    process.exit(1);
  }
  const files = walk(staticDir, () => true);
  const appDir = join(".next", "server", "app");
  if (existsSync(appDir)) files.push(...walk(appDir, (p) => PRERENDERED_EXTENSIONS.has(extname(p))));

  const values = SECRET_NAMES.map((n) => process.env[n] ?? "");
  const leaks = findLeaks(
    files.map((file) => ({ file: relative(".", file), content: readFileSync(file, "utf8") })),
    SECRET_NAMES,
    values,
  );
  if (leaks.length > 0) {
    for (const leak of leaks) console.error(`secrets:check: the secret's ${leak.found} appears in ${leak.file}`);
    process.exit(1);
  }
  const checkedValue = values.some((v) => v.length >= MIN_VALUE_LENGTH);
  console.log(
    `secrets:check passed (${files.length} files; name checked; value ${checkedValue ? "checked" : "not set, so not checked"})`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
