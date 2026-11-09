"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Sheet } from "@/components/ui/Sheet";
import { validateWishlistInput, WISHLIST_NAME_MAX } from "@/lib/validation/wishlist";
import { createWishlist, updateWishlist } from "../actions";
import { VISIBILITY_OPTIONS, WISHLIST_COPY } from "../copy";
import type { OwnerWishlist, WishlistVisibility } from "../types";

// GC-019 / S20 New wishlist and Edit list. Boards: Wishlist-List-new, -newerror, -newsaving and
// Wishlist-Detail-edit. Copy read from the canvas (UwSheet), docs/tasks/slice-2.md.
const COPY = {
  newTitle: "New wishlist",
  editTitle: "Edit list",
  nameLabel: "List name",
  namePlaceholder: "For example, Birthday or New flat",
  nameHelper: "People see this when you share it.",
  nameMissing: "Give your list a name so people know what it's for.",
  visibilityLegend: "Who can see it",
  create: "Create list",
  save: "Save",
  cancel: "Cancel",
  deleteList: "Delete this list…",
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Absent for a new list. */
  list?: OwnerWishlist;
  /** New list only: what the person chose as their default in Privacy (GC-027). */
  defaultVisibility?: WishlistVisibility;
  /** Edit only: "Delete this list…" (GC-019, GC-030). */
  onDelete?: () => void;
  /** Edit only: after a successful save. */
  onSaved?: () => void;
};

// WHY the parent remounts this (a new `key`) for each opening: every opening starts from the saved
// values, never from a half-typed earlier attempt.
export function WishlistSheet({ open, onClose, list, defaultVisibility = "private", onDelete, onSaved }: Props) {
  const router = useRouter();
  const formId = useId();
  const { online, reportNetworkError } = useNetworkStatus();
  const [name, setName] = useState(list?.name ?? "");
  // WHY: a new list starts from the person's default (GC-027, Private until they change it); an
  // existing list always shows its own value.
  const [visibility, setVisibility] = useState<WishlistVisibility>(list?.visibility ?? defaultVisibility);
  const [nameError, setNameError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const editing = list !== undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (busy || !online) return;
    setFailed(false);
    const input = { name, visibility };
    const parsed = validateWishlistInput(input);
    if (!parsed.ok) {
      setNameError(true);
      (form.elements.namedItem("name") as HTMLInputElement | null)?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = editing ? await updateWishlist(list.id, input) : await createWishlist(input);
      if (result.ok) {
        // GC-019: on create, go to the new list to add the first item. WHY busy stays on: the sheet
        // is about to go away, and a second tap must not create a second list.
        if ("id" in result) router.push(`/wishlists/${result.id}`);
        else onSaved?.();
        return;
      }
      setBusy(false);
      if (result.reason === "invalid") return setNameError(true);
      if (result.reason === "signed-out") {
        return router.replace(`/login?next=${encodeURIComponent(editing ? `/wishlists/${list.id}` : "/wishlists")}`);
      }
      setFailed(true);
    } catch {
      // A Server Action that cannot reach the server throws (GC-029: no offline writes).
      setBusy(false);
      reportNetworkError();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="form"
      title={editing ? COPY.editTitle : COPY.newTitle}
      busy={busy}
      footer={
        <>
          <Button type="submit" form={formId} fullWidth busy={busy} disabled={!online}>
            {editing ? COPY.save : COPY.create}
          </Button>
          <Button variant="text" fullWidth onClick={onClose} disabled={busy}>
            {COPY.cancel}
          </Button>
          {editing && onDelete ? (
            <Button variant="destructive-text" fullWidth onClick={onDelete} disabled={busy || !online} aria-haspopup="dialog">
              {COPY.deleteList}
            </Button>
          ) : null}
        </>
      }
    >
      <form id={formId} method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-24">
        <Field
          label={COPY.nameLabel}
          name="name"
          placeholder={COPY.namePlaceholder}
          helper={COPY.nameHelper}
          error={nameError ? COPY.nameMissing : undefined}
          maxLength={WISHLIST_NAME_MAX}
          autoComplete="off"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(false);
          }}
        />
        <RadioGroup
          legend={COPY.visibilityLegend}
          name="visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={setVisibility}
        />
        {failed ? <Alert variant="error">{WISHLIST_COPY.failed}</Alert> : null}
      </form>
    </Sheet>
  );
}
