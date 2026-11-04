// Fails when source code uses a design value that is not a token, or when styles/tokens.css is
// stale. Run: npm run tokens:check. Erasable TypeScript only (runs under Node type stripping).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildTokensCss, normalizeEol, readTokenExport } from "./build-tokens.ts";

export type Violation = { file: string; line: number; column: number; rule: string };

const SCAN_DIRS = ["app", "components", "features", "lib", "styles"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_FILES = new Set(["styles/tokens.css"]);
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const ALLOW_MARKER = /tokens-allow:\s*\S/;

// WHY: the only breakpoint is md (768, plan §8).
const SPACING_PREFIX =
  "(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|w|h|size|min-w|min-h|max-w|max-h|inset|inset-x|inset-y|top|right|bottom|left|start|end)";
// WHY: offsets, decoration and stroke widths are scale values too (R1-4).
const BORDER_PREFIX =
  "(?:border(?:-[xytrblse])?|outline-offset|outline|ring-offset|ring|inset-ring|divide-x|divide-y|underline-offset|decoration|stroke)";

type Rule = { name: string; pattern: RegExp; tsxOnly?: boolean; cssOnly?: boolean };

// Each pattern has the global flag; the scanner reports every match with line and column.
const RULES: Rule[] = [
  // `href="#add"` is an anchor, not a colour.
  { name: "hex colour", pattern: /(?<![\w&])(?<!href=["'`])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g },
  { name: "colour function", pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(/g },
  { name: "px value", pattern: /(?<!\w)-?\d*\.?\d+px\b/g },
  // WHY: in CSS a raw rem/em is as off-token as px. tokens.css, the only place that may hold them, is skipped.
  { name: "rem/em value", pattern: /(?<![\w-])-?\d*\.?\d+r?em\b/g, cssOnly: true },
  { name: "arbitrary value", pattern: /[\w-]-\[[^\]\s]*\]/g },
  { name: "arbitrary property", pattern: /\[[a-z-]+:[^\s\]]+\]/g },
  { name: "arbitrary variable", pattern: /-\((?:[a-z-]+:)?--[\w-]+\)/g },
  { name: "inline style", pattern: /\bstyle=\{/g, tsxOnly: true },
  { name: "breakpoint other than md", pattern: /(?<![\w-])(?:max-)?(?:sm|lg|xl|2xl):[a-z!([-]/g },
  { name: "numeric icon size", pattern: /\bsize=\{?\d/g, tsxOnly: true },
];

export function allowedSpacingKeys(tokensCss: string): Set<string> {
  return new Set([...tokensCss.matchAll(/--spacing-(\d+):/g)].map((m) => m[1] ?? ""));
}

export function allowedBorderKeys(tokensCss: string): Set<string> {
  const keys = new Set(["0"]);
  for (const m of tokensCss.matchAll(/--border-width-(\d+):/g)) keys.add(m[1] ?? "");
  return keys;
}

// WHY: comment state is tracked across lines, so a `*` line is a comment only inside a `/* ... */`
// block. A leading `*` outside one is the CSS universal selector, which is code (R1-4, T2-1).
function classifyLine(line: string, inBlock: boolean): { skip: boolean; inBlock: boolean } {
  if (inBlock) return { skip: true, inBlock: !line.includes("*/") };
  const t = line.trim();
  if (t.startsWith("//")) return { skip: true, inBlock: false };
  if (t.startsWith("/*")) return { skip: true, inBlock: !t.includes("*/") };
  return { skip: false, inBlock: false };
}

export type ScanContext = { spacingKeys: Set<string>; borderKeys: Set<string> };

export function scanSource(file: string, text: string, ctx: ScanContext): { violations: Violation[]; allowed: number } {
  const violations: Violation[] = [];
  let allowed = 0;
  const isTsx = file.endsWith(".tsx");
  const spacingRe = new RegExp(`(?<![\\w-])-?${SPACING_PREFIX}-(\\d+(?:\\.\\d+)?)(?![\\w./%-])`, "g");
  const borderRe = new RegExp(`(?<![\\w-])${BORDER_PREFIX}-(\\d+)(?![\\w./%-])`, "g");

  let inBlock = false;
  normalizeEol(text)
    .split("\n")
    .forEach((line, i) => {
      const state = classifyLine(line, inBlock);
      inBlock = state.inBlock;
      if (state.skip) return;
      if (ALLOW_MARKER.test(line)) {
        allowed += 1;
        return;
      }
      const report = (index: number, rule: string) =>
        violations.push({ file, line: i + 1, column: index + 1, rule });

      for (const rule of RULES) {
        if (rule.tsxOnly && !isTsx) continue;
        if (rule.cssOnly && !file.endsWith(".css")) continue;
        for (const m of line.matchAll(rule.pattern)) report(m.index, rule.name);
      }
      if (file.endsWith(".css")) return;
      for (const m of line.matchAll(spacingRe)) {
        if (!ctx.spacingKeys.has(m[1] ?? "")) report(m.index, `off-scale spacing "${m[0]}"`);
      }
      for (const m of line.matchAll(borderRe)) {
        if (!ctx.borderKeys.has(m[1] ?? "")) report(m.index, `off-scale border width "${m[0]}"`);
      }
    });
  return { violations, allowed };
}

export function checkFreshness(builtCss: string, onDisk: string | null): string | null {
  if (onDisk === null) return "styles/tokens.css is missing; run npm run tokens:build";
  return normalizeEol(onDisk) === normalizeEol(builtCss)
    ? null
    : "styles/tokens.css is stale or edited by hand; run npm run tokens:build";
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.has(extname(name))) out.push(full);
  }
}

export function checkProject(root: string): { problems: string[]; allowed: number } {
  const problems: string[] = [];
  const builtCss = buildTokensCss(readTokenExport(root));
  let onDisk: string | null = null;
  try {
    onDisk = readFileSync(resolve(root, "styles/tokens.css"), "utf8");
  } catch {
    onDisk = null;
  }
  const freshness = checkFreshness(builtCss, onDisk);
  if (freshness) problems.push(freshness);

  const ctx: ScanContext = { spacingKeys: allowedSpacingKeys(builtCss), borderKeys: allowedBorderKeys(builtCss) };
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(resolve(root, d), files);

  let allowed = 0;
  for (const full of files) {
    const rel = relative(root, full).split(sep).join("/");
    if (SKIP_FILES.has(rel)) continue;
    const result = scanSource(rel, readFileSync(full, "utf8"), ctx);
    allowed += result.allowed;
    for (const v of result.violations) problems.push(`${v.file}:${v.line}:${v.column} ${v.rule}`);
  }
  return { problems, allowed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { problems, allowed } = checkProject(root);
  if (allowed > 0) console.log(`tokens-allow: ${allowed} line(s) skipped; review them`);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`\ntokens:check failed with ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log("tokens:check passed");
}
