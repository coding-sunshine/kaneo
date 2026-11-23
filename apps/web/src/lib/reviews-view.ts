import type {
  ClosedWindow,
  ReviewPullRequest,
  ReviewsList,
} from "@/fetchers/github-reviews/github-reviews";

import { reviewStatus, REVIEW_STATUSES } from "@/lib/reviews-status";
import {
  type ReviewsFilters,
  sanitizeReviewsFilters,
} from "@/lib/reviews-filters";

export type ReviewsTab = "created" | "toReview";
export const REVIEWS_TABS: ReviewsTab[] = ["created", "toReview"];
export type ReviewsFocus = "needsReview" | "done";
/** A list row: To review rows say whether they still need this person's review. */
export type ReviewItem = ReviewPullRequest & { focus?: ReviewsFocus };

// Priority, project and team come from the Kaneo task linked to the pull
// request (Linear's team is a Kaneo project, its project a work project).
export type ReviewsGroupBy =
  | "none"
  | "status"
  | "focus"
  | "author"
  | "repository"
  | "size"
  | "priority"
  | "project"
  | "team";
export type ReviewsSortBy =
  | "author"
  | "closestToMerge"
  | "issuePriority"
  | "name"
  | "date"
  | "size"
  | "status"
  | "updated";
export type SortDirection = "asc" | "desc";
export type ReviewsProperty =
  | "repository"
  | "id"
  | "author"
  | "date"
  | "statusDetails"
  | "reviewers"
  | "githubTeam"
  | "labels";

export type ReviewsView = {
  groupBy: ReviewsGroupBy;
  subGroupBy: ReviewsGroupBy;
  sortBy: ReviewsSortBy;
  sortDirection: SortDirection;
  closed: ClosedWindow;
  showDrafts: boolean;
  properties: ReviewsProperty[];
  /** Top-level group ids, as `${groupBy}:${key}`, shown collapsed. */
  collapsed: string[];
  /** Top-level group ids kept below the others. */
  pinned: string[];
  filters: ReviewsFilters;
};
export type ReviewsViews = Record<ReviewsTab, ReviewsView>;

export const REVIEWS_GROUP_BYS: Record<ReviewsTab, ReviewsGroupBy[]> = {
  created: [
    "none",
    "status",
    "author",
    "priority",
    "project",
    "repository",
    "size",
    "team",
  ],
  toReview: [
    "none",
    "focus",
    "status",
    "author",
    "priority",
    "project",
    "repository",
    "size",
    "team",
  ],
};
export const REVIEWS_SORT_BYS: ReviewsSortBy[] = [
  "author",
  "closestToMerge",
  "issuePriority",
  "name",
  "date",
  "size",
  "status",
  "updated",
];
export const REVIEWS_PROPERTIES: ReviewsProperty[] = [
  "repository",
  "id",
  "author",
  "date",
  "statusDetails",
  "reviewers",
  "githubTeam",
  "labels",
];
export const CLOSED_WINDOWS: ClosedWindow[] = [
  "none",
  "day",
  "week",
  "month",
  "all",
];

/** The direction each ordering starts in when picked, as Linear does. */
export const DEFAULT_SORT_DIRECTION: Record<ReviewsSortBy, SortDirection> = {
  author: "asc",
  closestToMerge: "asc",
  issuePriority: "asc",
  name: "asc",
  date: "desc",
  size: "desc",
  status: "asc",
  updated: "desc",
};

// Linear's defaults per tab: merged and closed PRs, and reviews already done,
// start collapsed.
export const DEFAULT_REVIEWS_VIEWS: ReviewsViews = {
  created: {
    groupBy: "status",
    subGroupBy: "none",
    sortBy: "date",
    sortDirection: "desc",
    closed: "week",
    showDrafts: true,
    properties: ["date"],
    collapsed: ["status:merged", "status:closed"],
    pinned: [],
    filters: {},
  },
  toReview: {
    groupBy: "focus",
    subGroupBy: "none",
    sortBy: "closestToMerge",
    sortDirection: "asc",
    closed: "day",
    showDrafts: true,
    properties: ["date"],
    collapsed: ["focus:done"],
    pinned: [],
    filters: {},
  },
};

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const strings = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? (value as string[])
    : fallback;

/** Saved views can predate a field or hold a value since dropped; keep what still fits. */
export function sanitizeReviewsViews(saved: unknown): ReviewsViews {
  const views = (saved ?? {}) as Partial<Record<ReviewsTab, unknown>>;
  const one = (tab: ReviewsTab): ReviewsView => {
    const base = DEFAULT_REVIEWS_VIEWS[tab];
    const view = (views[tab] ?? {}) as Partial<
      Record<keyof ReviewsView, unknown>
    >;
    const groups = REVIEWS_GROUP_BYS[tab];
    return {
      groupBy: pick(view.groupBy, groups, base.groupBy),
      subGroupBy: pick(view.subGroupBy, groups, base.subGroupBy),
      sortBy: pick(view.sortBy, REVIEWS_SORT_BYS, base.sortBy),
      sortDirection: pick(
        view.sortDirection,
        ["asc", "desc"],
        base.sortDirection,
      ),
      closed: pick(view.closed, CLOSED_WINDOWS, base.closed),
      showDrafts:
        typeof view.showDrafts === "boolean"
          ? view.showDrafts
          : base.showDrafts,
      properties: strings(view.properties, base.properties).filter(
        (property): property is ReviewsProperty =>
          REVIEWS_PROPERTIES.includes(property as ReviewsProperty),
      ),
      collapsed: strings(view.collapsed, base.collapsed),
      pinned: strings(view.pinned, base.pinned),
      filters: sanitizeReviewsFilters(view.filters),
    };
  };
  return { created: one("created"), toReview: one("toReview") };
}

/** A saved tab order must hold each tab once; anything else falls back to the default. */
export function sanitizeTabOrder(saved: unknown): ReviewsTab[] {
  return Array.isArray(saved) &&
    saved.length === REVIEWS_TABS.length &&
    REVIEWS_TABS.every((tab) => saved.includes(tab))
    ? (saved as ReviewsTab[])
    : REVIEWS_TABS;
}

/** Swaps a tab with its neighbour; the first tab cannot go left nor the last right. */
export function moveTab(
  order: ReviewsTab[],
  tab: ReviewsTab,
  by: -1 | 1,
): ReviewsTab[] {
  const from = order.indexOf(tab);
  const to = from + by;
  if (from === -1 || to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * The widest closed window either tab shows. The page and the sidebar badge
 * both fetch with it, so they share one cache entry.
 */
export function fetchWindow(views: ReviewsViews): ClosedWindow {
  const rank = (window: ClosedWindow) => CLOSED_WINDOWS.indexOf(window);
  return rank(views.created.closed) >= rank(views.toReview.closed)
    ? views.created.closed
    : views.toReview.closed;
}

const WINDOW_DAYS = { day: 1, week: 7, month: 30 } as const;

function closedInWindow(
  pr: ReviewPullRequest,
  window: ClosedWindow,
  now: Date,
) {
  if (pr.status === "open" || pr.status === "draft") return true;
  if (window === "all") return true;
  if (window === "none" || !pr.closedAt) return false;
  const since = now.getTime() - WINDOW_DAYS[window] * 86_400_000;
  return new Date(pr.closedAt).getTime() >= since;
}

/** The rows one tab shows, before search, grouping and ordering. */
export function tabItems(
  data: ReviewsList,
  tab: ReviewsTab,
  view: Pick<ReviewsView, "closed" | "showDrafts">,
  now = new Date(),
): ReviewItem[] {
  const items: ReviewItem[] =
    tab === "created"
      ? data.created
      : [
          ...data.toReview.map((pr) => ({
            ...pr,
            focus: "needsReview" as const,
          })),
          ...data.participated.map((pr) => ({ ...pr, focus: "done" as const })),
        ];
  return items.filter(
    (pr) =>
      (view.showDrafts || pr.status !== "draft") &&
      closedInWindow(pr, view.closed, now),
  );
}

export const PRIORITY_ORDER = [
  "urgent",
  "high",
  "medium",
  "low",
  "no-priority",
];

/** Linear's Size buckets, by changed lines: up to 10, 10 to 50, ... over 5,000. */
export const SIZE_BUCKETS = ["u10", "u50", "u250", "u1000", "u5000", "over"];

const FIXED_ORDER: Partial<Record<ReviewsGroupBy, string[]>> = {
  status: [...REVIEW_STATUSES],
  focus: ["needsReview", "done"],
  size: [...SIZE_BUCKETS],
  priority: PRIORITY_ORDER,
};

export function sizeBucket(pr: ReviewPullRequest) {
  const lines = pr.additions + pr.deletions;
  const limits = [10, 50, 250, 1000, 5000];
  const index = limits.findIndex((limit) => lines <= limit);
  return SIZE_BUCKETS[index === -1 ? limits.length : index];
}

export function groupKey(pr: ReviewItem, by: ReviewsGroupBy) {
  switch (by) {
    case "status":
      return reviewStatus(pr);
    case "focus":
      return pr.focus ?? "needsReview";
    case "author":
      return pr.author?.login ?? "";
    case "repository":
      return `${pr.owner}/${pr.repo}`;
    case "size":
      return sizeBucket(pr);
    case "priority":
      return pr.issue?.priority ?? "no-priority";
    case "project":
      return pr.issue?.project?.name ?? "";
    case "team":
      return pr.issue?.team.name ?? "";
    default:
      return "all";
  }
}

/** When the PR was opened, or merged or closed once it has been. */
export const reviewDate = (pr: ReviewPullRequest) =>
  pr.closedAt ?? pr.createdAt;

// ponytail: Linear does not document "Closest to merge"; this ranks approval,
// then checks, with drafts and finished PRs last. Swap for Linear's rule if found.
function mergeDistance(pr: ReviewPullRequest) {
  if (pr.status === "merged" || pr.status === "closed") return 100;
  const decision =
    pr.reviewDecision === "approved"
      ? 0
      : pr.reviewDecision === "changes_requested"
        ? 2
        : 1;
  const checks = pr.checks === "success" ? 0 : pr.checks === "failure" ? 2 : 1;
  return (pr.status === "draft" ? 10 : 0) + decision * 3 + checks;
}

/** Unlinked pull requests rank after every priority. */
const issueRank = (pr: ReviewPullRequest) =>
  pr.issue ? PRIORITY_ORDER.indexOf(pr.issue.priority) : PRIORITY_ORDER.length;

const STATUS_ORDER = FIXED_ORDER.status ?? [];

function compare(a: ReviewItem, b: ReviewItem, by: ReviewsSortBy) {
  switch (by) {
    case "author":
      return (a.author?.login ?? "").localeCompare(b.author?.login ?? "");
    case "closestToMerge":
      return mergeDistance(a) - mergeDistance(b);
    case "issuePriority":
      return issueRank(a) - issueRank(b);
    case "name":
      return a.title.localeCompare(b.title);
    case "date":
      return reviewDate(a).localeCompare(reviewDate(b));
    case "size":
      return a.additions + a.deletions - (b.additions + b.deletions);
    case "status":
      return (
        STATUS_ORDER.indexOf(reviewStatus(a)) -
        STATUS_ORDER.indexOf(reviewStatus(b))
      );
    default:
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

export function sortPullRequests(
  items: ReviewItem[],
  view: Pick<ReviewsView, "sortBy" | "sortDirection">,
) {
  const sign = view.sortDirection === "asc" ? 1 : -1;
  // Ties fall back to the most recently updated first.
  return [...items].sort(
    (a, b) =>
      sign * compare(a, b, view.sortBy) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function filterPullRequests(items: ReviewItem[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((pr) =>
    [pr.title, pr.owner, pr.repo, pr.author?.login ?? "", `#${pr.number}`]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

export type ReviewsGroup = {
  by: ReviewsGroupBy;
  key: string;
  items: ReviewItem[];
  children: ReviewsGroup[];
};

function bucket(items: ReviewItem[], by: ReviewsGroupBy): ReviewsGroup[] {
  const map = new Map<string, ReviewItem[]>();
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

export function groupId(group: Pick<ReviewsGroup, "by" | "key">) {
  return `${group.by}:${group.key}`;
}

export function buildGroups(
  items: ReviewItem[],
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
    view.pinned.includes(groupId(group)) ? 1 : 0;
  return groups.sort((a, b) => pinned(a) - pinned(b));
}

/**
 * Rows in the order they appear on screen, for keyboard navigation. Rows in
 * collapsed groups are hidden, so they are left out.
 */
export function visibleRows(
  groups: ReviewsGroup[],
  collapsed: string[] = [],
): ReviewItem[] {
  return groups.flatMap((group) =>
    collapsed.includes(groupId(group))
      ? []
      : group.children.length > 0
        ? visibleRows(group.children)
        : group.items,
  );
}
