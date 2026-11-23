import { Check, GitCommitHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReviewsTabPill } from "@/components/reviews/reviews-tab-pill";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PullRequestCommits } from "@/fetchers/github-reviews/github-reviews";
import { type CommitRange, nextRange } from "@/lib/commit-range";

/** Linear's Commits pill: all commits, or a range of them to scope the diff to. */
export function CommitsPicker({
  commits,
  range,
  onRangeChange,
}: {
  commits: PullRequestCommits;
  range: CommitRange | null;
  onRangeChange: (range: CommitRange | null) => void;
}) {
  const { t } = useTranslation();
  // Newest first, as Linear lists them; indexes stay oldest first.
  const rows = commits.map((commit, index) => ({ commit, index })).reverse();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <ReviewsTabPill active={range !== null} onClick={() => {}}>
            <GitCommitHorizontal aria-hidden className="size-3.5" />
            {t("workspace:reviews.detail.tabs.commits")}
            <span className="text-muted-foreground tabular-nums">
              {commits.length}
            </span>
          </ReviewsTabPill>
        }
      />
      <PopoverContent align="start" className="w-[28rem] max-w-[90vw]">
        <PopoverTitle className="sr-only">
          {t("workspace:reviews.detail.tabs.commits")}
        </PopoverTitle>
        <button
          type="button"
          onClick={() => onRangeChange(null)}
          className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
        >
          <span className="flex-1 text-left font-medium">
            {t("workspace:reviews.detail.allCommits")}
          </span>
          {range === null && <Check aria-hidden className="size-4" />}
          <span className="text-muted-foreground">
            {t("workspace:reviews.detail.commitCount", {
              count: commits.length,
            })}
          </span>
        </button>
        <p className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
          {t("workspace:reviews.detail.specificCommits")}
        </p>
        <ul className="max-h-80 overflow-y-auto">
          {rows.map(({ commit, index }) => (
            <li key={commit.sha}>
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent">
                <Checkbox
                  checked={
                    range !== null && index >= range.from && index <= range.to
                  }
                  onCheckedChange={() => onRangeChange(nextRange(range, index))}
                />
                <code className="shrink-0 text-muted-foreground text-xs">
                  {commit.sha.slice(0, 7)}
                </code>
                <span className="min-w-0 flex-1 truncate">{commit.title}</span>
                {commit.date && (
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {new Date(commit.date).toLocaleDateString()}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
