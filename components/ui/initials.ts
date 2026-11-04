const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function firstGrapheme(word: string): string {
  const first = segmenter.segment(word)[Symbol.iterator]().next();
  return first.done ? "" : first.value.segment;
}

// WHY: slicing by UTF-16 unit splits emoji and accented names; graphemes keep them whole.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return "?";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return (firstGrapheme(first) + (last ? firstGrapheme(last) : "")).toLocaleUpperCase("en");
}
