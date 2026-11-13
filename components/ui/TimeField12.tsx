"use client";

import { Check, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { from24Hm, TIME_OPTIONS, to24Hm, type Period } from "@/lib/dates/time12";
import { cx } from "./cx";
import { FIELD_CONTROL } from "./Field";
import { Icon } from "./Icon";
import { SegmentedTabs } from "./SegmentedTabs";
import { Sheet } from "./Sheet";
import { usePicker } from "./usePicker";

type Props = {
  label: string;
  name: string;
  /** 24-hour "HH:MM", or "" when no time is chosen. */
  value: string;
  /** Called with 24-hour "HH:MM" when a time is chosen or AM/PM changes. */
  onChange: (hm: string) => void;
  helper?: string;
  error?: string;
};

const PERIOD_OPTIONS: readonly { value: Period; label: string }[] = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

// WHY 30 minutes: owner decision 2026-11-11 (a native time input cannot be forced to 12-hour).
function Listbox({
  id,
  labelId,
  activeIndex,
  selectedIndex,
  onPick,
  onKeyDown,
  focusable,
  className,
  listRef,
}: {
  id: string;
  labelId: string;
  activeIndex: number;
  selectedIndex: number;
  onPick: (index: number) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLUListElement>) => void;
  /** In the sheet the list itself takes focus; in the dropdown the field keeps it. */
  focusable: boolean;
  className?: string;
  listRef?: RefObject<HTMLUListElement | null>;
}) {
  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-labelledby={labelId}
      tabIndex={focusable ? 0 : undefined}
      aria-activedescendant={focusable ? `${id}-${activeIndex}` : undefined}
      onKeyDown={onKeyDown}
      className={cx("m-0 flex list-none flex-col p-0 focus-visible:outline-none", className)}
    >
      {TIME_OPTIONS.map((option, i) => (
        <li
          key={option.label}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === selectedIndex}
          // WHY mousedown is stopped: the field keeps focus while the dropdown is open.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(i)}
          className={cx(
            "flex min-h-touch-target cursor-pointer items-center justify-between gap-8 px-16 text-text-default",
            i === activeIndex && "bg-surface-muted",
            i === selectedIndex ? "text-body-base-semibold" : "text-body-base-regular",
          )}
        >
          {option.label}
          {i === selectedIndex ? <Icon icon={Check} size="md" /> : null}
        </li>
      ))}
    </ul>
  );
}

// 12-hour time picker with an AM/PM switch (S27 Draw time). A select-only combobox: the field is a
// button that opens a listbox. The value stays 24-hour so validation, the server action and the
// summary do not change.
export function TimeField12({ label, name, value, onChange, helper, error }: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const parsed = from24Hm(value);
  const [period, setPeriod] = useState<Period>(parsed?.period ?? "AM");
  const { mode, triggerRef, wrapRef, openPicker, dismiss, close } = usePicker();
  const [activeIndex, setActiveIndex] = useState(0);
  const sheetListRef = useRef<HTMLUListElement>(null);
  const open = mode !== "closed";
  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : helper ? helperId : undefined;

  // The option shown as chosen: the stored time, when it falls in the half of the day the switch shows.
  const selectedIndex =
    parsed && parsed.period === period
      ? TIME_OPTIONS.findIndex((o) => o.hour === parsed.hour && o.minute === parsed.minute)
      : -1;

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  function openWithActive() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    openPicker();
  }

  function pick(index: number) {
    const option = TIME_OPTIONS[index];
    if (!option) return;
    onChange(to24Hm({ hour: option.hour, minute: option.minute, period }));
    close();
  }

  // WAI-ARIA select-only combobox keys, shared by the field (dropdown) and the list (sheet).
  function onListKey(e: KeyboardEvent) {
    const last = TIME_OPTIONS.length - 1;
    if (e.key === "ArrowDown") setActiveIndex((i) => Math.min(i + 1, last));
    else if (e.key === "ArrowUp") setActiveIndex((i) => Math.max(i - 1, 0));
    else if (e.key === "Home") setActiveIndex(0);
    else if (e.key === "End") setActiveIndex(last);
    else if (e.key === "Enter" || e.key === " ") pick(activeIndex);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
  }

  function onTriggerKey(e: KeyboardEvent) {
    // WHY Tab only here: in the sheet, Tab stays inside the native modal dialog, so it must not close it.
    if (mode === "dropdown" && e.key === "Tab") return dismiss();
    if (mode === "dropdown") return onListKey(e);
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      openWithActive();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <label id={labelId} htmlFor={id} className="text-body-sm-semibold text-text-default">
        {label}
      </label>
      <div className="flex items-center gap-8">
        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <button
            ref={triggerRef}
            id={id}
            name={name}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={mode === "dropdown"}
            aria-controls={mode === "dropdown" ? listId : undefined}
            aria-activedescendant={mode === "dropdown" ? `${listId}-${activeIndex}` : undefined}
            aria-labelledby={labelId}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            onClick={() => (mode === "dropdown" ? close() : openWithActive())}
            onKeyDown={onTriggerKey}
            // WHY: Space activates a button on key-up; keydown already handled it.
            onKeyUp={(e) => {
              if (e.key === " ") e.preventDefault();
            }}
            className={cx(
              FIELD_CONTROL,
              hasError ? "border-2 border-border-error" : "border-1 border-border-input",
              "flex h-48 items-center pr-48 text-left",
            )}
          >
            {parsed ? `${parsed.hour}:${String(parsed.minute).padStart(2, "0")}` : ""}
          </button>
          <span className="pointer-events-none absolute inset-y-0 right-16 flex items-center text-text-secondary">
            <Icon icon={Clock} size="md" />
          </span>
          {mode === "dropdown" ? (
            <Listbox
              id={listId}
              labelId={labelId}
              activeIndex={activeIndex}
              selectedIndex={selectedIndex}
              onPick={pick}
              focusable={false}
              className="absolute inset-x-0 top-full z-10 mt-4 max-h-toast-max overflow-y-auto rounded-lg border-1 border-border-default bg-surface-default shadow-overlay"
            />
          ) : null}
        </div>
        <SegmentedTabs
          kind="choice"
          compact
          legend="AM or PM"
          name={`${name}-period`}
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(p) => {
            setPeriod(p);
            if (parsed) onChange(to24Hm({ hour: parsed.hour, minute: parsed.minute, period: p }));
          }}
        />
      </div>
      {hasError ? (
        <p id={errorId} role="alert" className="flex items-start gap-8 text-body-sm-regular text-text-error">
          <Icon icon={WarningCircle} size="sm" weight="fill" className="mt-2" />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p id={helperId} className="text-body-sm-regular text-text-muted">
          {helper}
        </p>
      ) : null}
      <Sheet open={mode === "sheet"} onClose={close} variant="form" title={label} footer={null} initialFocusRef={sheetListRef}>
        {mode === "sheet" ? (
          <Listbox
            listRef={sheetListRef}
            id={listId}
            labelId={labelId}
            activeIndex={activeIndex}
            selectedIndex={selectedIndex}
            onPick={pick}
            onKeyDown={onListKey}
            focusable
          />
        ) : null}
      </Sheet>
    </div>
  );
}
