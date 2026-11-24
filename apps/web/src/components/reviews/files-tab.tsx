import { ListTree } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { arrangeFiles } from "@/components/reviews/arrange-files";
import { CategoryHeading } from "@/components/reviews/category-heading";
import { CommitsPicker } from "@/components/reviews/commits-picker";
import { DiffOptionsMenu } from "@/components/reviews/diff-options-menu";
import { DiffTooLargeBanner } from "@/components/reviews/diff-too-large-banner";
import { FileDiff } from "@/components/reviews/file-diff";
import { FileList } from "@/components/reviews/file-list";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useElementWidth } from "@/hooks/use-element-width";
import { useFileCategories } from "@/hooks/use-file-categories";
import {
  useComparedFiles,
  usePullRequest,
  usePullRequestCommits,
  usePullRequestConversation,
  usePullRequestFiles,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import type { CommitRange } from "@/lib/commit-range";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useReviewsDiffOptionsStore } from "@/store/reviews-diff-options";

// GitHub lists at most this many commits of a pull request.
const COMMITS_CAP = 250;
// Split needs room; a narrower pane reads unified. Setting stays "split".
const SPLIT_MIN_WIDTH = 630;
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
  const { options, set: setOptions } = useReviewsDiffOptionsStore();
  const [query, setQuery] = useState("");
  const [measure, width] = useElementWidth();
  const narrow = width !== null && width < SPLIT_MIN_WIDTH;
  const layout = narrow ? "unified" : options.layout;
  const categoryOf = useFileCategories(
    pullRef,
    scope?.head ?? pull.data?.headSha,
  );
  useShortcut("toggleLayout", () =>
    setOptions({ layout: options.layout === "split" ? "unified" : "split" }),
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
  const sections = arrangeFiles(shown, categoryOf, options);
  // Generated files fold away unless the whole pull request is generated.
  const allGenerated = files.data.every(
    (file) => categoryOf(file.filename) === "generated",
  );
  const minimizedFor = (path: string) => {
    const category = categoryOf(path);
    const fold =
      (category === "generated" &&
        options.minimizeGenerated &&
        !allGenerated) ||
      (category === "test" && options.minimizeTests);
    return fold
      ? t(`workspace:reviews.diffOptions2.category.${category}`)
      : null;
  };
  const listed = sections.map((section) => ({
    ...section,
    files: section.files.filter(
      (file) =>
        !(
          options.minimizeGenerated &&
          !allGenerated &&
          categoryOf(file.filename) === "generated"
        ),
    ),
  }));
  return (
    <div ref={measure} className="@container flex flex-col gap-3 px-4 pb-4">
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
        <DiffOptionsMenu options={options} onChange={setOptions} />
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
          {listed.map(
            (section) =>
              section.files.length > 0 && (
                <div key={section.category ?? "all"}>
                  {section.category && (
                    <CategoryHeading category={section.category} />
                  )}
                  <FileList
                    files={section.files}
                    tree={options.fileList === "tree"}
                    showCounts={options.showCounts}
                  />
                </div>
              ),
          )}
        </nav>
        <div className="flex min-w-0 flex-col gap-3">
          {shown.length === 0 && (
            <p className="p-3 text-muted-foreground text-sm">
              {t("workspace:reviews.detail.noMatchingFiles")}
            </p>
          )}
          {sections.map((section) => (
            <div
              key={section.category ?? "all"}
              className="flex flex-col gap-3"
            >
              {section.category && (
                <CategoryHeading category={section.category} />
              )}
              {section.files.map((file) => (
                <FileDiff
                  key={file.filename}
                  pullRef={pullRef}
                  headSha={scope?.head ?? pull.data?.headSha}
                  file={file}
                  layout={layout}
                  wrap={options.wrap}
                  structural={options.structural}
                  codeTheme={options.codeTheme}
                  minimized={minimizedFor(file.filename)}
                  showCounts={options.showCounts}
                  prefetch={files.data.length <= PREFETCH_LIMIT}
                  comments={inline.filter(
                    (entry) => entry.path === file.filename,
                  )}
                  reviewed={reviewed.includes(file.filename)}
                  onReviewedChange={(value) =>
                    onReviewedChange(file.filename, value)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
