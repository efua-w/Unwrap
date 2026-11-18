// WHY every value goes through here (AC-14): names and exchange names are typed by people, so a name like
// `<script>` must reach the email as text.
const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

// WHY: a subject is a mail header. A line break in a typed name must not start a new header.
export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// WHY: the board greets by first name ("Hi Tolu,"); the display name can be a full name.
export function firstName(name: string): string {
  return oneLine(name).split(" ")[0] ?? "";
}
