import { createHash } from "node:crypto";

// How many words in a row make one entry.
const RUN = 5;

/**
 * The fingerprint of a text: a 32-bit hash for each distinct run of five
 * words, sorted. Markup, case and punctuation do not count, so the same words
 * saved as HTML or as Markdown give the same list.
 */
export function fingerprint(text: string) {
  const words = text
    .replace(/<[^>]*>|&#?\w+;/g, " ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const prints = new Set<number>();
  for (let start = 0; start + RUN <= words.length; start++) {
    prints.add(
      createHash("sha1")
        .update(words.slice(start, start + RUN).join(" "))
        .digest()
        .readInt32BE(0),
    );
  }
  return [...prints].sort((a, b) => a - b);
}

/** The share of all runs of two texts that both have, from 0 to 1. */
export function resemblance(a: number[], b: number[]) {
  const other = new Set(b);
  const shared = a.filter((print) => other.has(print)).length;
  const all = a.length + b.length - shared;
  return all === 0 ? 0 : shared / all;
}
