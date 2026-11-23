import { ListTree } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CommitsPicker } from "@/components/reviews/commits-picker";
import {
  DEFAULT_DIFF_OPTIONS,
  DiffOptionsMenu,
} from "@/components/reviews/diff-options-menu";
import { DiffTooLargeBanner } from "@/components/reviews/diff-too-large-banner";
import { FileDiff } from "@/components/reviews/file-diff";
import { FileIcon } from "@/components/reviews/file-icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useComparedFiles,
  usePullRequest,
  usePullRequestCommits,
  usePullRequestConversation,
  usePullRequestFiles,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import type { CommitRange } from "@/lib/commit-range";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

// GitHub lists at most this many commits of a pull request.
const COMMITS_CAP = 250;
// Fetching every file's text up front is a request per file; above this the
// text is fetched when a separator is opened and the trailing one waits for it.
// ponytail: a flat cap, replace it with fetching only the files near the viewport.
const PREFETCH_LIMIT = 40;

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
  const pull = usePullRequest(pullRef);
  const commits = usePullRequestCommits(pullRef, true);
  const [range, setRange] = useState<CommitRange | null>(null);
  const picked = range && commits.data ? commits.data : null;
  const scope =
    picked && range
      ? {
          base: picked[range.from].parent ?? picked[range.from].sha,
          head: picked[range.to].sha,
        }
      : null;
  const allFiles = usePullRequestFiles(pullRef, true);
  const compared = useComparedFiles(pullRef, scope);
  const files = scope ? compared : allFiles;
  const conversation = usePullRequestConversation(pullRef);
  const [options, setOptions] = useState(DEFAULT_DIFF_OPTIONS);
  const [query, setQuery] = useState("");
  // Split needs the width; narrow screens always read unified.
  const narrow = useIsMobile();
  const layout = narrow ? "unified" : options.layout;
  useShortcut(
    "toggleLayout",
    () =>
      setOptions((value) => ({
        ...value,
        layout: value.layout === "split" ? "unified" : "split",
      })),
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
  const shown = files.data.filter(
    (file) =>
      file.filename.toLowerCase().includes(needle) &&
      !(options.hideReviewed && reviewed.includes(file.filename)),
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
        {commits.data && commits.data.length > 0 && (
          <CommitsPicker
            commits={commits.data}
            range={range}
            onRangeChange={setRange}
          />
        )}
        <span className="flex-1" />
        <DiffOptionsMenu
          options={options}
          onChange={(patch) => setOptions((value) => ({ ...value, ...patch }))}
          canSplit={!narrow}
        />
      </div>
      {commits.data && commits.data.length >= COMMITS_CAP && pull.data && (
        <DiffTooLargeBanner url={pull.data.url} shown={commits.data.length} />
      )}
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
                  <FileIcon filename={file.filename} />
                  <span className="min-w-0 flex-1 truncate">
                    {file.filename.split("/").pop()}
                  </span>
                  {options.showCounts && (
                    <>
                      <span className="shrink-0 text-success-foreground tabular-nums">
                        +{file.additions}
                      </span>
                      <span className="shrink-0 text-destructive-foreground tabular-nums">
                        -{file.deletions}
                      </span>
                    </>
                  )}
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
              pullRef={pullRef}
              headSha={scope?.head ?? pull.data?.headSha}
              file={file}
              layout={layout}
              wrap={options.wrap}
              showCounts={options.showCounts}
              prefetch={files.data.length <= PREFETCH_LIMIT}
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
