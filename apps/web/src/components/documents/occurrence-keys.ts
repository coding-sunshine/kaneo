/** Stable React keys for texts that can repeat: "a", "a#2", "b". */
export function occurrenceKeys(texts: string[]) {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return count === 1 ? text : `${text}#${count}`;
  });
}
