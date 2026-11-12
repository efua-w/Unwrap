"use client";

import { CalendarBlank, CaretLeft, CaretRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  addDays,
  addMonths,
  endOfWeek,
  formatMonthYear,
  formatYmdLongFull,
  isBeforeMin,
  isMonthBeforeMin,
  localTodayYmd,
  monthGrid,
  parseYmdParts,
  startOfWeek,
  weekdayHeaders,
} from "@/lib/dates/calendar";
import { formatYmdDayYear } from "@/lib/dates/format";
import { Button } from "./Button";
import { cx } from "./cx";
import { FIELD_CONTROL } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { usePicker } from "./usePicker";

type Props = {
  label: string;
  name: string;
  /** "YYYY-MM-DD", or "" when no day is chosen. */
  value: string;
  /** Called with "YYYY-MM-DD" when a day is chosen. */
  onChange: (ymd: string) => void;
  helper?: string;
  error?: string;
  /** "YYYY-MM-DD": earlier days cannot be picked. The form's own validation still guards the server. */
  min?: string;
};

const WEEKDAYS = weekdayHeaders();

const DAY_BASE =
  "flex h-touch-target w-full items-center justify-center rounded-lg text-body-base-regular focus-ring";

// The month grid (WAI-ARIA date picker dialog pattern). Mounted only while open, so its state starts
// fresh each time: the month of the value, else the current month.
function Calendar({
  value,
  min,
  onPick,
  activeDayRef,
}: {
  value: string;
  min?: string;
  onPick: (ymd: string) => void;
  /** Set in the sheet: the sheet focuses the active day on open, so this does not. Points at that day. */
  activeDayRef?: RefObject<HTMLButtonElement | null>;
}) {
  const monthId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  // WHY today is read here, not at render of the closed field: the viewer's own date, never the server's.
  const [today] = useState(() => localTodayYmd());
  const selected = parseYmdParts(value) ? value : null;
  // WHY min when the value is empty or too early: the first pickable day is where a person starts (APG).
  const [focusYmd, setFocusYmd] = useState(selected && !isBeforeMin(selected, min) ? selected : (min ?? today));
  // WHY: in the sheet the dialog is not shown until after this mounts; the Sheet moves the first focus.
  const moveFocus = useRef(!activeDayRef);
  const focus = parseYmdParts(focusYmd) ?? { year: 2000, month: 1, day: 1 };
  const weeks = monthGrid(focus.year, focus.month);
  const previous = parseYmdParts(addMonths(focusYmd, -1)) ?? focus;

  useEffect(() => {
    if (!moveFocus.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-ymd="${focusYmd}"]`)?.focus();
    moveFocus.current = false;
  }, [focusYmd]);

  function go(next: string) {
    moveFocus.current = true;
    setFocusYmd(next);
  }

  function onGridKey(e: KeyboardEvent) {
    const moves: Record<string, string> = {
      ArrowLeft: addDays(focusYmd, -1),
      ArrowRight: addDays(focusYmd, 1),
      ArrowUp: addDays(focusYmd, -7),
      ArrowDown: addDays(focusYmd, 7),
      PageUp: addMonths(focusYmd, -1),
      PageDown: addMonths(focusYmd, 1),
      Home: startOfWeek(focusYmd),
      End: endOfWeek(focusYmd),
    };
    const next = moves[e.key];
    if (!next) return; // Enter and Space activate the focused day button natively.
    e.preventDefault();
    go(next);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-8">
        <Button
          variant="icon"
          icon={CaretLeft}
          label="Previous month"
          disabled={isMonthBeforeMin(previous.year, previous.month, min)}
          onClick={() => {
            const target = addMonths(focusYmd, -1);
            const p = parseYmdParts(addMonths(target, -1));
            // WHY: the button disables itself here, which would drop focus to the page; move it to the grid.
            if (p && isMonthBeforeMin(p.year, p.month, min)) go(target);
            else setFocusYmd(target);
          }}
        />
        <div id={monthId} aria-live="polite" className="text-body-base-semibold text-text-default">
          {formatMonthYear(focus.year, focus.month)}
        </div>
        <Button variant="icon" icon={CaretRight} label="Next month" onClick={() => setFocusYmd(addMonths(focusYmd, 1))} />
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={monthId} onKeyDown={onGridKey} className="flex flex-col gap-4">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d.long}
              role="columnheader"
              aria-label={d.long}
              className="flex h-touch-target items-center justify-center text-body-sm-semibold text-text-secondary"
            >
              {d.short}
            </div>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7">
            {week.map((ymd, i) => {
              if (!ymd) return <div key={i} role="gridcell" />;
              const isSelected = ymd === selected;
              const isToday = ymd === today;
              // WHY aria-disabled, not disabled: keyboard focus may still move across past days (APG).
              const isPast = isBeforeMin(ymd, min);
              return (
                <div key={ymd} role="gridcell" aria-selected={isSelected}>
                  <button
                    type="button"
                    ref={ymd === focusYmd ? activeDayRef : undefined}
                    data-ymd={ymd}
                    tabIndex={ymd === focusYmd ? 0 : -1}
                    aria-label={formatYmdLongFull(ymd) ?? ymd}
                    aria-current={isToday ? "date" : undefined}
                    aria-disabled={isPast || undefined}
                    onClick={() => {
                      if (!isPast) onPick(ymd);
                    }}
                    className={cx(
                      DAY_BASE,
                      isSelected
                        ? "bg-surface-inverse text-text-inverse hover:bg-surface-inverse-hover"
                        : isPast
                          ? "cursor-not-allowed text-text-disabled"
                          : "text-text-default hover:bg-surface-secondary-hover",
                      isToday && "border-1-5 border-border-emphasis",
                    )}
                  >
                    {Number(ymd.slice(8))}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Date picker for Join by and Gift day (GCO-002, GCO-004). A button styled as the field opens a month
// grid: a dropdown from 768, the Sheet below it. The value stays "YYYY-MM-DD" so validation, the
// server action and the review do not change.
export function DateField({ label, name, value, onChange, helper, error, min }: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const { mode, triggerRef, wrapRef, openPicker, dismiss, close } = usePicker();
  const activeDayRef = useRef<HTMLButtonElement>(null);
  const open = mode !== "closed";
  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : helper ? helperId : undefined;
  const shown = formatYmdDayYear(value);

  function pick(ymd: string) {
    onChange(ymd);
    close();
  }

  return (
    <div className="flex flex-col gap-8">
      <label id={labelId} htmlFor={id} className="text-body-sm-semibold text-text-default">
        {label}
      </label>
      <div
        ref={wrapRef}
        className="relative min-w-0"
        onKeyDown={(e) => {
          if (mode === "dropdown" && e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
        // WHY: Tab out of the dropdown closes it. In the sheet, Tab stays inside the modal (the sheet is a native modal dialog, which keeps Tab inside it).
        onBlur={(e) => {
          if (mode === "dropdown" && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget as Node)) {
            dismiss();
          }
        }}
      >
        <button
          ref={triggerRef}
          id={id}
          name={name}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${id}`}
          aria-describedby={describedBy}
          onClick={() => (mode === "dropdown" ? close() : openPicker())}
          className={cx(
            FIELD_CONTROL,
            hasError ? "border-2 border-border-error" : "border-1 border-border-input",
            "flex h-48 items-center pr-48 text-left",
            !shown && "text-text-muted",
          )}
        >
          {shown ?? "Choose a date"}
        </button>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-16 flex items-center text-text-secondary">
          <Icon icon={CalendarBlank} size="md" />
        </span>
        {mode === "dropdown" ? (
          <div
            role="dialog"
            aria-label={label}
            className="absolute inset-x-0 top-full z-10 mt-4 rounded-lg border-1 border-border-default bg-surface-default p-12 shadow-overlay"
          >
            <Calendar value={value} min={min} onPick={pick} />
          </div>
        ) : null}
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
      <Sheet open={mode === "sheet"} onClose={close} variant="form" title={label} footer={null} initialFocusRef={activeDayRef}>
        {mode === "sheet" ? <Calendar value={value} min={min} onPick={pick} activeDayRef={activeDayRef} /> : null}
      </Sheet>
    </div>
  );
}
