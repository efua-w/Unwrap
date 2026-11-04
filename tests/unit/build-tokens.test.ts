import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTokensCss, readTokenExport, sizingKey, type TokenExport } from "../../scripts/build-tokens.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

type Var = TokenExport["collections"]["Primitives"]["variables"]["numbers"][number];

function num(name: string, value: number): Var {
  return { name, token: name.replace(/\//g, "-"), type: "float", value, values: { m: value } };
}
function alias(name: string, target: string, value: number): Var {
  return {
    name,
    token: name.replace(/\//g, "-"),
    type: "float",
    value,
    values: { m: { type: "VARIABLE_ALIAS", collection: "Primitives", name: target } },
  };
}
function colour(name: string, value: string): Var {
  return { name, token: name.replace(/\//g, "-"), type: "color", value, values: { m: value } };
}
function colourAlias(name: string, target: string): Var {
  return {
    name,
    token: name.replace(/\//g, "-"),
    type: "color",
    value: "",
    values: { m: { type: "VARIABLE_ALIAS", collection: "Primitives", name: target } },
  };
}

function fixture(): TokenExport {
  const style = (name: string, family: string, size: string, weight: string, lh: number) => ({
    name,
    fontFamily: family,
    fontWeight: weight,
    fontSize: size,
    lineHeight: lh,
    letterSpacing: "0%",
  });
  return {
    styles: {
      textStyles: [
        style("body/text-base/semibold", "Plus Jakarta Sans", "16px", "600", 1.5),
        style("heading/mobile/heading 1", "Bona Nova", "30px", "400", 1.2999999523162842),
        style("heading/desktop/heading 1", "Bona Nova", "48px", "400", 1.2999999523162842),
      ],
      effectStyles: [
        {
          name: "elevation/overlay",
          effects: [{ type: "DROP_SHADOW", color: "#191a1c29", offset: { x: 0, y: 0 }, radius: 32, spread: 0, visible: true }],
        },
      ],
    },
    collections: {
      Primitives: {
        variables: {
          colors: [colour("colour/neutral/900", "#191a1c"), colour("colour/neutral/00", "#ffffff")],
          numbers: [
            num("sizing/0", 0),
            num("sizing/2", 2),
            num("sizing/5", 8),
            num("sizing/:25", 0.25),
            num("sizing/:5", 0.5),
            num("sizing/1:5", 1.5),
          ],
          strings: [],
        },
      },
      Tokens: {
        variables: {
          colors: [
            colourAlias("colour/text/default", "colour/neutral/900"),
            colourAlias("colour/border/focus", "colour/neutral/900"),
            colourAlias("colour/border/inverse", "colour/neutral/00"),
          ],
          numbers: [
            alias("spacing/8", "sizing/5", 8),
            alias("border-width/0-5", "sizing/:5", 0.5),
            alias("border-width/2", "sizing/2", 2),
            alias("border-radius/rounded-lg", "sizing/5", 8),
            num("border-radius/rounded-full", 99999),
            num("border-radius/rounded", 4),
            num("size/touch-target", 44),
            alias("focus/ring-width", "sizing/2", 2),
            alias("focus/ring-offset", "sizing/2", 2),
          ],
          strings: [],
        },
      },
      Typography: {
        variables: {
          colors: [],
          numbers: [num("fontSize/md", 16), num("fontWeight/bold", 700)],
          strings: [
            { name: "font/body", token: "font-body", type: "string", value: "Plus Jakarta Sans", values: { m: "Plus Jakarta Sans" } },
            { name: "font/heading", token: "font-heading", type: "string", value: "Bona Nova", values: { m: "Bona Nova" } },
          ],
        },
      },
    },
  };
}

describe("sizingKey", () => {
  it("renames the colliding export names", () => {
    expect(sizingKey("sizing/:25")).toBe("0-25");
    expect(sizingKey("sizing/:5")).toBe("0-5");
    expect(sizingKey("sizing/1:5")).toBe("1-5");
  });
  it("keeps plain keys, so sizing/5 stays 5", () => {
    expect(sizingKey("sizing/5")).toBe("5");
    expect(sizingKey("sizing/16")).toBe("16");
  });
});

describe("buildTokensCss (fixture)", () => {
  it("emits the renamed sizing variables without colliding with sizing-5", () => {
    const css = buildTokensCss(fixture());
    expect(css).toContain("--sizing-5: 0.5rem;");
    expect(css).toContain("--sizing-0-25: 0.015625rem;");
    expect(css).toContain("--sizing-0-5: 0.03125rem;");
    expect(css).toContain("--sizing-1-5: 0.09375rem;");
    expect(css.match(/--sizing-5:/g)).toHaveLength(1);
  });

  it("fails when two primitives produce the same output", () => {
    const data = fixture();
    data.collections.Primitives.variables.numbers.push(num("sizing/0-5", 9));
    expect(() => buildTokensCss(data)).toThrow(/duplicate sizing output/);
  });

  it("fails when an alias points at a missing primitive", () => {
    const data = fixture();
    data.collections.Tokens.variables.numbers.push(alias("spacing/99", "sizing/99", 99));
    expect(() => buildTokensCss(data)).toThrow(/missing primitive/);
    const data2 = fixture();
    data2.collections.Tokens.variables.colors.push(colourAlias("colour/text/x", "colour/neutral/12345"));
    expect(() => buildTokensCss(data2)).toThrow(/missing primitive/);
  });

  it("fails on a token number group it does not know", () => {
    const data = fixture();
    data.collections.Tokens.variables.numbers.push(num("mystery/x", 1));
    expect(() => buildTokensCss(data)).toThrow(/unknown token number group/);
  });

  it("aliases Tokens colours to their primitive and makes no utilities from primitives", () => {
    const css = buildTokensCss(fixture());
    expect(css).toContain("--color-text-default: var(--colour-neutral-900);");
    expect(css).toContain("--colour-neutral-900: #191a1c;");
    const start = css.indexOf("@theme inline");
    const theme = css.slice(start, css.indexOf("\n}", start));
    expect(theme).not.toContain("--color-neutral");
    expect(theme).not.toMatch(/^ {2}--colour-/m);
  });

  it("converts px to rem for spacing and keeps borders in px", () => {
    const css = buildTokensCss(fixture());
    expect(css).toContain("--spacing-touch-target: 2.75rem;");
    expect(css).toContain("--border-width-0-5: 0.5px;");
    expect(css).toContain("--border-width-2: 2px;");
    expect(css).toContain("@utility border-0-5 {");
    expect(css).not.toContain("@utility border-2 {");
  });

  it("strips the rounded prefix, keeps the bare radius and full as px", () => {
    const css = buildTokensCss(fixture());
    expect(css).toContain("--radius-lg: 0.5rem;");
    expect(css).toContain("--radius: 0.25rem;");
    expect(css).toContain("--radius-full: 99999px;");
  });

  it("rounds line heights to two decimals", () => {
    const css = buildTokensCss(fixture());
    expect(css).toContain("line-height: 1.3;");
    expect(css).not.toContain("1.2999");
  });

  it("makes one responsive heading utility with the 768 breakpoint", () => {
    const css = buildTokensCss(fixture());
    const block = css.slice(css.indexOf("@utility text-heading-1"));
    expect(block).toContain("font-size: 1.875rem;");
    expect(block).toContain("@media (width >= 48rem)");
    expect(block).toContain("font-size: 3rem;");
  });

  it("uses the inverse colour for the ink focus ring", () => {
    const css = buildTokensCss(fixture());
    expect(css).toContain("@utility focus-ring-inverse");
    expect(css).toMatch(/focus-ring-inverse[\s\S]*var\(--colour-neutral-00\)/);
  });

  it("is deterministic", () => {
    expect(buildTokensCss(fixture())).toBe(buildTokensCss(fixture()));
  });

  // WHY: without these resets Tailwind still emits `max-w-md`, `blur-sm` and friends (R1-5).
  it("resets every Tailwind default scale it should not leave behind", () => {
    const css = buildTokensCss(fixture());
    const theme = css.slice(css.indexOf("@theme {"), css.indexOf("@theme inline"));
    for (const reset of ["container", "blur", "text-shadow", "perspective", "color", "spacing", "radius", "shadow"]) {
      expect(theme).toContain(`--${reset}-*: initial;`);
    }
  });
});

describe("buildTokensCss (real export)", () => {
  const data = readTokenExport(root);
  const css = buildTokensCss(data);

  it("emits the three renamed sizes and keeps sizing-5 as 8px", () => {
    expect(css).toContain("--sizing-0-25:");
    expect(css).toContain("--sizing-0-5:");
    expect(css).toContain("--sizing-1-5:");
    expect(css).toContain("--sizing-5: 0.5rem;");
  });

  it("emits one theme colour per Tokens colour", () => {
    const count = data.collections.Tokens.variables.colors.length;
    const themed = css.match(/^ {2}--color-[\w-]+: var\(--colour-/gm) ?? [];
    expect(themed).toHaveLength(count);
  });

  it("emits 28 body text utilities and 5 responsive headings", () => {
    expect(css.match(/@utility text-body-/g)).toHaveLength(28);
    expect(css.match(/@utility text-heading-/g)).toHaveLength(5);
  });

  it("covers the size tokens and the elevation", () => {
    for (const key of ["touch-target", "avatar-sm", "control-lg", "row", "textarea-min", "toast-max", "dialog", "content-max", "sidebar-min", "sidebar-max", "icon-md"]) {
      expect(css).toContain(`--spacing-${key}:`);
    }
    expect(css).toContain("--shadow-overlay: 0 0 32px 0 #191a1c29;");
  });

  it("starts with the generated header", () => {
    expect(css.startsWith("/* GENERATED")).toBe(true);
  });
});
