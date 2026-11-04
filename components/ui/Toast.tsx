"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPausableTimer, type PausableTimer } from "./pausable-timer";
import { TOP_LAYER_EVENT } from "./top-layer";

export const TOAST_MS = 4000;
export const TOAST_WITH_ACTION_MS = 8000;

export type ToastOptions = {
  message: string;
  action?: { label: string; onAction: () => void };
};

type ToastState = ToastOptions & { id: number };
type ToastApi = { show: (options: ToastOptions) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// One toast at a time: a new one replaces the current one. The live region is always mounted so
// screen readers announce text inserted into it (board 09).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<PausableTimer | null>(null);
  const nextId = useRef(0);
  const regionRef = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // WHY: hover and keyboard focus are separate reasons to hold the toast; leaving one must not
  // restart the timer while the other still applies (R1-9).
  const syncTimer = useCallback(() => {
    if (hovered.current || focused.current) timer.current?.pause();
    else timer.current?.resume();
  }, []);

  // WHY: removing or replacing the focused toast would drop focus to <body>; send it back to
  // where it was (R1-9, R2-4).
  const restoreFocus = useCallback(() => {
    const active = document.activeElement;
    if (active && regionRef.current?.contains(active)) {
      const back = returnFocusTo.current;
      if (back?.isConnected) back.focus();
      else document.getElementById("main")?.focus();
    }
    returnFocusTo.current = null;
  }, []);

  const dismiss = useCallback(() => {
    timer.current?.cancel();
    timer.current = null;
    hovered.current = false;
    focused.current = false;
    restoreFocus();
    setToast(null);
  }, [restoreFocus]);

  const show = useCallback(
    (options: ToastOptions) => {
      timer.current?.cancel();
      hovered.current = false;
      focused.current = false;
      restoreFocus();
      nextId.current += 1;
      setToast({ ...options, id: nextId.current });
      timer.current = createPausableTimer(dismiss, options.action ? TOAST_WITH_ACTION_MS : TOAST_MS);
    },
    [dismiss, restoreFocus],
  );

  useEffect(() => () => timer.current?.cancel(), []);

  // WHY: a manual popover lives in the top layer, so the toast can sit above an open modal Sheet
  // (R1-9). A later top-layer element covers an earlier one, so the region re-shows whenever a
  // Sheet opens. It stays shown while empty so the live region keeps announcing. Browsers without
  // the popover API ignore the attribute and fall back to the z-index.
  useEffect(() => {
    const el = regionRef.current;
    if (!el || typeof el.showPopover !== "function") return;
    const show = () => {
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    };
    show();
    window.addEventListener(TOP_LAYER_EVENT, show);
    return () => {
      window.removeEventListener(TOP_LAYER_EVENT, show);
      if (el.matches(":popover-open")) el.hidePopover();
    };
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        ref={regionRef}
        popover="manual"
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-16 bottom-80 top-auto z-20 m-0 flex h-auto w-auto justify-center overflow-visible border-0 bg-transparent p-0 text-inherit md:inset-x-auto md:right-24 md:bottom-24 md:w-toast-max"
      >
        {toast ? (
          <div
            key={toast.id}
            onMouseEnter={() => {
              hovered.current = true;
              syncTimer();
            }}
            onMouseLeave={() => {
              hovered.current = false;
              syncTimer();
            }}
            onFocus={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                returnFocusTo.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
              }
              focused.current = true;
              syncTimer();
            }}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget)) return;
              focused.current = false;
              syncTimer();
            }}
            className="pointer-events-auto flex w-full max-w-toast-max items-center gap-16 rounded-2xl bg-surface-inverse py-8 pl-16 pr-8 text-text-inverse"
          >
            <p className="min-w-0 flex-1 py-4 text-body-sm-medium">{toast.message}</p>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  // WHY: dismiss first. An action that shows its own toast (Undo then "Restored.")
                  // would otherwise have that new toast dismissed straight away.
                  const onAction = toast.action?.onAction;
                  dismiss();
                  onAction?.();
                }}
                className="min-h-touch-target shrink-0 rounded-full px-12 text-body-sm-semibold text-text-brand-inverse focus-ring-inverse"
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
