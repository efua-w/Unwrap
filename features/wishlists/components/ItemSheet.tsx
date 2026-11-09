"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MoneyField } from "@/components/ui/MoneyField";
import { RadioGroup, type RadioOption } from "@/components/ui/RadioGroup";
import { Sheet } from "@/components/ui/Sheet";
import { nairaInputFromKobo } from "@/lib/money/naira";
import {
  ITEM_NAME_MAX,
  ITEM_NOTE_MAX,
  validateItemInput,
  type ItemErrors,
  type ItemPriority,
} from "@/lib/validation/wishlist";
import { addWishlistItem, updateWishlistItem } from "../actions";
import { PRIORITY_LABEL, WISHLIST_COPY } from "../copy";
import type { OwnerWishlistItem } from "../types";

// GC-021 / S22 Add an item and Edit item, manual entry (never-do 9). Boards: Wishlist-Detail-
// itemempty, -itemerror, -itemsaving, -itemedit. Copy read from the canvas (UwSheet) and the owner's
// answers of 2026-11-05. Not in slice 2: link import (the Link field has no helper), "Add a photo"
// (slice 17), and the sheet has no remove button (GC-021).
const COPY = {
  addTitle: "Add an item",
  editTitle: "Edit item",
  linkLabel: "Link (optional)",
  linkPlaceholder: "Paste a link from any shop",
  linkInvalid: "Check the link. It should start with https://",
  nameLabel: "What is it?",
  namePlaceholder: "For example, a scented candle",
  nameMissing: "Add a name so your giver knows what it is.",
  priceLabel: "Price",
  priceHelper: "Whole naira only, like 8500.",
  priceNotWhole: "Use whole naira, with no kobo. For example, 8500.",
  priceTooLarge: "That's over ₦1,000,000,000. Enter a smaller amount.",
  priorityLegend: "How much do you want it?",
  noteLabel: "Note for your giver",
  notePlaceholder: "Size, colour, anything that helps",
  add: "Add to list",
  save: "Save",
  cancel: "Cancel",
};

const PRIORITY_OPTIONS: readonly RadioOption<ItemPriority>[] = [
  { value: "most_wanted", label: PRIORITY_LABEL.most_wanted },
  { value: "nice_to_have", label: PRIORITY_LABEL.nice_to_have },
];

// Form field order, for moving focus to the first field with an error.
const FIELD_ORDER = ["link", "name", "price"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  wishlistId: string;
  /** Absent when adding. */
  item?: OwnerWishlistItem;
  onSaved: (name: string, mode: "added" | "saved") => void;
};

// WHY the parent remounts this (a new `key`) for each opening: "Add another" starts empty, and
// editing starts from the saved item.
export function ItemSheet({ open, onClose, wishlistId, item, onSaved }: Props) {
  const router = useRouter();
  const formId = useId();
  const { online, reportNetworkError } = useNetworkStatus();
  const [values, setValues] = useState({
    link: item?.link ?? "",
    name: item?.name ?? "",
    price: nairaInputFromKobo(item?.priceKobo ?? null),
    note: item?.note ?? "",
  });
  // WHY Nice to have: owner 2026-11-05 (Q7) preselects it, overriding the board.
  const [priority, setPriority] = useState<ItemPriority>(item?.priority ?? "nice_to_have");
  const [errors, setErrors] = useState<ItemErrors>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const editing = item !== undefined;

  function set(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (field === "link" || field === "name" || field === "price") setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function focusFirstError(form: HTMLFormElement, found: ItemErrors) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) (form.elements.namedItem(first) as HTMLInputElement | null)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (busy || !online) return;
    setFailed(false);
    const input = { ...values, priority };
    const parsed = validateItemInput(input);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      focusFirstError(form, parsed.errors);
      return;
    }
    setBusy(true);
    try {
      const result = editing ? await updateWishlistItem(item.id, input) : await addWishlistItem(wishlistId, input);
      if (result.ok) {
        onSaved(parsed.value.name, editing ? "saved" : "added");
        return;
      }
      setBusy(false);
      if (result.reason === "invalid") {
        setErrors(result.errors);
        focusFirstError(form, result.errors);
        return;
      }
      if (result.reason === "signed-out") {
        return router.replace(`/login?next=${encodeURIComponent(`/wishlists/${wishlistId}`)}`);
      }
      setFailed(true);
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="form"
      title={editing ? COPY.editTitle : COPY.addTitle}
      busy={busy}
      footer={
        <>
          <Button type="submit" form={formId} fullWidth busy={busy} disabled={!online}>
            {editing ? COPY.save : COPY.add}
          </Button>
          <Button variant="text" fullWidth onClick={onClose} disabled={busy}>
            {COPY.cancel}
          </Button>
        </>
      }
    >
      <form id={formId} method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-24">
        <Field
          label={COPY.linkLabel}
          name="link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={COPY.linkPlaceholder}
          error={errors.link ? COPY.linkInvalid : undefined}
          value={values.link}
          onChange={(event) => set("link", event.target.value)}
        />
        <Field
          label={COPY.nameLabel}
          name="name"
          autoComplete="off"
          placeholder={COPY.namePlaceholder}
          error={errors.name ? COPY.nameMissing : undefined}
          maxLength={ITEM_NAME_MAX}
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
        />
        <MoneyField
          label={COPY.priceLabel}
          name="price"
          placeholder="0"
          helper={COPY.priceHelper}
          error={
            errors.price === "too-large" ? COPY.priceTooLarge : errors.price ? COPY.priceNotWhole : undefined
          }
          value={values.price}
          onChange={(event) => set("price", event.target.value)}
        />
        <RadioGroup
          legend={COPY.priorityLegend}
          name="priority"
          variant="segmented"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={setPriority}
        />
        <Field
          label={COPY.noteLabel}
          name="note"
          multiline
          placeholder={COPY.notePlaceholder}
          maxLength={ITEM_NOTE_MAX}
          value={values.note}
          onChange={(event) => set("note", event.target.value)}
        />
        {failed ? <Alert variant="error">{WISHLIST_COPY.failed}</Alert> : null}
      </form>
    </Sheet>
  );
}
