export type CommitRange = { from: number; to: number };

/** Clicking a commit grows, shrinks or starts the picked range; the range stays unbroken. */
export function nextRange(
  range: CommitRange | null,
  index: number,
): CommitRange | null {
  if (!range) return { from: index, to: index };
  const { from, to } = range;
  if (index < from) return { from: index, to };
  if (index > to) return { from, to: index };
  if (from === to) return null;
  if (index === from) return { from: from + 1, to };
  if (index === to) return { from, to: to - 1 };
  return { from, to: index };
}
