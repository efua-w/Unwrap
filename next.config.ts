import type { NextConfig } from "next";

// WHY: the component galleries (`*.dev.tsx`) must never ship; the extension is only a page in
// dev, so `next build` has no /dev routes (slice 0a, Q6).
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  pageExtensions: isProd ? ["tsx", "ts"] : ["tsx", "ts", "dev.tsx"],
  // Pins the workspace root so a stray lockfile higher up the disk is not picked up.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
