import { Fragment, useMemo } from "react";
import { InlineComments } from "@/components/reviews/inline-comments";
import {
  type DiffLine,
  isCommentOnLine,
  parsePatch,
  type SplitRow,
  toSplitRows,
} from "@/components/reviews/diff-parser";
import type { ConversationEntry } from "@/fetchers/github-reviews/github-reviews";
import { cn } from "@/lib/cn";

export type DiffLayout = "unified" | "split";

const rowClass = {
  hunk: "bg-muted/60 text-muted-foreground",
  add: "bg-success/10",
  del: "bg-destructive/10",
  ctx: "",
};
const sign = { hunk: "", add: "+", del: "-", ctx: "" };

const numberClass =
  "w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/70 tabular-nums";

function UnifiedRow({ line }: { line: DiffLine }) {
  return (
    <div
      data-kind={line.kind}
      className={cn("flex min-w-max", rowClass[line.kind])}
    >
      <span className={numberClass}>{line.oldNo ?? ""}</span>
      <span className={numberClass}>{line.newNo ?? ""}</span>
      <span className="w-4 shrink-0 select-none text-center">
        {sign[line.kind]}
      </span>
      <span className="whitespace-pre pr-4">{line.text}</span>
    </div>
  );
}

function SplitCell({
  line,
  side,
}: {
  line: DiffLine | null;
  side: "LEFT" | "RIGHT";
}) {
  return (
    <div
      data-kind={line?.kind ?? "empty"}
      className={cn(
        "flex min-w-0 overflow-hidden",
        line ? rowClass[line.kind] : "bg-muted/20",
        side === "RIGHT" && "border-l",
      )}
    >
      <span className={numberClass}>
        {(side === "LEFT" ? line?.oldNo : line?.newNo) ?? ""}
      </span>
      <span className="w-4 shrink-0 select-none text-center">
        {line ? sign[line.kind] : ""}
      </span>
      <span className="whitespace-pre pr-4">{line?.text}</span>
    </div>
  );
}

function SplitRowView({ row }: { row: SplitRow }) {
  if (row.kind === "hunk") {
    return (
      <div data-kind="hunk" className={cn("col-span-2", rowClass.hunk)}>
        <span className="whitespace-pre px-3">{row.line.text}</span>
      </div>
    );
  }
  return (
    <>
      <SplitCell line={row.left} side="LEFT" />
      <SplitCell line={row.right} side="RIGHT" />
    </>
  );
}

export function PatchDiff({
  patch,
  layout,
  comments = [],
}: {
  patch: string;
  layout?: DiffLayout;
  // Inline review comments for this file only.
  comments?: ConversationEntry[];
}) {
  const lines = useMemo(() => parsePatch(patch), [patch]);
  const rows = useMemo(
    () => (layout === "split" ? toSplitRows(lines) : []),
    [layout, lines],
  );
  const under = (line: DiffLine | null, side: "LEFT" | "RIGHT") =>
    comments.filter((comment) => isCommentOnLine(comment, line, side));

  if (layout === "split") {
    return (
      <div
        data-layout="split"
        className="grid grid-cols-2 font-mono text-xs leading-5"
      >
        {rows.map((row) => {
          const found =
            row.kind === "pair"
              ? [...under(row.left, "LEFT"), ...under(row.right, "RIGHT")]
              : [];
          return (
            <Fragment key={row.id}>
              <SplitRowView row={row} />
              {found.length > 0 && (
                <div className="col-span-2">
                  <InlineComments comments={found} />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    );
  }
  return (
    <div
      data-layout="unified"
      className="overflow-x-auto font-mono text-xs leading-5"
    >
      {lines.map((line) => {
        const found = [...under(line, "LEFT"), ...under(line, "RIGHT")];
        return (
          <Fragment key={line.id}>
            <UnifiedRow line={line} />
            {found.length > 0 && <InlineComments comments={found} />}
          </Fragment>
        );
      })}
    </div>
  );
}
