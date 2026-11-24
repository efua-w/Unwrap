import { formatNaira } from "./naira";

// The four budget presets (GCO-002, decided 2026-11-03 by Tobechukwu Olih; they override the ranges
// in the designs). The database stores the key; the label is copy. Amounts are kobo, never floats.
export const BUDGET_PRESETS = ["5k_10k", "10k_20k", "20k_50k", "50k_plus"] as const;
export type BudgetPreset = (typeof BUDGET_PRESETS)[number];

const RANGE_KOBO: Record<BudgetPreset, { min: number; max: number | null }> = {
  "5k_10k": { min: 500_000, max: 1_000_000 },
  "10k_20k": { min: 1_000_000, max: 2_000_000 },
  "20k_50k": { min: 2_000_000, max: 5_000_000 },
  "50k_plus": { min: 5_000_000, max: null },
};

export function isBudgetPreset(value: unknown): value is BudgetPreset {
  return typeof value === "string" && (BUDGET_PRESETS as readonly string[]).includes(value);
}

// "₦5,000 to ₦10,000", and "Above ₦50,000" for the top preset (owner decision 2026-11-09, item 1).
export function budgetLabel(preset: BudgetPreset): string {
  const { min, max } = RANGE_KOBO[preset];
  return max === null ? `Above ${formatNaira(min)}` : `${formatNaira(min)} to ${formatNaira(max)}`;
}

export type BudgetFit = "within" | "over" | "under";

// GC-015: where an item's price sits against the exchange's preset. WHY inclusive at both ends: "₦15,000 to ₦25,000"
// includes both figures, so a ₦25,000 item is Within. The top preset has no ceiling, so nothing is Over it. Integer kobo
// only, never floats. No price means no flag (null), per the story ("no price → no budget flag").
export function budgetFit(preset: BudgetPreset, priceKobo: number | null): BudgetFit | null {
  if (priceKobo === null) return null;
  const { min, max } = RANGE_KOBO[preset];
  if (priceKobo < min) return "under";
  if (max !== null && priceKobo > max) return "over";
  return "within";
}

// The range as it follows "Within the" and "Over the" in the item sheet: "₦15,000 to ₦25,000", and "₦50,000 and above"
// for the top preset (budgetLabel's "Above ₦50,000" does not read after "the"). Pending copy, see copy-pending.
export function budgetRangePhrase(preset: BudgetPreset): string {
  const { min, max } = RANGE_KOBO[preset];
  return max === null ? `${formatNaira(min)} and above` : `${formatNaira(min)} to ${formatNaira(max)}`;
}
