import { cx } from "./cx";

export type ExchangeTint = "clay" | "peach" | "sand" | "mint";
export type ExchangeTagSize = "row" | "header";

// WHY literal class names: Tailwind only generates classes it can see whole in the source.
const TINT_CLASS: Record<ExchangeTint, string> = {
  clay: "bg-surface-exchange-clay",
  peach: "bg-surface-exchange-peach",
  sand: "bg-surface-exchange-sand",
  mint: "bg-surface-exchange-mint",
};

const SIZE_CLASS: Record<ExchangeTagSize, string> = {
  row: "size-40 text-body-base-bold",
  header: "size-48 text-body-xl-bold",
};

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

export function exchangeInitial(name: string): string {
  const first = segmenter.segment(name.trim())[Symbol.iterator]().next().value;
  return first ? first.segment.toLocaleUpperCase("en") : "?";
}

// Boards: UwAvatar kind "exchange" (tag + tint). Decorative: the exchange name always sits beside it,
// and the tint is decoration only, never the only carrier of meaning (plan §8).
export function ExchangeTag({ name, tint, size = "row", className }: { name: string; tint: ExchangeTint; size?: ExchangeTagSize; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-heading text-text-default",
        TINT_CLASS[tint],
        SIZE_CLASS[size],
        className,
      )}
    >
      {exchangeInitial(name)}
    </span>
  );
}
