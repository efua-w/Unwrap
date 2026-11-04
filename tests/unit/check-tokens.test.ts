import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkFreshness, checkProject, scanSource, type ScanContext } from "../../scripts/check-tokens.ts";

const ctx: ScanContext = {
  spacingKeys: new Set(["0", "1", "2", "4", "6", "8", "12", "16", "20", "24", "32", "40", "48"]),
  borderKeys: new Set(["0", "1", "2", "4", "8", "12", "16"]),
};

function rules(file: string, text: string): string[] {
  return scanSource(file, text, ctx).violations.map((v) => v.rule);
}

describe("scanSource: fails on", () => {
  it("hex colours, with file, line and column", () => {
    const { violations } = scanSource("a.tsx", 'const x = 1;\nconst c = "#b8532f";\n', ctx);
    expect(violations).toEqual([{ file: "a.tsx", line: 2, column: 12, rule: "hex colour" }]);
  });
  it("short and 8 digit hex", () => {
    expect(rules("a.css", "color: #fff;")).toContain("hex colour");
    expect(rules("a.css", "color: #191a1c66;")).toContain("hex colour");
  });
  it("colour functions", () => {
    for (const fn of ["rgb(0 0 0)", "rgba(0,0,0,.5)", "hsl(0 0% 0%)", "oklch(0.5 0 0)", "color-mix(in srgb, red, blue)"]) {
      expect(rules("a.css", `color: ${fn};`)).toContain("colour function");
    }
  });
  it("px values", () => {
    expect(rules("a.css", "padding: 16px;")).toContain("px value");
    expect(rules("a.tsx", 'const w = "0.5px";')).toContain("px value");
  });
  it("arbitrary values and properties", () => {
    expect(rules("a.tsx", '<div className="w-[37px]" />')).toContain("arbitrary value");
    expect(rules("a.tsx", '<div className="rounded-[3px]" />')).toContain("arbitrary value");
    expect(rules("a.tsx", '<div className="[mask-type:alpha]" />')).toContain("arbitrary property");
    expect(rules("a.tsx", '<div className="w-(--my-width)" />')).toContain("arbitrary variable");
  });
  it("negative px values (R1-4)", () => {
    expect(rules("a.css", "margin: -4px;")).toContain("px value");
    expect(rules("a.tsx", 'const x = "-0.5px";')).toContain("px value");
  });
  it("rem and em in CSS, not in TSX (R1-4)", () => {
    expect(rules("a.css", "padding: 1rem;")).toContain("rem/em value");
    expect(rules("a.css", "margin: -0.5em;")).toContain("rem/em value");
    expect(rules("a.tsx", 'const s = "item";')).not.toContain("rem/em value");
  });
  it("lines that start with * outside a comment block (R1-4, T2-1)", () => {
    expect(rules("a.css", "* { color: #f00 }")).toContain("hex colour");
    expect(rules("a.css", "*{ color:#f00 }")).toContain("hex colour");
    expect(rules("a.css", "*, ::after { margin: 2em }")).toContain("rem/em value");
    expect(rules("a.css", "/* c\n * x\n*/\n* { color: #f00 }")).toEqual(["hex colour"]);
  });
  it("off-scale offsets, decoration, inset ring and stroke widths (R1-4)", () => {
    for (const cls of ["outline-offset-3", "underline-offset-3", "decoration-3", "inset-ring-3", "stroke-3", "ring-offset-3"]) {
      expect(rules("a.tsx", `<div className="${cls}" />`)[0], cls).toMatch(/off-scale border/);
    }
    expect(rules("a.tsx", '<div className="decoration-dotted underline-offset-2" />')).toEqual([]);
  });
  it("typed arbitrary variables like bg-(color:--x) (R1-4)", () => {
    expect(rules("a.tsx", '<div className="bg-(color:--x)" />')).toContain("arbitrary variable");
  });
  it("inline styles in TSX only", () => {
    expect(rules("a.tsx", "<div style={{ top: 0 }} />")).toContain("inline style");
    expect(rules("a.ts", "const style={}")).not.toContain("inline style");
  });
  it("off-scale spacing keys", () => {
    expect(rules("a.tsx", '<div className="p-5" />')[0]).toMatch(/off-scale spacing/);
    expect(rules("a.tsx", '<div className="-mt-7 gap-3" />')).toHaveLength(2);
    expect(rules("a.tsx", '<div className="size-37" />')).toHaveLength(1);
  });
  it("off-scale border widths", () => {
    expect(rules("a.tsx", '<div className="border-3" />')[0]).toMatch(/off-scale border/);
    expect(rules("a.tsx", '<div className="border-t-6" />')).toHaveLength(1);
  });
  it("breakpoints other than md", () => {
    expect(rules("a.tsx", '<div className="lg:flex" />')).toContain("breakpoint other than md");
    expect(rules("a.tsx", '<div className="max-sm:hidden" />')).toContain("breakpoint other than md");
  });
  it("numeric icon sizes", () => {
    expect(rules("a.tsx", "<House size={24} />")).toContain("numeric icon size");
    expect(rules("a.tsx", '<House size="md" />')).not.toContain("numeric icon size");
  });
});

describe("scanSource: passes on", () => {
  it('anchors like href="#main" and href="#add"', () => {
    expect(rules("a.tsx", '<a href="#main">Skip</a>')).toEqual([]);
    expect(rules("a.tsx", '<a href="#add">Add</a>')).toEqual([]);
  });
  it("token utilities, fractions, percentages and viewport units", () => {
    const line =
      '<div className="p-16 md:px-32 max-md:hidden gap-8 w-1/5 max-h-9/10 min-h-dvh h-dvh w-full border-1 border-2 border-1-5 size-touch-target -ml-6" />';
    expect(rules("a.tsx", line)).toEqual([]);
    expect(rules("a.css", "max-height: 90%; width: 100vw; height: 100dvh; min-height: 50svh;")).toEqual([]);
  });
  it("comment lines", () => {
    expect(rules("a.ts", "// 16px per the design, #fff")).toEqual([]);
    expect(rules("a.ts", "/*\n * 44px touch target\n */")).toEqual([]);
  });
  it("multi-line JSDoc and CSS comment blocks (T2-1)", () => {
    expect(rules("a.ts", "/**\n * Uses #fff and 13px.\n *\n * 44px target\n */\nconst a = 1;")).toEqual([]);
    expect(rules("a.css", "/* header\n   colour #fff, 13px, 2em\n*/\na { margin: 0 }")).toEqual([]);
  });
  it("a same-line tokens-allow comment, and counts it", () => {
    const result = scanSource("a.tsx", 'const c = "#fff"; // tokens-allow: brand asset', ctx);
    expect(result.violations).toEqual([]);
    expect(result.allowed).toBe(1);
  });
  it("does not accept tokens-allow without a reason", () => {
    expect(rules("a.tsx", 'const c = "#fff"; // tokens-allow:')).toContain("hex colour");
  });
  it("Windows line endings", () => {
    expect(rules("a.tsx", 'const c = "#fff";\r\nconst d = 1;\r\n')).toEqual(["hex colour"]);
  });
});

describe("freshness", () => {
  it("passes when equal, ignoring line endings", () => {
    expect(checkFreshness("a\nb\n", "a\r\nb\r\n")).toBeNull();
  });
  it("fails when edited or missing", () => {
    expect(checkFreshness("a\nb\n", "a\nc\n")).toMatch(/stale/);
    expect(checkFreshness("a", null)).toMatch(/missing/);
  });
});

describe("the project itself", () => {
  it("passes the check", () => {
    const root = fileURLToPath(new URL("../..", import.meta.url));
    expect(checkProject(root).problems).toEqual([]);
  });
});
