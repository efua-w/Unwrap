import { AvatarStack } from "@/components/ui/AvatarStack";
import { Button } from "@/components/ui/Button";
import { EXCHANGE_COPY } from "../copy";
import { peopleSentence, peopleStackLabel } from "../people";
import type { PersonLine } from "../types";

type Props = {
  people: readonly PersonLine[];
  /** True when nobody else has joined: shows the empty line instead of faces. */
  alone: boolean;
  /** The number in the heading. */
  count: number;
  /** Organiser only: where "See all" goes (Participants, GCO-007). Absent for a participant. */
  seeAllHref?: string;
};

// GC-013 / GCO-004 People section, shared by the participant and organiser pages (boards
// Exchange-Detail-before, -ojust, -ostarted). "See all" (organiser only, GCO-007) opens Participants. Faces and names only. WHY no list status and no ids:
// co-members and the organiser may not read who has added a list (AC-20), and the type has no field for it.
export function PeopleSection({ people, alone, count, seeAllHref }: Props) {
  const copy = EXCHANGE_COPY.detail;
  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-12">
        <h2 id="people-heading" className="text-heading-4">
          {alone ? copy.people : copy.peopleCount(count)}
        </h2>
        {seeAllHref ? (
          <Button variant="link" href={seeAllHref}>
            {copy.seeAll}
          </Button>
        ) : null}
      </div>
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
