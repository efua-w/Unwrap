// The three widths every spec runs at. 390 and 1440 are the board widths; 768 is judged against the
// mobile design (CLAUDE.md DoD). Shared by playwright.config.ts (one project per width) and the
// signed-in spec, which runs all three inside its own single-worker project.
export const VIEWPORTS = [
  { name: "mobile-390", viewport: { width: 390, height: 844 } },
  { name: "tablet-768", viewport: { width: 768, height: 1024 } },
  { name: "desktop-1440", viewport: { width: 1440, height: 900 } },
] as const;
