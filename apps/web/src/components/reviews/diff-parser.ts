export type DiffLine = {
  id: number;
  kind: "hunk" | "add" | "del" | "ctx";
  text: string;
  oldNo: number | null;
  newNo: number | null;
  /** On a hunk: the unchanged lines between it and the hunk before (or the file start). */
  skipped?: number;
  /** On a hunk: the old and new line numbers of the first skipped line. */
  gapFrom?: { old: number; new: number };
};

export type SplitRow =
  | { kind: "hunk"; id: number; line: DiffLine }
  | { kind: "pair"; id: number; left: DiffLine | null; right: DiffLine | null };

export type InlineComment = {
  path: string | null;
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
};

// Turns GitHub's unified `patch` text into numbered lines.
export function parsePatch(patch: string): DiffLine[] {
  let oldNo = 1;
  let newNo = 1;
  return patch.split("\n").map((line, id): DiffLine => {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
      const start = Number(match?.[1] ?? 0);
      // A new file's hunk starts at old line 0, with nothing above it.
      const skipped = Math.max(0, start - oldNo);
      const gapFrom = { old: oldNo, new: newNo };
      oldNo = start;
      newNo = Number(match?.[2] ?? 0);
      return {
        id,
        kind: "hunk",
        text: line,
        oldNo: null,
        newNo: null,
        skipped,
        gapFrom,
      };
    }
    if (line.startsWith("+")) {
      return {
        id,
        kind: "add",
        text: line.slice(1),
        oldNo: null,
        newNo: newNo++,
      };
    }
    if (line.startsWith("-")) {
      return {
        id,
        kind: "del",
        text: line.slice(1),
        oldNo: oldNo++,
        newNo: null,
      };
    }
    // "\ No newline at end of file" markers and context lines.
    if (line.startsWith("\\")) {
      return { id, kind: "ctx", text: line, oldNo: null, newNo: null };
    }
    return {
      id,
      kind: "ctx",
      text: line.slice(1),
      oldNo: oldNo++,
      newNo: newNo++,
    };
  });
}

// Lines the side-by-side view shows: context on both sides, and each run of
// removals paired with the additions that follow it.
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.kind === "hunk") {
      rows.push({ kind: "hunk", id: line.id, line });
      index++;
    } else if (line.kind === "ctx") {
      rows.push({ kind: "pair", id: line.id, left: line, right: line });
      index++;
    } else {
      const dels: DiffLine[] = [];
      const adds: DiffLine[] = [];
      while (lines[index]?.kind === "del") dels.push(lines[index++]);
      while (lines[index]?.kind === "add") adds.push(lines[index++]);
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) {
        const left = dels[i] ?? null;
        const right = adds[i] ?? null;
        rows.push({
          kind: "pair",
          id: (left ?? right)?.id ?? line.id,
          left,
          right,
        });
      }
    }
  }
  return rows;
}

// A comment on the old side sits under the line's old number, otherwise the new.
export const isCommentOnLine = (
  comment: InlineComment,
  line: DiffLine | null,
  side: "LEFT" | "RIGHT",
) =>
  line !== null &&
  comment.line !== null &&
  (comment.side ?? "RIGHT") === side &&
  (side === "LEFT" ? line.oldNo : line.newNo) === comment.line;

/** The file's lines from its text; a final newline does not start another line. */
export const splitFileText = (text: string) =>
  text.replace(/\n$/, "").split("\n");

// Fills the gaps the reader opened with the file's own lines, and ends the
// list with a separator for the lines after the last hunk. Ids stay unique and
// ordered by sitting between the hunk's id and the next one.
export function expandGaps(
  lines: DiffLine[],
  fileLines: string[] | null,
  opened: ReadonlySet<number>,
): DiffLine[] {
  if (!fileLines) return lines;
  const fill = (
    id: number,
    from: { old: number; new: number },
    count: number,
  ) =>
    Array.from({ length: count }, (_, i): DiffLine => ({
      id: id + (i + 1) / (count + 1),
      kind: "ctx",
      text: fileLines[from.new - 1 + i] ?? "",
      oldNo: from.old + i,
      newNo: from.new + i,
    }));
  const out = lines.flatMap((line) =>
    line.kind === "hunk" && line.skipped && line.gapFrom && opened.has(line.id)
      ? [{ ...line, skipped: 0 }, ...fill(line.id, line.gapFrom, line.skipped)]
      : [line],
  );
  const last = (key: "oldNo" | "newNo") =>
    [...lines].reverse().find((line) => line[key] !== null)?.[key] ?? 0;
  const from = { old: last("oldNo") + 1, new: last("newNo") + 1 };
  const rest = fileLines.length - from.new + 1;
  if (rest <= 0 || lines.length === 0) return out;
  const id = lines.length;
  const trailing: DiffLine = {
    id,
    kind: "hunk",
    text: "",
    oldNo: null,
    newNo: null,
    skipped: rest,
    gapFrom: from,
  };
  return [
    ...out,
    ...(opened.has(id)
      ? [{ ...trailing, skipped: 0 }, ...fill(id, from, rest)]
      : [trailing]),
  ];
}
