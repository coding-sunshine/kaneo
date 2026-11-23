import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDiff } from "@/components/reviews/file-diff";
import type { DiffLayout } from "@/components/reviews/patch-diff";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  usePullRequestConversation,
  usePullRequestFiles,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

export function FilesTab({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const files = usePullRequestFiles(pullRef, true);
  const conversation = usePullRequestConversation(pullRef);
  const [chosen, setChosen] = useState<DiffLayout>("unified");
  // Split needs the width; narrow screens always read unified.
  const narrow = useIsMobile();
  const layout = narrow ? "unified" : chosen;
  useShortcut(
    "toggleLayout",
    () => setChosen((value) => (value === "split" ? "unified" : "split")),
    { enabled: !narrow },
  );

  if (files.isLoading) return <Skeleton className="m-4 h-40" />;
  if (files.isError || !files.data) {
    return (
      <p role="alert" className="p-6 text-muted-foreground text-sm">
        {t("workspace:reviews.loadError")}
      </p>
    );
  }
  if (files.data.length === 0) {
    return (
      <p className="p-6 text-muted-foreground text-sm">
        {t("workspace:reviews.detail.noFiles")}
      </p>
    );
  }
  const inline = (conversation.data ?? []).filter(
    (entry) => entry.kind === "review_comment",
  );
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <ul
          aria-label={t("workspace:reviews.detail.fileList")}
          className="flex min-w-0 flex-1 flex-col text-xs"
        >
          {files.data.map((file) => (
            <li key={file.filename} className="flex items-center gap-2 py-0.5">
              <a
                href={`#file-${file.filename}`}
                className="min-w-0 flex-1 truncate font-mono hover:underline"
              >
                {file.filename}
              </a>
              <span className="text-success-foreground tabular-nums">
                +{file.additions}
              </span>
              <span className="text-destructive-foreground tabular-nums">
                -{file.deletions}
              </span>
            </li>
          ))}
        </ul>
        {!narrow && (
          <div className="flex shrink-0 items-center gap-1.5 self-start">
            {(["unified", "split"] as const).map((value) => (
              <Button
                key={value}
                size="xs"
                variant="outline"
                aria-pressed={layout === value}
                onClick={() => setChosen(value)}
                className={
                  layout === value ? "bg-accent" : "text-muted-foreground"
                }
              >
                {t(`workspace:reviews.detail.layout.${value}`)}
              </Button>
            ))}
            <ShortcutKeys id="toggleLayout" />
          </div>
        )}
      </div>
      {files.data.map((file) => (
        <FileDiff
          key={file.filename}
          file={file}
          layout={layout}
          comments={inline.filter((entry) => entry.path === file.filename)}
        />
      ))}
    </div>
  );
}
