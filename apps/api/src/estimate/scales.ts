export const ESTIMATE_TYPES = [
  "none",
  "exponential",
  "fibonacci",
  "linear",
  "tshirt",
] as const;
export type EstimateType = (typeof ESTIMATE_TYPES)[number];

export type EstimateSettings = {
  estimateType: string;
  estimateExtended: boolean;
  estimateAllowZero: boolean;
};

export type EstimateOption = { value: number; label: string };

// Linear's scales: the first five values, then the extended ones.
const SCALES: Record<Exclude<EstimateType, "none">, [number[], number[]]> = {
  exponential: [
    [1, 2, 4, 8, 16],
    [32, 64],
  ],
  fibonacci: [
    [1, 2, 3, 5, 8],
    [13, 21],
  ],
  linear: [
    [1, 2, 3, 4, 5],
    [6, 7],
  ],
  tshirt: [
    [1, 2, 3, 5, 8],
    [13, 21],
  ],
};
const TSHIRT_LABELS: Record<number, string> = {
  1: "XS",
  2: "S",
  3: "M",
  5: "L",
  8: "XL",
  13: "XXL",
  21: "XXXL",
};

/** The points a team lets an issue take, in order; empty when estimates are off. */
export function estimateOptions(team: EstimateSettings): EstimateOption[] {
  const scale = SCALES[team.estimateType as keyof typeof SCALES];
  if (!scale) return [];
  const values = [...(team.estimateAllowZero ? [0] : []), ...scale[0]];
  if (team.estimateExtended) values.push(...scale[1]);
  return values.map((value) => ({
    value,
    label:
      (team.estimateType === "tshirt" && TSHIRT_LABELS[value]) || String(value),
  }));
}
