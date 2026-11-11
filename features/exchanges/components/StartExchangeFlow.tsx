"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { RadioGroup, type RadioOption } from "@/components/ui/RadioGroup";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Sheet } from "@/components/ui/Sheet";
import { TimeField12 } from "@/components/ui/TimeField12";
import { formatHm, formatYmdDay, wallClockIn, zoneShortName } from "@/lib/dates/format";
import { BUDGET_PRESETS, budgetLabel, isBudgetPreset, type BudgetPreset } from "@/lib/money/budget";
import {
  EXCHANGE_NAME_MAX,
  EXCHANGE_NOTE_MAX,
  validateBasics,
  validateBudgetAndDates,
  type DrawMode,
  type ExchangeErrors,
  type FieldKey,
} from "@/lib/validation/exchange";
import { createExchange } from "../actions";
import { DRAW_MODE_OPTIONS, EXCHANGE_COPY, TAKING_PART_OPTIONS, WHO_CAN_JOIN_OPTIONS, errorLine } from "../copy";
import { runSummary } from "../summary";

type Step = 1 | 2 | 3;

type FormState = {
  name: string;
  note: string;
  budget: BudgetPreset | "";
  joinByDate: string;
  giftDay: string;
  drawMode: DrawMode;
  drawTime: string;
  takingPart: "yes" | "no";
  joinRule: "anyone" | "approve";
};

// GCO-001..003 defaults (owner decision 2026-11-09, item 6): taking part, anyone with the link, a
// 6:00 pm draw, names drawn when joining closes.
const INITIAL: FormState = {
  name: "",
  note: "",
  budget: "",
  joinByDate: "",
  giftDay: "",
  drawMode: "at_join_by",
  drawTime: "18:00",
  takingPart: "yes",
  joinRule: "anyone",
};

const BUDGET_OPTIONS: readonly RadioOption<BudgetPreset>[] = BUDGET_PRESETS.map((value) => ({
  value,
  label: budgetLabel(value),
}));

// WHY the date rules clear together: moving any one date can fix or break the others.
const DATE_FIELDS: readonly FieldKey[] = ["joinBy", "giftDay", "drawTime"];

// Fields in the order they appear, so the first error is the one that takes focus.
const FOCUS_ORDER: readonly FieldKey[] = ["name", "note", "budget", "joinBy", "giftDay", "drawTime"];
const INPUT_NAME: Record<FieldKey, string> = {
  name: "name",
  note: "note",
  budget: "budget",
  joinBy: "joinByDate",
  giftDay: "giftDay",
  drawTime: "drawTime",
};

// S26 Org-Basics-*, S27 Org-Budget-*, S28 Org-Review-* (GCO-001, GCO-002, GCO-003). Three steps in
// one form; nothing is written until Start exchange (the Review says so). Dates and times are
// wall-clock values in the organiser's browser zone; the database turns them into instants.
export function StartExchangeFlow() {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<ExchangeErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const firstRender = useRef(true);
  // WHY from the browser (owner decision, planner round 2): the organiser's own zone fixes what
  // "6:00 pm" and "the end of the join-by day" mean. Only read once the person is interacting.
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // WHY: a new step is a new page for a screen reader and starts at the top on a phone.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById("main")?.focus();
  }, [step]);

  function set<K extends keyof FormState>(key: K, value: FormState[K], clears: readonly FieldKey[] = []) {
    setForm((current) => ({ ...current, [key]: value }));
    if (clears.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        for (const field of clears) delete next[field];
        return next;
      });
    }
  }

  function focusFirstError(next: ExchangeErrors) {
    const field = FOCUS_ORDER.find((key) => next[key]);
    if (!field) return;
    formRef.current?.querySelector<HTMLElement>(`[name="${INPUT_NAME[field]}"]`)?.focus();
  }

  function touched(): boolean {
    return [form.name, form.note, form.budget, form.joinByDate, form.giftDay].some((v) => v.trim() !== "");
  }

  function close() {
    if (busy) return;
    if (touched()) setConfirmDiscard(true);
    else router.push("/exchanges");
  }

  async function submit() {
    if (busy || !online) return;
    if (!isBudgetPreset(form.budget)) return;
    setFailed(false);
    setBusy(true);
    let leaving = false;
    try {
      const result = await createExchange({
        name: form.name,
        note: form.note,
        budget: form.budget,
        joinByDate: form.joinByDate,
        drawMode: form.drawMode,
        drawTime: form.drawTime,
        giftDay: form.giftDay,
        timeZone,
        takingPart: form.takingPart === "yes",
        approvalRequired: form.joinRule === "approve",
      });
      if (result.ok) {
        // WHY replace: Back from the new exchange must not return to a filled-in form.
        leaving = true;
        router.replace(`/exchanges/${result.id}`);
        return;
      }
      if (result.reason === "signed-out") {
        leaving = true;
        return router.replace(`/login?next=${encodeURIComponent("/exchanges/new")}`);
      }
      if (result.reason === "invalid") {
        // WHY: only a race gets here (a moment that passed while the person was reviewing); put the
        // line on its field and go back to the step that has it. The inputs are kept.
        setErrors(result.errors);
        setStep(result.errors.name || result.errors.note ? 1 : 2);
        return;
      }
      setFailed(true);
    } catch {
      // A Server Action that cannot reach the server throws (GC-029: no offline writes).
      reportNetworkError();
      setFailed(true);
    } finally {
      // WHY not while leaving: the button must stay busy until the new page arrives, so a second tap cannot create a second exchange.
      if (!leaving) setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    if (busy) return;
    if (step === 1) {
      const found = validateBasics(form.name, form.note);
      setErrors(found);
      if (Object.keys(found).length > 0) return focusFirstError(found);
      setStep(2);
      return;
    }
    if (step === 2) {
      const found = validateBudgetAndDates(
        {
          budget: isBudgetPreset(form.budget) ? form.budget : null,
          joinByDate: form.joinByDate,
          drawMode: form.drawMode,
          drawTime: form.drawTime,
          giftDay: form.giftDay,
        },
        wallClockIn(new Date(), timeZone),
      );
      setErrors(found);
      if (Object.keys(found).length > 0) return focusFirstError(found);
      setStep(3);
      return;
    }
    void submit();
  }

  const goTo = (next: Step) => {
    setErrors({});
    setFailed(false);
    setStep(next);
  };

  const err = (field: FieldKey) => (errors[field] ? errorLine(field, errors[field]) : undefined);
  const copy = EXCHANGE_COPY.flow;

  return (
    <>
      <AuthFrame
        title={step === 1 ? copy.basics.title : step === 2 ? copy.dates.title : copy.rules.title}
        intro={step === 1 ? copy.basics.intro : step === 2 ? copy.dates.intro : undefined}
        eyebrow={copy.eyebrow(step)}
        headerAction={<Button variant="icon" icon={X} label={copy.close} onClick={close} />}
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="submit" fullWidth busy={step === 3 && busy} disabled={step === 3 && !online}>
              {step === 3 ? copy.start : copy.next}
            </Button>
            {step > 1 ? (
              <Button variant="text" fullWidth disabled={busy} onClick={() => goTo((step - 1) as Step)}>
                {copy.back}
              </Button>
            ) : null}
          </>
        }
      >
        {step === 1 ? (
          <div className="flex flex-col gap-20">
            <Field
              label={copy.basics.nameLabel}
              name="name"
              autoComplete="off"
              placeholder={copy.basics.namePlaceholder}
              helper={copy.basics.nameHelper}
              maxLength={EXCHANGE_NAME_MAX}
              error={err("name")}
              value={form.name}
              onChange={(e) => set("name", e.target.value, ["name"])}
            />
            <Field
              label={copy.basics.noteLabel}
              name="note"
              multiline
              placeholder={copy.basics.notePlaceholder}
              maxLength={EXCHANGE_NOTE_MAX}
              error={err("note")}
              value={form.note}
              onChange={(e) => set("note", e.target.value, ["note"])}
            />
          </div>
        ) : step === 2 ? (
          <DatesStep form={form} set={set} err={err} timeZone={timeZone} showSummary={Object.keys(errors).length === 0} />
        ) : (
          <div className="flex flex-col gap-32">
            <RadioGroup
              legend={copy.rules.partLegend}
              name="takingPart"
              options={TAKING_PART_OPTIONS}
              value={form.takingPart}
              onChange={(value) => set("takingPart", value)}
              disabled={busy || !online}
            />
            <RadioGroup
              legend={copy.rules.joinLegend}
              name="joinRule"
              options={WHO_CAN_JOIN_OPTIONS}
              value={form.joinRule}
              onChange={(value) => set("joinRule", value)}
              disabled={busy || !online}
            />
            <Review form={form} onEditDetails={() => goTo(1)} onEditDates={() => goTo(2)} disabled={busy} />
            <p className="text-body-sm-regular text-text-muted">{copy.rules.nothingSent}</p>
            {failed ? <Alert variant="error">{copy.failed}</Alert> : null}
          </div>
        )}
      </AuthFrame>
      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        variant="destructive"
        title={copy.discard.title}
        description={copy.discard.body}
        footer={
          <>
            <Button variant="destructive" fullWidth onClick={() => router.push("/exchanges")}>
              {copy.discard.cta}
            </Button>
            <Button variant="text" fullWidth onClick={() => setConfirmDiscard(false)}>
              {copy.discard.cancel}
            </Button>
          </>
        }
      />
    </>
  );
}

type StepProps = {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K], clears?: readonly FieldKey[]) => void;
  err: (field: FieldKey) => string | undefined;
};

function DatesStep({
  form,
  set,
  err,
  timeZone,
  showSummary,
}: StepProps & { timeZone: string; showSummary: boolean }) {
  const copy = EXCHANGE_COPY.flow.dates;
  const summary = showSummary ? runSummary(form) : null;
  return (
    <div className="flex flex-col gap-32">
      <RadioGroup
        legend={copy.budgetLegend}
        name="budget"
        options={BUDGET_OPTIONS}
        // WHY "" until chosen: no preset is preselected, so a skipped choice is caught (S27).
        value={form.budget}
        onChange={(value) => set("budget", value, ["budget"])}
        error={err("budget")}
      />
      <div className="flex flex-col gap-20">
        <div className="grid grid-cols-1 gap-20 md:grid-cols-2 md:items-start md:gap-16">
          <Field
            label={copy.joinBy}
            name="joinByDate"
            type="date"
            error={err("joinBy")}
            value={form.joinByDate}
            onChange={(e) => set("joinByDate", e.target.value, DATE_FIELDS)}
          />
          <Field
            label={copy.giftDay}
            name="giftDay"
            type="date"
            error={err("giftDay")}
            value={form.giftDay}
            onChange={(e) => set("giftDay", e.target.value, DATE_FIELDS)}
          />
        </div>
        <SegmentedTabs
          kind="choice"
          legend={copy.drawLegend}
          name="drawMode"
          options={DRAW_MODE_OPTIONS}
          value={form.drawMode}
          onChange={(value) => set("drawMode", value, DATE_FIELDS)}
        />
        {form.drawMode === "at_join_by" ? (
          <TimeField12
            label={copy.drawTime}
            name="drawTime"
            helper={copy.drawTimeHelper}
            error={err("drawTime")}
            value={form.drawTime}
            onChange={(hm) => set("drawTime", hm, DATE_FIELDS)}
          />
        ) : null}
      </div>
      {summary ? (
        <section aria-label={copy.summaryLabel} className="flex flex-col gap-8 rounded-xl bg-surface-subtle p-16">
          <p className="text-body-base-regular text-text-default">{summary}</p>
          <p className="text-body-sm-regular text-text-muted">{copy.zoneLine(zoneShortName(new Date(), timeZone))}</p>
        </section>
      ) : null}
    </div>
  );
}

function Review({
  form,
  onEditDetails,
  onEditDates,
  disabled,
}: {
  form: FormState;
  onEditDetails: () => void;
  onEditDates: () => void;
  disabled: boolean;
}) {
  const copy = EXCHANGE_COPY.flow.rules;
  const joinDay = formatYmdDay(form.joinByDate) ?? "";
  const auto = form.drawMode === "at_join_by";
  const autoMoment = `${joinDay}, ${formatHm(form.drawTime) ?? ""}`;
  const rows: Array<[string, string]> = [
    [copy.name, form.name.trim()],
    ...(form.note.trim() === "" ? [] : ([[copy.note, form.note.trim()]] as Array<[string, string]>)),
    [copy.budget, isBudgetPreset(form.budget) ? budgetLabel(form.budget) : ""],
    [copy.joinBy, auto ? autoMoment : copy.endOfDay(joinDay)],
    [copy.namesDrawn, auto ? autoMoment : copy.whenReady],
    [copy.gifts, formatYmdDay(form.giftDay) ?? ""],
  ];
  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-16 rounded-2xl bg-surface-subtle p-20">
      <h2 id="review-heading" className="text-heading-4">
        {copy.checkTitle}
      </h2>
      <dl className="flex flex-col gap-12">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-2">
            <dt className="text-body-sm-regular text-text-muted">{label}</dt>
            <dd className="break-words text-body-base-medium text-text-default">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-24">
        <Button variant="link" disabled={disabled} onClick={onEditDetails}>
          {copy.editDetails}
        </Button>
        <Button variant="link" disabled={disabled} onClick={onEditDates}>
          {copy.editDates}
        </Button>
      </div>
    </section>
  );
}
