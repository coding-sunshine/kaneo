// Heading, quote, list and task-list markers at the start of a markdown line.
const MARKERS = /^(\s*(#{1,6}|[-*+>]|\d+[.)]|\[[ xX]\])\s+)+/;

/** The sentences of a document's text, without the markup around them. */
export function sentencesOf(text: string) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return text.split("\n").flatMap((line) => {
    const plain = line
      .replace(/<[^>]+>/g, " ")
      .replace(MARKERS, "")
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return Array.from(segmenter.segment(plain), (part) =>
      part.segment.trim(),
    ).filter(Boolean);
  });
}

// The sentences of `from` that `other` does not hold, counting repeats.
function without(from: string[], other: string[]) {
  const left = new Map<string, number>();
  for (const sentence of other) {
    left.set(sentence, (left.get(sentence) ?? 0) + 1);
  }
  return from.filter((sentence) => {
    const count = left.get(sentence) ?? 0;
    if (count > 0) left.set(sentence, count - 1);
    return count === 0;
  });
}

/**
 * What a decider has to read before approving: the sentences that are new and
 * the ones that are gone. A reworded sentence is one of each.
 *
 * ponytail: compares the two texts as bags of sentences, so a sentence that
 * only moved is not reported. Use a longest-common-subsequence diff if the
 * order of sentences has to be approved too.
 */
export function changedSentences(before: string, after: string) {
  const was = sentencesOf(before);
  const now = sentencesOf(after);
  const added = without(now, was);
  const removed = without(was, now);
  return { added, removed, count: Math.max(added.length, removed.length) };
}
