import { useTranslation } from "react-i18next";
import { type DiffLayout, PatchDiff } from "@/components/reviews/patch-diff";
import type {
  ConversationEntry,
  PullRequestFiles,
} from "@/fetchers/github-reviews/github-reviews";

export function FileDiff({
  file,
  layout,
  comments,
}: {
  file: PullRequestFiles[number];
  layout: DiffLayout;
  comments: ConversationEntry[];
}) {
  const { t } = useTranslation();
  return (
    <section
      id={`file-${file.filename}`}
      className="overflow-hidden rounded-lg border"
    >
      <h3 className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 font-mono text-xs">
        <span className="min-w-0 flex-1 truncate">{file.filename}</span>
        <span className="text-success-foreground tabular-nums">
          +{file.additions}
        </span>
        <span className="text-destructive-foreground tabular-nums">
          -{file.deletions}
        </span>
      </h3>
      {file.patch ? (
        <PatchDiff patch={file.patch} layout={layout} comments={comments} />
      ) : (
        <p className="p-3 text-muted-foreground text-xs">
          {t("workspace:reviews.detail.noPatch")}
        </p>
      )}
    </section>
  );
}
