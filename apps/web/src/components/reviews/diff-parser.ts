export type DiffLine = {
  id: number;
  kind: "hunk" | "add" | "del" | "ctx";
  text: string;
  oldNo: number | null;
  newNo: number | null;
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
  let oldNo = 0;
  let newNo = 0;
  return patch.split("\n").map((line, id): DiffLine => {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
      oldNo = Number(match?.[1] ?? 0);
      newNo = Number(match?.[2] ?? 0);
      return { id, kind: "hunk", text: line, oldNo: null, newNo: null };
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
