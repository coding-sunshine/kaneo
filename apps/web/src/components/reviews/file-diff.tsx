import { File } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type DiffLayout, PatchDiff } from "@/components/reviews/patch-diff";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  ConversationEntry,
  PullRequestFiles,
} from "@/fetchers/github-reviews/github-reviews";

export function FileDiff({
  file,
  layout,
  comments,
  reviewed,
  onReviewedChange,
}: {
  file: PullRequestFiles[number];
  layout: DiffLayout;
  comments: ConversationEntry[];
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      id={`file-${file.filename}`}
      className="scroll-mt-4 overflow-hidden rounded-lg border"
    >
      <h3 className="flex h-10 items-center gap-2 px-3 font-normal text-[13px]">
        <File aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{file.filename}</span>
        <span className="shrink-0 text-success-foreground tabular-nums">
          +{file.additions}
        </span>
        <span className="shrink-0 text-destructive-foreground tabular-nums">
          -{file.deletions}
        </span>
        {/* Linear folds a reviewed file away, leaving its header. */}
        <label className="ml-2 flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <Checkbox checked={reviewed} onCheckedChange={onReviewedChange} />
          {t("workspace:reviews.detail.reviewed")}
        </label>
      </h3>
      {!reviewed &&
        (file.patch ? (
          <div className="border-t">
            <PatchDiff patch={file.patch} layout={layout} comments={comments} />
          </div>
        ) : (
          <p className="border-t p-3 text-muted-foreground text-xs">
            {t("workspace:reviews.detail.noPatch")}
          </p>
        ))}
    </section>
  );
}
