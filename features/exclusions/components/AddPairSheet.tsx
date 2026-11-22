"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RadioGroup, type RadioOption } from "@/components/ui/RadioGroup";
import { Sheet } from "@/components/ui/Sheet";
import { firstName } from "@/features/joining/copy";
import { EXCLUSIONS_COPY } from "../copy";
import { firstPickPeople, partnersFor } from "../draft";
import type { DraftPair, PairablePerson } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  people: readonly PairablePerson[];
  draft: readonly DraftPair[];
  onAdd: (first: PairablePerson, second: PairablePerson) => void;
};

function options(people: readonly PairablePerson[]): RadioOption<string>[] {
  // WHY the address as the hint (owner decision Q1a, 2026-11-22): two people can share a first name, and the
  // organiser may read addresses. The organiser's own row has none.
  return people.map((p) => ({ value: p.memberId, label: p.name, hint: p.email ?? undefined }));
}

// GCO-009 Add a pair (boards Org-Excl-pairfirst, Org-Excl-pairsecond): a sheet with two steps, first person then second.
// WHY the parent remounts it (a new `key`) for each opening: it starts on step one with nothing chosen. WHY the lists
// come from the draft: a person already paired with everyone is left out of step one (owner decision Q7), and the
// second step leaves out the first person and their existing partners.
export function AddPairSheet({ open, onClose, people, draft, onAdd }: Props) {
  const copy = EXCLUSIONS_COPY;
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const first = people.find((p) => p.memberId === firstId) ?? null;

  const step2 = step === 2 && first !== null;
  const choices = step2 ? partnersFor(first, people, draft) : firstPickPeople(people, draft);

  function next() {
    if (first) setStep(2);
  }

  function add() {
    const second = people.find((p) => p.memberId === secondId);
    if (!first || !second) return;
    onAdd(first, second);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="form"
      title={step2 ? copy.secondTitle(firstName(first.name)) : copy.sheetTitle}
      footer={
        <>
          {step2 ? (
            <>
              <Button fullWidth disabled={secondId === ""} onClick={add}>
                {copy.add}
              </Button>
              <Button variant="text" fullWidth onClick={() => setStep(1)}>
                {copy.back2}
              </Button>
            </>
          ) : (
            <>
              <Button fullWidth disabled={firstId === ""} onClick={next}>
                {copy.next}
              </Button>
              <Button variant="text" fullWidth onClick={onClose}>
                {copy.cancel}
              </Button>
            </>
          )}
        </>
      }
    >
      {step2 ? (
        <div className="flex flex-col gap-16">
          <p className="text-body-base-regular text-text-secondary">{copy.secondBody(firstName(first.name))}</p>
          <RadioGroup
            key="second"
            legend={copy.secondTitle(firstName(first.name))}
            name="pair-second"
            options={options(choices)}
            value={secondId}
            onChange={setSecondId}
          />
        </div>
      ) : (
        <RadioGroup
          key="first"
          legend={copy.firstBody}
          name="pair-first"
          options={options(choices)}
          value={firstId}
          onChange={(id) => {
            setFirstId(id);
            // WHY: a second pick made for another first person no longer applies.
            setSecondId("");
          }}
        />
      )}
    </Sheet>
  );
}
