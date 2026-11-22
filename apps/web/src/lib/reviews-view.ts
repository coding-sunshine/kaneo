import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";

// GitHub search has no team or priority, so Linear's team and priority
// groupings have nothing to read from here.
export type ReviewsGroupBy =
  | "none"
  | "status"
  | "reviewStatus"
  | "checks"
  | "author"
  | "repository"
  | "size";
export type ReviewsSortBy = "updated" | "created" | "size" | "title";

export type ReviewsView = {
  groupBy: ReviewsGroupBy;
  subGroupBy: ReviewsGroupBy;
  sortBy: ReviewsSortBy;
  showRepository: boolean;
  showChecks: boolean;
  showSize: boolean;
  /** Top-level group keys, as `${groupBy}:${key}`, kept below the others. */
  pinned: string[];
};

export const DEFAULT_REVIEWS_VIEW: ReviewsView = {
  groupBy: "status",
  subGroupBy: "none",
  sortBy: "updated",
  showRepository: true,
  showChecks: true,
  showSize: true,
  pinned: [],
};

export const REVIEWS_GROUP_BYS: ReviewsGroupBy[] = [
  "none",
  "status",
  "reviewStatus",
  "checks",
  "author",
  "repository",
  "size",
];
export const REVIEWS_SORT_BYS: ReviewsSortBy[] = [
  "updated",
  "created",
  "size",
  "title",
];

const FIXED_ORDER: Partial<Record<ReviewsGroupBy, string[]>> = {
  status: ["open", "draft", "merged", "closed"],
  reviewStatus: [
    "changes_requested",
    "review_required",
    "approved",
    "no_decision",
  ],
  checks: ["failure", "pending", "success", "none"],
  size: ["xs", "s", "m", "l", "xl"],
};

export function sizeBucket(pr: ReviewPullRequest) {
  const lines = pr.additions + pr.deletions;
  if (lines < 10) return "xs";
  if (lines < 50) return "s";
  if (lines < 250) return "m";
  if (lines < 1000) return "l";
  return "xl";
}

export function groupKey(pr: ReviewPullRequest, by: ReviewsGroupBy) {
  switch (by) {
    case "status":
      return pr.status;
    case "reviewStatus":
      return pr.reviewDecision ?? "no_decision";
    case "checks":
      return pr.checks;
    case "author":
      return pr.author?.login ?? "";
    case "repository":
      return `${pr.owner}/${pr.repo}`;
    case "size":
      return sizeBucket(pr);
    default:
      return "all";
  }
}

export type ReviewsGroup = {
  by: ReviewsGroupBy;
  key: string;
  items: ReviewPullRequest[];
  children: ReviewsGroup[];
};

function bucket(
  items: ReviewPullRequest[],
  by: ReviewsGroupBy,
): ReviewsGroup[] {
  const map = new Map<string, ReviewPullRequest[]>();
  for (const pr of items) {
    const key = groupKey(pr, by);
    map.set(key, [...(map.get(key) ?? []), pr]);
  }
  const order = FIXED_ORDER[by];
  return [...map.entries()]
    .sort(([a], [b]) =>
      order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b),
    )
    .map(([key, group]) => ({ by, key, items: group, children: [] }));
}

export function sortPullRequests(
  items: ReviewPullRequest[],
  by: ReviewsSortBy,
) {
  const lines = (pr: ReviewPullRequest) => pr.additions + pr.deletions;
  return [...items].sort((a, b) =>
    by === "title"
      ? a.title.localeCompare(b.title)
      : by === "size"
        ? lines(b) - lines(a)
        : by === "created"
          ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function filterPullRequests(items: ReviewPullRequest[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((pr) =>
    [pr.title, pr.owner, pr.repo, pr.author?.login ?? "", `#${pr.number}`]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

export function pinId(group: Pick<ReviewsGroup, "by" | "key">) {
  return `${group.by}:${group.key}`;
}

export function buildGroups(
  items: ReviewPullRequest[],
  view: Pick<ReviewsView, "groupBy" | "subGroupBy" | "pinned">,
): ReviewsGroup[] {
  if (view.groupBy === "none") {
    return [{ by: "none", key: "all", items, children: [] }];
  }
  const groups = bucket(items, view.groupBy).map((group) => ({
    ...group,
    children:
      view.subGroupBy !== "none" && view.subGroupBy !== view.groupBy
        ? bucket(group.items, view.subGroupBy)
        : [],
  }));
  const pinned = (group: ReviewsGroup) =>
    view.pinned.includes(pinId(group)) ? 1 : 0;
  return groups.sort((a, b) => pinned(a) - pinned(b));
}

/** Rows in the order they appear on screen, for keyboard navigation. */
export function flattenGroups(groups: ReviewsGroup[]): ReviewPullRequest[] {
  return groups.flatMap((group) =>
    group.children.length > 0 ? flattenGroups(group.children) : group.items,
  );
}
