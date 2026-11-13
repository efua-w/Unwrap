// Compares the migration files in supabase/migrations with the versions a hosted project has recorded
// in supabase_migrations.schema_migrations. Run: npm run db:drift -- [--strict] <version> <version> ...
// The main session reads the versions through the Supabase connector (no token in CI, owner decision
// 2026-11-13) and passes them in.
//
// WHY: a migration run with execute_sql or the SQL editor changes the schema without a ledger row. The
// next `db push` then sees it as pending and runs it again, and fails half-way (audit finding 1,
// 2026-11-13: gift_day_date_only). "unknown" (recorded but no file) always fails; "pending" (a file
// not recorded) fails with --strict, which is how it is run right after applying migrations.
// Erasable TypeScript only (runs under Node type stripping).
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const VERSION = /^(\d{14})_[a-z0-9_]+\.sql$/;

export type Drift = { pending: string[]; unknown: string[] };

export function localVersions(fileNames: string[]): string[] {
  return fileNames.flatMap((name) => VERSION.exec(name)?.[1] ?? []).sort();
}

export function compareMigrations(local: string[], remote: string[]): Drift {
  const have = new Set(remote);
  const files = new Set(local);
  return {
    pending: local.filter((v) => !have.has(v)).sort(),
    unknown: remote.filter((v) => !files.has(v)).sort(),
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const remote = args.filter((a) => a !== "--strict");
  if (remote.some((v) => !/^\d{14}$/.test(v))) {
    console.error("db:drift: pass the recorded versions as 14-digit numbers (select version from supabase_migrations.schema_migrations).");
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const local = localVersions(readdirSync(resolve(root, "supabase/migrations")));
  const { pending, unknown } = compareMigrations(local, remote);
  for (const v of unknown) console.error(`db:drift: ${v} is recorded on the project but has no file in supabase/migrations`);
  for (const v of pending) console.error(`db:drift: ${v} has a file but is not recorded on the project (pending, or run without being recorded)`);
  if (unknown.length > 0 || (strict && pending.length > 0)) process.exit(1);
  console.log(`db:drift passed (${local.length} files, ${remote.length} recorded${pending.length ? `, ${pending.length} pending` : ""})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
