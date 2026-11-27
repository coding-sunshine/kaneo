/**
 * A budget field's text as tokens: empty is no limit (null), and anything but
 * a whole number from 0 up is invalid (undefined).
 */
export function parseTokenBudget(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}
