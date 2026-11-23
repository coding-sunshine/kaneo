import { File, ListTree } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDiff } from "@/components/reviews/file-diff";
import type { DiffLayout } from "@/components/reviews/patch-diff";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  usePullRequestConversation,
  usePullRequestFiles,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

export function FilesTab({
  pullRef,
  reviewed,
  onReviewedChange,
}: {
  pullRef: PullRef;
  /** Kept by the page, so switching to Overview and back keeps it. */
  reviewed: string[];
  onReviewedChange: (filename: string, reviewed: boolean) => void;
}) {
  const { t } = useTranslation();
  const files = usePullRequestFiles(pullRef, true);
  const conversation = usePullRequestConversation(pullRef);
  const [chosen, setChosen] = useState<DiffLayout>("unified");
  const [query, setQuery] = useState("");
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
  const needle = query.trim().toLowerCase();
  const shown = files.data.filter((file) =>
    file.filename.toLowerCase().includes(needle),
  );
  return (
    <div className="@container flex flex-col gap-3 px-4 pb-4">
      <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-2.5 font-medium text-xs">
          <ListTree aria-hidden className="size-3.5" />
          {t("workspace:reviews.detail.tabs.files")}
          <span className="text-muted-foreground tabular-nums">
            {files.data.length}
          </span>
        </span>
        <span className="flex-1" />
        {!narrow && (
          <div className="flex shrink-0 items-center gap-1.5">
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
      {/* Linear keeps the file list in a column beside the diffs when there is room. */}
      <div className="grid gap-3 @4xl:grid-cols-[16rem_minmax(0,1fr)]">
        <nav
          aria-label={t("workspace:reviews.detail.fileList")}
          className="flex flex-col gap-1 @4xl:sticky @4xl:top-0 @4xl:self-start"
        >
          <Input
            size="sm"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("workspace:reviews.detail.filterFiles")}
            aria-label={t("workspace:reviews.detail.filterFiles")}
          />
          <ul className="flex flex-col text-[13px]">
            {shown.map((file) => (
              <li key={file.filename}>
                <a
                  href={`#file-${file.filename}`}
                  title={file.filename}
                  className="flex h-8 items-center gap-2 rounded-md px-2 hover:bg-accent"
                >
                  <File
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {file.filename.split("/").pop()}
                  </span>
                  <span className="shrink-0 text-success-foreground tabular-nums">
                    +{file.additions}
                  </span>
                  <span className="shrink-0 text-destructive-foreground tabular-nums">
                    -{file.deletions}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-3">
          {shown.length === 0 && (
            <p className="p-3 text-muted-foreground text-sm">
              {t("workspace:reviews.detail.noMatchingFiles")}
            </p>
          )}
          {shown.map((file) => (
            <FileDiff
              key={file.filename}
              file={file}
              layout={layout}
              comments={inline.filter((entry) => entry.path === file.filename)}
              reviewed={reviewed.includes(file.filename)}
              onReviewedChange={(value) =>
                onReviewedChange(file.filename, value)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
