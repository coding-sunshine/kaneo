import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { splitFileText } from "@/components/reviews/diff-parser";
import { FileActionsMenu } from "@/components/reviews/file-actions-menu";
import { FileIcon } from "@/components/reviews/file-icon";
import { type DiffLayout, PatchDiff } from "@/components/reviews/patch-diff";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  ConversationEntry,
  PullRef,
  PullRequestFiles,
} from "@/fetchers/github-reviews/github-reviews";
import { useFileContent } from "@/hooks/queries/github-reviews/use-github-reviews";

export function FileDiff({
  pullRef,
  headSha,
  file,
  layout,
  wrap,
  structural,
  minimized,
  showCounts,
  prefetch,
  comments,
  reviewed,
  onReviewedChange,
}: {
  pullRef: PullRef;
  /** The commit whose file text fills the unchanged lines. */
  headSha: string | undefined;
  file: PullRequestFiles[number];
  layout: DiffLayout;
  wrap: boolean;
  structural: boolean;
  /** A generated or test file: folded to its header until opened. */
  minimized: string | null;
  showCounts: boolean;
  /** Fetch the file text up front, so the trailing separator shows at once. */
  prefetch: boolean;
  comments: ConversationEntry[];
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
}) {
  const { t } = useTranslation();
  const [wanted, setWanted] = useState(false);
  const [opened, setOpened] = useState(false);
  const folded = reviewed || (minimized !== null && !opened);
  const removed = file.status === "removed";
  const content = useFileContent(
    pullRef,
    file.filename,
    headSha,
    (prefetch || wanted) && !!file.patch && !removed && !folded,
  );
  const fileLines =
    content.data?.content != null ? splitFileText(content.data.content) : null;
  const slash = file.filename.lastIndexOf("/");
  const githubUrl =
    headSha && !removed
      ? `https://github.com/${pullRef.owner}/${pullRef.repo}/blob/${headSha}/${file.filename}`
      : null;
  return (
    <section
      id={`file-${file.filename}`}
      className="scroll-mt-4 overflow-hidden rounded-lg border"
    >
      <h3 className="flex h-10 items-center gap-2 px-3 font-normal text-[13px]">
        {minimized && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-expanded={opened}
            aria-label={t(
              `workspace:reviews.diffOptions2.${opened ? "collapse" : "expand"}`,
            )}
            onClick={() => setOpened(!opened)}
          >
            {opened ? <ChevronDown /> : <ChevronRight />}
          </Button>
        )}
        <FileIcon filename={file.filename} />
        <span className="min-w-0 flex-1 truncate" title={file.filename}>
          {file.filename.slice(slash + 1)}
          {slash >= 0 && (
            <span className="ml-2 text-muted-foreground">
              {file.filename.slice(0, slash + 1)}
            </span>
          )}
        </span>
        {minimized && (
          <span className="shrink-0 text-muted-foreground text-xs">
            {minimized}
          </span>
        )}
        {showCounts && (
          <>
            <span className="shrink-0 text-success-foreground tabular-nums">
              +{file.additions}
            </span>
            <span className="shrink-0 text-destructive-foreground tabular-nums">
              -{file.deletions}
            </span>
          </>
        )}
        {/* Linear folds a reviewed file away, leaving its header. */}
        <label className="ml-2 flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <Checkbox checked={reviewed} onCheckedChange={onReviewedChange} />
          {t("workspace:reviews.detail.reviewed")}
        </label>
        <FileActionsMenu filename={file.filename} githubUrl={githubUrl} />
      </h3>
      {!folded &&
        (file.patch ? (
          <div className="border-t">
            <PatchDiff
              patch={file.patch}
              layout={layout}
              wrap={wrap}
              structural={structural}
              comments={comments}
              fileLines={fileLines}
              onExpand={() => setWanted(true)}
            />
          </div>
        ) : (
          <p className="border-t p-3 text-muted-foreground text-xs">
            {t("workspace:reviews.detail.noPatch")}
          </p>
        ))}
    </section>
  );
}
