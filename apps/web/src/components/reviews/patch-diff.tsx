import { cn } from "@/lib/cn";

type DiffLine = {
  id: number;
  kind: "hunk" | "add" | "del" | "ctx";
  text: string;
  oldNo: number | null;
  newNo: number | null;
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

const rowClass = {
  hunk: "bg-muted/60 text-muted-foreground",
  add: "bg-success/10",
  del: "bg-destructive/10",
  ctx: "",
};
const sign = { hunk: "", add: "+", del: "-", ctx: "" };

export function PatchDiff({ patch }: { patch: string }) {
  return (
    <div className="overflow-x-auto font-mono text-xs leading-5">
      {parsePatch(patch).map((line) => (
        <div
          key={line.id}
          data-kind={line.kind}
          className={cn("flex min-w-max", rowClass[line.kind])}
        >
          <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/70 tabular-nums">
            {line.oldNo ?? ""}
          </span>
          <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/70 tabular-nums">
            {line.newNo ?? ""}
          </span>
          <span className="w-4 shrink-0 select-none text-center">
            {sign[line.kind]}
          </span>
          <span className="whitespace-pre pr-4">{line.text}</span>
        </div>
      ))}
    </div>
  );
}
