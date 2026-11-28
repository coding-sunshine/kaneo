/** The letter and digit words of a title, lowercased. */
export const titleWords = (title: string) =>
  title
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

function trigrams(title: string) {
  const grams = new Set<string>();
  for (const word of titleWords(title)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1)
      grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * How alike two titles read, from 0 to 1: the Dice coefficient of their word
 * trigrams, so "crash" and "crashes" still overlap.
 */
export function titleSimilarity(a: string, b: string) {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}
