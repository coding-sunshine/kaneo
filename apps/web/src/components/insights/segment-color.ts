/** Segment colours cycle through the theme's chart tokens. */
export const segmentColor = (index: number) =>
  `var(--chart-${(index % 5) + 1})`;
