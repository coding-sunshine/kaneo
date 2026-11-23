import { ArrowUpToLine, UnfoldVertical } from "lucide-react";
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { InlineComments } from "@/components/reviews/inline-comments";
import {
  type DiffLine,
  isCommentOnLine,
  parsePatch,
  toSplitRows,
} from "@/components/reviews/diff-parser";
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

/** Linear's "N unchanged lines" in place of the hunk header. */
function Skipped({ line }: { line: DiffLine }) {
  const { t } = useTranslation();
  const Icon = line.id === 0 ? ArrowUpToLine : UnfoldVertical;
  return (
    <div
      data-kind="hunk"
      className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 font-sans text-muted-foreground"
    >
      <Icon aria-hidden className="size-3.5" />
      {t("workspace:reviews.detail.unchangedLines", { count: line.skipped })}
    </div>
  );
}

// One number column, as in Linear: the new line number, or a dash for a removal.
function UnifiedRow({ line }: { line: DiffLine }) {
  return (
    <div
      data-kind={line.kind}
      className={cn(
        "flex min-w-max border-l-2 border-l-transparent",
        rowClass[line.kind],
      )}
    >
      <span className={cn(numberClass, numberColor[line.kind])}>
        {line.newNo ?? (line.kind === "del" ? "−" : "")}
      </span>
      <span className="sr-only">{sign[line.kind]}</span>
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
        "flex min-w-0 overflow-hidden border-l-2 border-l-transparent",
        line ? rowClass[line.kind] : "bg-muted/20",
      )}
    >
      <span className={cn(numberClass, line && numberColor[line.kind])}>
        {(side === "LEFT" ? line?.oldNo : line?.newNo) ?? ""}
      </span>
      <span className="sr-only">{line ? sign[line.kind] : ""}</span>
      <span className="whitespace-pre pr-4">{line?.text}</span>
    </div>
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
          if (row.kind === "hunk") {
            return row.line.skipped ? (
              <Skipped key={row.id} line={row.line} />
            ) : null;
          }
          const found = [
            ...under(row.left, "LEFT"),
            ...under(row.right, "RIGHT"),
          ];
          return (
            <Fragment key={row.id}>
              <SplitCell line={row.left} side="LEFT" />
              <SplitCell line={row.right} side="RIGHT" />
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
        if (line.kind === "hunk") {
          return line.skipped ? <Skipped key={line.id} line={line} /> : null;
        }
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
