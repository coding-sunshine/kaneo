// The "all" search feeds a menu grouped by type. A plain top-N lets a flood of
// issue matches push every comment and document out, so each type keeps its
// best few first and the remaining slots go by relevance.
const FLOOR_PER_TYPE = 3;

export function pickAcrossTypes<T extends { type: string }>(
  sorted: T[],
  limit: number,
): T[] {
  const taken = new Set<T>();
  const perType = new Map<string, number>();
  for (const result of sorted) {
    const count = perType.get(result.type) ?? 0;
    if (count < FLOOR_PER_TYPE) {
      perType.set(result.type, count + 1);
      taken.add(result);
    }
  }
  for (const result of sorted) {
    if (taken.size >= limit) break;
    taken.add(result);
  }
  return sorted.filter((result) => taken.has(result)).slice(0, limit);
}
