import { Bona_Nova, Plus_Jakarta_Sans } from "next/font/google";

// WHY: variable names match the font stacks generated into styles/tokens.css
// (`--font-<kebab family>`). latin-ext carries the naira sign (₦).
export const bonaNova = Bona_Nova({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-bona-nova",
});

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});
