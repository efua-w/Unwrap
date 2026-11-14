import { AvatarStack } from "@/components/ui/AvatarStack";
import { EXCHANGE_COPY } from "../copy";
import { peopleSentence, peopleStackLabel } from "../people";
import type { PersonLine } from "../types";

type Props = {
  people: readonly PersonLine[];
  /** True when nobody else has joined: shows the empty line instead of faces. */
  alone: boolean;
  /** The number in the heading. */
  count: number;
};

// GC-013 / GCO-004 People section, shared by the participant and organiser pages (boards
// Exchange-Detail-before, -ojust, -ostarted). Faces and names only. WHY no list status and no ids:
// co-members and the organiser may not read who has added a list (AC-20), and the type has no field for it.
export function PeopleSection({ people, alone, count }: Props) {
  const copy = EXCHANGE_COPY.detail;
  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-8">
      <h2 id="people-heading" className="text-heading-4">
        {alone ? copy.people : copy.peopleCount(count)}
      </h2>
      {alone ? (
        <p className="text-body-base-regular text-text-secondary">{copy.peopleOnlyYou}</p>
      ) : (
        <>
          <AvatarStack people={people.map((p, i) => ({ id: String(i), name: p.name }))} label={peopleStackLabel(people)} />
          <p className="text-body-base-regular text-text-secondary">{peopleSentence(people)}</p>
        </>
      )}
    </section>
  );
}
