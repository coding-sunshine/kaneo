import type { DiffLine } from "@/components/reviews/diff-parser";

export type Segment = { text: string; changed: boolean };

// Words, runs of spaces, and single punctuation marks.
const tokenize = (text: string) => text.match(/\w+|\s+|[^\w\s]/g) ?? [];

// ponytail: quadratic LCS, so very long lines get plain colours instead.
const MAX_CELLS = 40_000;

/** Marks the tokens that differ between a removed line and the added line paired with it. */
export function markChanges(
  del: string,
  add: string,
): { del: Segment[]; add: Segment[] } | null {
  const a = tokenize(del);
  const b = tokenize(add);
  if (a.length * b.length > MAX_CELLS) return null;
  const table = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  // Nothing shared: the whole line changed, so the line colour says it already.
  if (table[0][0] === 0) return null;
  const left: Segment[] = [];
  const right: Segment[] = [];
  const push = (out: Segment[], text: string, changed: boolean) => {
    const last = out[out.length - 1];
    if (last && last.changed === changed) last.text += text;
    else out.push({ text, changed });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push(left, a[i++], false);
      push(right, b[j++], false);
    } else if (
      j >= b.length ||
      (i < a.length && table[i + 1][j] >= table[i][j + 1])
    ) {
      push(left, a[i++], true);
    } else {
      push(right, b[j++], true);
    }
  }
  return { del: left, add: right };
}

/** Segments per line id, pairing the removals and additions of each changed run in order. */
export function pairChanges(lines: DiffLine[]): Map<number, Segment[]> {
  const out = new Map<number, Segment[]>();
  let index = 0;
  while (index < lines.length) {
    if (lines[index].kind !== "del") {
      index++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (lines[index]?.kind === "del") dels.push(lines[index++]);
    while (lines[index]?.kind === "add") adds.push(lines[index++]);
    for (let k = 0; k < Math.min(dels.length, adds.length); k++) {
      const marked = markChanges(dels[k].text, adds[k].text);
      if (!marked) continue;
      out.set(dels[k].id, marked.del);
      out.set(adds[k].id, marked.add);
    }
  }
  return out;
}
