import { ArrowUpToLine, UnfoldVertical } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { InlineComments } from "@/components/reviews/inline-comments";
import {
  type DiffLine,
  expandGaps,
  isCommentOnLine,
  parsePatch,
  toSplitRows,
} from "@/components/reviews/diff-parser";
import {
  pairChanges,
  type Segment,
} from "@/components/reviews/intra-line-diff";
import type { ConversationEntry } from "@/fetchers/github-reviews/github-reviews";
import { cn } from "@/lib/cn";

export type DiffLayout = "unified" | "split";

// Linear marks changed lines with a tinted row and a colored left edge.
const rowClass = {
  hunk: "",
  add: "border-l-success bg-success/10",
  del: "border-l-destructive bg-destructive/10",
  ctx: "",
};
const numberColor = {
  hunk: "",
  add: "text-success-foreground",
  del: "text-destructive-foreground",
  ctx: "",
};
// The color carries the change on screen; screen readers get the sign.
const sign = { hunk: "", add: "+", del: "-", ctx: "" };

const numberClass =
  "w-14 shrink-0 select-none pr-3 text-right text-muted-foreground/70 tabular-nums";

/** Linear's "N unchanged lines" in place of the hunk header; a click shows them. */
function Skipped({
  line,
  onOpen,
}: {
  line: DiffLine;
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation();
  const Icon = line.id === 0 ? ArrowUpToLine : UnfoldVertical;
  return (
    <button
      type="button"
      data-kind="hunk"
      onClick={() => onOpen(line.id)}
      className="col-span-2 flex w-full cursor-pointer items-center justify-center gap-1.5 py-1.5 font-sans text-muted-foreground hover:bg-accent/50 hover:text-foreground"
    >
      <Icon aria-hidden className="size-3.5" />
      {t("workspace:reviews.detail.unchangedLines", { count: line.skipped })}
    </button>
  );
}

// One number column, as in Linear: the new line number, or a dash for a removal.
function UnifiedRow({
  line,
  wrap,
  marks,
}: {
  line: DiffLine;
  wrap: boolean;
  marks?: Segment[];
}) {
  return (
    <div
      data-kind={line.kind}
      className={cn(
        "flex border-l-2 border-l-transparent",
        !wrap && "min-w-max",
        rowClass[line.kind],
      )}
    >
      <span className={cn(numberClass, numberColor[line.kind])}>
        {line.newNo ?? (line.kind === "del" ? "−" : "")}
      </span>
      <span className="sr-only">{sign[line.kind]}</span>
      <span className={cn("pr-4", textClass(wrap))}>
        {lineText(line, marks)}
      </span>
    </div>
  );
}

// Words that changed inside a paired line get a stronger background.
const markClass = { add: "bg-success/30", del: "bg-destructive/30" };
const lineText = (line: DiffLine, marks?: Segment[]) => {
  if (!marks || (line.kind !== "add" && line.kind !== "del")) return line.text;
  let at = 0;
  return marks.map((part) => {
    const key = at;
    at += part.text.length;
    return part.changed ? (
      <span
        key={key}
        className={cn("rounded-[2px]", markClass[line.kind as "add" | "del"])}
      >
        {part.text}
      </span>
    ) : (
      part.text
    );
  });
};

const textClass = (wrap: boolean) =>
  wrap ? "min-w-0 whitespace-pre-wrap break-words" : "whitespace-pre";

function SplitCell({
  line,
  side,
  wrap,
  marks,
}: {
  line: DiffLine | null;
  side: "LEFT" | "RIGHT";
  wrap: boolean;
  marks?: Segment[];
}) {
  return (
    <div
      data-kind={line?.kind ?? "empty"}
      className={cn(
        "flex min-w-0 overflow-hidden border-l-2 border-l-transparent",
        line ? rowClass[line.kind] : "bg-muted/20",
      )}
    >
      <span className={cn(numberClass, line && numberColor[line.kind])}>
        {(side === "LEFT" ? line?.oldNo : line?.newNo) ?? ""}
      </span>
      <span className="sr-only">{line ? sign[line.kind] : ""}</span>
      <span className={cn("pr-4", textClass(wrap))}>
        {line && lineText(line, marks)}
      </span>
    </div>
  );
}

export function PatchDiff({
  patch,
  layout,
  comments = [],
  wrap = false,
  structural = false,
  fileLines = null,
  onExpand,
}: {
  patch: string;
  layout?: DiffLayout;
  wrap?: boolean;
  // Mark the words that changed inside paired removed and added lines.
  structural?: boolean;
  // The whole file at the head commit; null until it is known or when it has no lines.
  fileLines?: string[] | null;
  // Called when the reader opens a gap, so the file text can be fetched.
  onExpand?: () => void;
  // Inline review comments for this file only.
  comments?: ConversationEntry[];
}) {
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set());
  const open = (id: number) => {
    setOpened((current) => new Set(current).add(id));
    onExpand?.();
  };
  const parsed = useMemo(() => parsePatch(patch), [patch]);
  const lines = useMemo(
    () => expandGaps(parsed, fileLines, opened),
    [parsed, fileLines, opened],
  );
  const marks = useMemo(
    () => (structural ? pairChanges(lines) : new Map<number, Segment[]>()),
    [structural, lines],
  );
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
          if (row.kind === "hunk") {
            return row.line.skipped ? (
              <Skipped key={row.id} line={row.line} onOpen={open} />
            ) : null;
          }
          const found = [
            ...under(row.left, "LEFT"),
            ...under(row.right, "RIGHT"),
          ];
          return (
            <Fragment key={row.id}>
              <SplitCell
                line={row.left}
                side="LEFT"
                wrap={wrap}
                marks={marks.get(row.left?.id ?? -1)}
              />
              <SplitCell
                line={row.right}
                side="RIGHT"
                wrap={wrap}
                marks={marks.get(row.right?.id ?? -1)}
              />
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
      className={cn("font-mono text-xs leading-5", !wrap && "overflow-x-auto")}
    >
      {lines.map((line) => {
        if (line.kind === "hunk") {
          return line.skipped ? (
            <Skipped key={line.id} line={line} onOpen={open} />
          ) : null;
        }
        const found = [...under(line, "LEFT"), ...under(line, "RIGHT")];
        return (
          <Fragment key={line.id}>
            <UnifiedRow line={line} wrap={wrap} marks={marks.get(line.id)} />
            {found.length > 0 && <InlineComments comments={found} />}
          </Fragment>
        );
      })}
    </div>
  );
}
