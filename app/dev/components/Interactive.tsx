"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { OtpInput } from "@/components/ui/OtpInput";
import { Sheet, type SheetVariant } from "@/components/ui/Sheet";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";

export function SheetDemo() {
  const [open, setOpen] = useState<SheetVariant | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const close = () => setOpen(null);
  return (
    <div className="flex flex-wrap gap-12">
      <Button variant="secondary" onClick={() => setOpen("confirm")}>
        Confirm sheet
      </Button>
      <Button variant="secondary" onClick={() => setOpen("destructive")}>
        Destructive sheet
      </Button>
      <Button variant="secondary" onClick={() => setOpen("form")}>
        Form sheet
      </Button>
      <Sheet
        open={open !== null}
        onClose={close}
        variant={open ?? "confirm"}
        title={open === "destructive" ? "Delete this item?" : open === "form" ? "Name this item" : "Are you sure?"}
        description={open === "form" ? undefined : "Demo copy for the gallery only."}
        busy={busy}
        footer={
          <>
            <Button
              variant={open === "destructive" ? "destructive" : "primary"}
              busy={busy}
              onClick={() => {
                setBusy(true);
                setTimeout(() => {
                  setBusy(false);
                  close();
                }, 1500);
              }}
            >
              Confirm
            </Button>
            <Button variant="text" onClick={close} disabled={busy}>
              Cancel
            </Button>
          </>
        }
      >
        {open === "form" ? <Field label="Name" name="name" maxLength={40} helper="Shown on the demo only." /> : null}
        {open === "destructive" ? (
          // Gallery fixture for open item 12: a toast raised while the sheet is open is held until it closes.
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                message: "Item deleted.",
                action: { label: "Undo", onAction: () => toast.show({ message: "Restored." }) },
              })
            }
          >
            Show toast from sheet
          </Button>
        ) : null}
      </Sheet>
    </div>
  );
}

export function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-12">
      <Button variant="secondary" onClick={() => toast.show({ message: "Saved." })}>
        Show toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({
            message: "Item deleted.",
            action: { label: "Undo", onAction: () => toast.show({ message: "Restored." }) },
          })
        }
      >
        Show toast with action
      </Button>
    </div>
  );
}

export function OfflineDemo() {
  const { online, reportNetworkError, reportNetworkSuccess } = useNetworkStatus();
  return (
    <div className="flex flex-wrap items-center gap-12">
      <Button variant="secondary" onClick={reportNetworkError}>
        reportNetworkError()
      </Button>
      <Button variant="secondary" onClick={reportNetworkSuccess}>
        reportNetworkSuccess()
      </Button>
      <span className="text-body-sm-regular">{online ? "Online" : "Offline"}</span>
    </div>
  );
}

export function BusyDemo() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="brand"
      busy={busy}
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 2000);
      }}
    >
      Draw names
    </Button>
  );
}

// Gallery fixture for AC-12: a one-field form, where Enter submits through the default button.
export function FormBusyDemo() {
  const [submits, setSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex max-w-dialog flex-col items-start gap-12"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmits((n) => n + 1);
        setBusy(true);
        setTimeout(() => setBusy(false), 1500);
      }}
    >
      <Field label="One field form" name="one" />
      <Button type="submit" busy={busy}>
        Save form
      </Button>
      <p className="text-body-sm-regular">Submitted {submits}</p>
    </form>
  );
}

export function SkeletonDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-12">
      <Button variant="secondary" onClick={() => setRun((n) => n + 1)}>
        Restart loading (slow line at 8s)
      </Button>
      <SkeletonRegion key={run}>
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </SkeletonRegion>
    </div>
  );
}

// OtpInput gallery: one live field that reports each completion, plus the fixed states.
export function OtpDemo() {
  const [value, setValue] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  return (
    <div className="flex max-w-dialog flex-col gap-24">
      <div className="flex flex-col gap-8">
        <OtpInput
          label="6-digit code"
          name="live"
          value={value}
          onChange={setValue}
          onComplete={(code) => setCompleted((list) => [...list, code])}
          helper="It checks automatically once all 6 digits are in."
        />
        <p className="text-body-sm-regular" data-testid="otp-completed">
          Completed {completed.length}
          {completed.length > 0 ? `: ${completed[completed.length - 1]}` : ""}
        </p>
      </div>
      <OtpInput label="Checking" name="checking" value="482915" onChange={() => {}} onComplete={() => {}} checking />
      <OtpInput
        label="Wrong"
        name="wrong"
        value=""
        onChange={() => {}}
        onComplete={() => {}}
        error="That code didn't work. Check the latest email, or send a new code."
      />
      <OtpInput
        label="Disabled"
        name="disabled"
        value="48"
        onChange={() => {}}
        onComplete={() => {}}
        disabled
        helper="Too many tries. Send a new code to keep going."
      />
    </div>
  );
}
