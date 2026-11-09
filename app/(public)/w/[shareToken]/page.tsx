import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedWishlistView } from "@/features/shared-wishlist/components/SharedWishlistView";
import { SHARED_COPY } from "@/features/shared-wishlist/copy";
import { getSharedWishlist } from "@/features/shared-wishlist/queries";

// GC-023 / S25 Shared wishlist (viewer). Public: no account, outside AppShell.
// WHY force-dynamic: the answer depends on the list's current visibility, so it must never be
// built once and cached (a list made Private must stop answering at once).
export const dynamic = "force-dynamic";

// WHY no loading.tsx (S25 has a loading board): a loading boundary lets the page start streaming
// before the list is read, and by then the HTTP status is already 200. An unavailable list must
// answer 404 (GC-023: one answer for every case), so the page reads first and responds after.
// Logged as an open item; the skeleton can return if the owner prefers it over the 404 status.

// WHY generic title and preview card, and robots off (GC-023 "Hidden from search engines", owner
// 2026-11-08): nothing about the list or its owner appears in a search result or a link preview.
// next.config.ts adds the same noindex and no-referrer as response headers.
export const metadata: Metadata = {
  title: SHARED_COPY.pageTitle,
  openGraph: { title: SHARED_COPY.pageTitle, type: "website" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedWishlistPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const wishlist = await getSharedWishlist(shareToken);
  // WHY notFound for every case: private, deleted, unknown and malformed links all give the same
  // page and the same 404 (GC-023: never say which).
  if (!wishlist) notFound();
  return <SharedWishlistView wishlist={wishlist} />;
}
