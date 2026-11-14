import type { PersonLine } from "./types";

// Pure helpers for the People section and the row counts (GC-013, GCO-004 Q14). Faces and names only.

// "People in" counts who takes part: an organiser who is only organising is not one of the people in
// (board Exchange-Detail-ojust: "4 people are in" with four names, none the organiser).
export function peopleIn(takingPart: boolean, memberCount: number): number {
  return takingPart ? memberCount : Math.max(0, memberCount - 1);
}

// "Ngozi Eze (organising), Femi Adeyemi, Bisi Lawal and you." The viewer reads "you", or "You
// (organising)" first when they organise. WHY the viewer is placed last otherwise: the board does.
export function peopleSentence(people: readonly PersonLine[]): string {
  const others = people.filter((p) => !p.isMe).map((p) => (p.isOrganiser ? `${p.name} (organising)` : p.name));
  const me = people.find((p) => p.isMe);
  const labels = me ? (me.isOrganiser ? [`You (organising)`, ...others] : [...others, "you"]) : others;
  if (labels.length <= 1) return `${labels.join("")}.`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}.`;
}

export function peopleStackLabel(people: readonly PersonLine[]): string {
  const count = people.length;
  return `${count} ${count === 1 ? "person" : "people"}: ${peopleSentence(people)}`;
}

// True when the viewer joined on today's date in their own zone.
export function joinedToday(joinedAt: string, now: Date, timeZone: string): boolean {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return day(new Date(joinedAt)) === day(now);
}
