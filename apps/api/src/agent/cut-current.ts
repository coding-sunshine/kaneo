type Current = { text?: unknown; textCut?: string };
type Answer = { topics?: { current?: Current | null }[] };

/**
 * A get_current answer over `max` characters, with its approved text cut so
 * that the answer stays whole JSON and fits. The text's `textCut` says how
 * long it is, what is shown and how to read on. Null when the answer has no
 * text to cut, or is too long without it.
 */
export function cutCurrent(answer: string, max: number, from = 0) {
  let data: Answer;
  try {
    data = JSON.parse(answer) as Answer;
  } catch {
    return null;
  }
  const docs = (data.topics ?? []).flatMap((topic) =>
    typeof topic?.current?.text === "string" ? [topic.current] : [],
  );
  // The text comes for one topic only.
  const [doc] = docs;
  if (!doc || docs.length > 1) return null;
  const full = doc.text as string;
  const total = from + full.length;
  let shown = full.length;
  for (;;) {
    doc.text = full.slice(0, shown);
    doc.textCut = `The approved text has ${total} characters. This answer holds characters ${from} to ${from + shown}. Call get_current again with textFrom: ${from + shown} to read on.`;
    const cut = JSON.stringify(data);
    if (cut.length <= max) return cut;
    // Escapes make the JSON longer than the text it holds.
    shown -= Math.max(cut.length - max, 1);
    if (shown <= 0) return null;
  }
}
