import type { NextConfig } from "next";

// WHY: the component galleries (`*.dev.tsx`) must never ship; the extension is only a page in
// dev, so `next build` has no /dev routes (slice 0a, Q6).
const isProd = process.env.NODE_ENV === "production";

// WHY: `next dev` blocks its JavaScript and hot-reload resources for any host other than
// localhost, so a phone opening the LAN address gets a page that never hydrates (forms then fall
// back to a plain submit). The LAN host is machine-specific, so it lives in .env.local
// (ALLOWED_DEV_ORIGINS, comma-separated), never in this file (CLAUDE.md "While coding" 6).
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  pageExtensions: isProd ? ["tsx", "ts"] : ["tsx", "ts", "dev.tsx"],
  // Pins the workspace root so a stray lockfile higher up the disk is not picked up.
  turbopack: { root: import.meta.dirname },
  allowedDevOrigins,
};

export default nextConfig;
