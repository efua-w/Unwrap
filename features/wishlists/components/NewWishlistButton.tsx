"use client";

import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { useOnline } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import type { WishlistVisibility } from "../types";
import { WishlistSheet } from "./WishlistSheet";

// GC-018 "New wishlist (+ icon)" and the New wishlist sheet (GC-019). Disabled offline, as on the
// board Wishlist-List-offline (GC-029: no offline writes).
export function NewWishlistButton({ defaultVisibility }: { defaultVisibility: WishlistVisibility }) {
  const online = useOnline();
  const [session, setSession] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        icon={Plus}
        fullWidth
        className="md:w-auto"
        disabled={!online}
        aria-haspopup="dialog"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        New wishlist
      </Button>
      <WishlistSheet key={session} open={open} onClose={() => setOpen(false)} defaultVisibility={defaultVisibility} />
    </>
  );
}
