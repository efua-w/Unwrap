import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NetworkStatusProvider } from "@/components/layout/NetworkStatusProvider";
import { TimeZoneCookie } from "@/components/layout/TimeZoneCookie";
import { ToastProvider } from "@/components/ui/Toast";
import { bonaNova, plusJakartaSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Unwrap" };

// WHY: resizes-content makes the layout viewport shrink when the mobile keyboard opens, so a
// pinned action stays above the keyboard (plan §8).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bonaNova.variable} ${plusJakartaSans.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-full bg-surface-inverse px-16 py-12 text-text-inverse focus:not-sr-only focus:fixed focus:left-16 focus:top-16 focus:z-30 focus-ring-inverse"
        >
          Skip to content
        </a>
        <NetworkStatusProvider>
          <ToastProvider>
            {children}
            <TimeZoneCookie />
          </ToastProvider>
        </NetworkStatusProvider>
      </body>
    </html>
  );
}
